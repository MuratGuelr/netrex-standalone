"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import {
  Dices, Plus, CircleDot, RotateCcw, Camera, X, Loader2, Package, Hand, Trash2, FileJson, Store, Save,
  Volume2, VolumeX, CircleHelp, Lock, Unlock, Shuffle, FlipVertical2, Layers,
} from "lucide-react";
import { toast } from "@/src/utils/toast";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useTabletopStore } from "./store";
import { tabletopActions } from "./TabletopHandler";
import { BUILTIN_MODS, parseModText, validateCompiled } from "./modFormat";
import { sendChunked, Reassembler, openChunked } from "./modPack";
import { buildBuiltinInBrowser, downloadModFile } from "./modBuilder";
import WorkshopPanel from "./WorkshopPanel";

/**
 * 🎲 3D Masa (ağır kısım) — YALNIZCA masa açılınca yüklenir.
 * Kontroller ve davranışlar Tabletop Simulator'ı örnek alır (bkz. engine.js başlığı).
 * three.js + rapier `engine.js` içindedir ve burada dinamik `import()` ile çağrılır;
 * bileşen sökülünce engine.dispose() GPU, fizik ve dinleyicileri tamamen serbest bırakır.
 */

const T = {
  SNAP: "tt_snap", // host → herkes, kayıpsız olmayan, ~15 Hz konum
  UPD: "tt_upd", // host → herkes, deste/nesne değişimi (güvenilir)
  FULL: "tt_full", // host → herkes/biri, tam durum (parçalı, güvenilir)
  MOD: "tt_mod", // host → herkes/biri, mod (hazır mod kimliği ya da parçalı sıkıştırılmış mod)
  IN: "tt_in", // oyuncu → host, niyet
  HELLO: "tt_hello", // katılımcı → host
  RESULT: "tt_result", // host → herkes, zar sonucu
  HAND: "tt_hand", // host → tek oyuncu, ELİ (özel)
};
const MAX_SMALL = 40 * 1024;
const FULL_RESYNC_MS = 4000;
const enc = (o) => new TextEncoder().encode(JSON.stringify(o));

const HELP = [
  ["Sol tık", "Nesneyi al / bırak (Shift: destenin üstündeki kartı al)"],
  ["Sağ tık", "Nesne menüsü · basılı sürükle: kamerayı çevir"],
  ["Orta tuş", "Sürükle: kaydır · tıkla: çevir"],
  ["Tekerlek / WASD", "Yakınlaş / kamerayı kaydır"],
  ["Boşluk", "Kamerayı sıfırla"],
  ["Q / E", "Elindeki ya da üstündeki nesneyi döndür"],
  ["F", "Kartı / desteyi çevir"],
  ["R", "Zarı at / desteyi karıştır"],
  ["1 - 9", "Destenin üstünde: o kadar kart çek (eline)"],
  ["Alt", "Üzerindeki kartı büyüt"],
  ["Delete", "Üzerindeki nesneyi sil"],
  ["Ele bırak", "Kartı alttaki ele sürükle · elinden masaya sürükle"],
];

/** Kartın düz (2D) görünümü: eldeki kartlar ve Alt ile büyütme için */
function FaceCard({ face, dim, className = "", style, children }) {
  const bg = face.image ? `url(${face.image}) center/cover` : face.color;
  return (
    <div
      className={`relative overflow-hidden border border-black/40 shadow-lg flex items-center justify-center ${dim === "tile" ? "rounded-md" : "rounded-lg"} ${className}`}
      style={{ background: bg, ...style }}
    >
      {face.text ? (
        <span
          className="font-black leading-none select-none text-center px-1"
          style={{ color: face.textColor, fontSize: "clamp(10px, 34%, 80px)", textShadow: face.image ? "0 1px 3px rgba(0,0,0,.85)" : "none" }}
        >
          {face.text}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Araç çubuğu düğmesi (modül düzeyinde: her çizimde yeniden oluşmaz, tıklama kaçmaz) */
function Btn({ icon: Icon, label, onClick, danger, active, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition active:scale-95 ${
        danger
          ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white"
          : active
            ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
            : "bg-white/5 border-white/10 text-[#dbdee1] hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={14} />
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  );
}

/** Sağ tık menüsünde bir satır */
function MenuItem({ icon: Icon, label, hint, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition text-left ${
        danger ? "text-red-400 hover:bg-red-500/15" : "text-[#dbdee1] hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      <Icon size={14} className={danger ? "" : "text-[#949ba4]"} />
      <span className="flex-1">{label}</span>
      {hint ? <span className="text-[10px] text-[#5c5e66] font-mono">{hint}</span> : null}
    </button>
  );
}

/** Tabletop Simulator'daki gibi alt ortada yelpaze biçiminde açılan el */
function HandFan({ hand, faceOf, containerRef, onPlay, onReorder }) {
  const [drag, setDrag] = useState(null); // { i, x, y, sx, sy, moved }
  const n = hand.length;
  const step = Math.min(52, 640 / Math.max(1, n)); // kart başı yatay kayma (px)

  const finish = (e, d) => {
    if (!d) return;
    if (!d.moved) return onPlay(d.i, null, null);
    const r = containerRef.current?.getBoundingClientRect();
    const over = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (over) {
      // El içinde yeniden sırala: bırakılan x konumuna göre
      const mid = (r.left + r.right) / 2;
      const to = Math.max(0, Math.min(n - 1, Math.round((e.clientX - mid) / step + (n - 1) / 2)));
      onReorder(d.i, to);
    } else onPlay(d.i, e.clientX, e.clientY);
  };

  return (
    <>
      {hand.map((c, i) => {
        const off = i - (n - 1) / 2;
        const rot = Math.max(-18, Math.min(18, off * (n > 1 ? 3.2 : 0)));
        const lift = Math.abs(off) * Math.abs(off) * 1.4;
        const dragging = drag?.i === i && drag.moved;
        return (
          <div
            key={`${i}-${c.f}`}
            className={`group/hc absolute bottom-3 left-1/2 pointer-events-auto cursor-grab active:cursor-grabbing ${dragging ? "opacity-30" : ""}`}
            style={{ transform: `translateX(calc(-50% + ${off * step}px)) translateY(${lift}px) rotate(${rot}deg)`, transformOrigin: "50% 120%", zIndex: i }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setDrag({ i, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
            }}
            onPointerMove={(e) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6 } : d))}
            onPointerUp={(e) => {
              const d = drag;
              setDrag(null);
              finish(e, d);
            }}
            onPointerCancel={() => setDrag(null)}
          >
            <div className="transition-transform duration-150 group-hover/hc:-translate-y-6 group-hover/hc:scale-110">
              <FaceCard face={faceOf(c.f)} dim={c.d} className={c.d === "tile" ? "w-[58px] h-[80px]" : "w-[66px] h-[94px]"} />
            </div>
          </div>
        );
      })}
      {drag?.moved && (
        <div className="fixed z-[70] pointer-events-none" style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -60%) rotate(-4deg)" }}>
          <FaceCard face={faceOf(hand[drag.i].f)} dim={hand[drag.i].d} className="w-[74px] h-[106px] shadow-2xl ring-2 ring-amber-400/60" />
        </div>
      )}
    </>
  );
}

export default function TabletopTable() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const session = useTabletopStore((s) => s.session);
  const controlBarHidden = useSettingsStore((s) => s.controlBarHidden);

  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const handRef = useRef(null);
  const apiRef = useRef({});
  const compiledRef = useRef(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);
  const ctxRef = useRef(null);
  const lastTimer = useRef(null);
  const uiRef = useRef({ workshop: false });

  const [ready, setReady] = useState(false);
  const [last, setLast] = useState(null);
  const [hand, setHand] = useState([]);
  const [handCounts, setHandCounts] = useState({});
  const [modName, setModName] = useState("");
  const [progress, setProgress] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workshop, setWorkshop] = useState(false);
  const [ctx, setCtx] = useState(null); // sağ tık menüsü
  const [preview, setPreview] = useState(null); // Alt ile büyütme
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(false);

  uiRef.current.workshop = workshop;

  const myId = localParticipant?.identity;
  const hostId = session?.hostId;
  const isHost = !!myId && hostId === myId;

  const nameOf = useCallback(
    (id) => (id === myId ? localParticipant?.name : room?.remoteParticipants?.get(id)?.name) || "Biri",
    [room, localParticipant, myId],
  );

  useEffect(() => {
    if (!room || !localParticipant || !myId || !hostId || !containerRef.current) return;
    let cancelled = false;
    let engine = null;
    let resync = null;
    const reasm = new Reassembler();
    let queue = Promise.resolve();

    const publish = (topic, obj, reliable, dest) => {
      try {
        localParticipant.publishData(enc(obj), { topic, reliable, ...(dest ? { destinationIdentities: dest } : {}) });
      } catch (e) {}
    };
    const chunked = (topic, obj, dest, compress = false, onProgress) =>
      sendChunked((t, m, d) => publish(t, m, true, d), topic, obj, dest, { compress, onProgress });

    const showResult = ({ value, by }) => {
      setLast({ value, by });
      clearTimeout(lastTimer.current);
      lastTimer.current = setTimeout(() => setLast(null), 5000);
    };

    // ── Host: dünyayı (mod + tam durum) yayınla ──
    let builtinId = "classic";
    const sendMod = async (dest) => {
      if (builtinId) publish(T.MOD, { b: builtinId }, true, dest);
      else await chunked(T.MOD, compiledRef.current, dest, true);
    };
    const sendFull = (dest) => chunked(T.FULL, engine.getFull(), dest);
    const broadcastWorld = async (dest) => {
      await sendMod(dest);
      await sendFull(dest);
    };
    const sendHandTo = (pid, cards) => {
      if (pid === myId) setHand(cards.map((c) => ({ ...c })));
      else publish(T.HAND, { cards }, true, [pid]);
    };

    const loadModHost = (mod, builtin = null) => {
      if (!engine || !isHost) return;
      builtinId = builtin;
      compiledRef.current = mod;
      engine.loadMod(mod);
      setModName(mod.name);
      setHand([]);
      broadcastWorld();
    };
    apiRef.current.loadMod = loadModHost;

    // ── Gelen mesajlar ──
    const handleParsed = async (topic, from, msg) => {
      if (!engine) return;
      if (isHost) {
        if (topic === T.HELLO) {
          await broadcastWorld([from]);
          const h = engine.hands.get(from);
          if (h) sendHandTo(from, h);
          publish(T.UPD, { specs: [], removed: [], snap: [], hands: engine.handCounts }, true, [from]);
        } else if (topic === T.IN) {
          if (msg.k === "reset" && from !== hostId) return;
          engine.applyIntent(from, msg);
        }
        return;
      }
      if (from !== hostId) return;
      if (topic === T.SNAP) engine.applySnapshot(msg.s);
      else if (topic === T.UPD) engine.applyUpdate(msg);
      else if (topic === T.RESULT && typeof msg.value === "number") showResult(msg);
      else if (topic === T.HAND) {
        const cards = (Array.isArray(msg.cards) ? msg.cards : []).slice(0, 30).map((c) => ({
          f: Math.max(0, Math.round(Number(c?.f) || 0)),
          d: c?.d === "tile" ? "tile" : "card",
          b: Math.max(0, Math.round(Number(c?.b) || 0)),
        }));
        setHand(cards);
      } else if (topic === T.MOD) {
        let mod;
        if (typeof msg.b === "string") {
          if (!BUILTIN_MODS.some((m) => m.id === msg.b)) return;
          mod = buildBuiltinInBrowser(msg.b);
        } else mod = validateCompiled(msg);
        compiledRef.current = mod;
        builtinId = typeof msg.b === "string" ? msg.b : null;
        engine.resetForMod(mod);
        setModName(mod.name);
        setHand([]);
      } else if (topic === T.FULL) {
        engine.applyFull(msg);
      }
    };

    const onData = (payload, participant, _k, topic) => {
      if (!participant || !engine || !topic || !topic.startsWith("tt_")) return;
      if (payload.byteLength > MAX_SMALL) return;
      const from = participant.identity;
      if (from === myId) return;
      let msg;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload));
      } catch (e) {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.c === 1) {
        if (from !== hostId && !isHost) return;
        if (topic === T.MOD && msg.i === 0) setProgress(0.02);
        const done = reasm.push(from, msg);
        if (topic === T.MOD) setProgress(done ? null : Math.max(0.02, (msg.i + 1) / msg.n));
        if (!done) return;
        queue = queue
          .then(async () => handleParsed(topic, from, await openChunked(done)))
          .catch((e) => {
            console.warn("Masa verisi işlenemedi:", e);
            setProgress(null);
            if (topic === T.MOD) toast.error("Mod alınamadı.");
          });
        return;
      }
      queue = queue.then(() => handleParsed(topic, from, msg)).catch((e) => console.warn("Masa mesajı hatası:", e));
    };

    const onLeft = (p) => {
      if (isHost && engine && p?.identity) engine.releaseHold(p.identity);
    };

    (async () => {
      let mod;
      try {
        mod = await import("./engine");
      } catch (e) {
        console.error("Masa motoru yüklenemedi:", e);
        toast.error("Masa yüklenemedi.");
        tabletopActions.toggle();
        return;
      }
      if (cancelled) return;

      engine = new mod.TableEngine(containerRef.current, {
        isHost,
        myId,
        onIntent: (intent) => {
          if (isHost) engine.applyIntent(myId, intent);
          else publish(T.IN, intent, intent.k !== "move", [hostId]);
        },
        onSnapshot: (s) => publish(T.SNAP, { s }, false),
        onResult: (r) => {
          publish(T.RESULT, r, true);
          showResult(r);
        },
        onChange: (upd) => publish(T.UPD, upd, true),
        onFullReload: () => sendFull(),
        onHand: sendHandTo,
        onHands: setHandCounts,
        onContext: (info) => {
          ctxRef.current = info;
          setCtx(info);
        },
        onPreview: setPreview,
        keysEnabled: () => !uiRef.current.workshop,
        isOverHand: (x, y) => {
          const r = handRef.current?.getBoundingClientRect();
          return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        },
        getPlayerIds: () => [myId, ...room.remoteParticipants.keys()],
      });
      try {
        await engine.init();
      } catch (e) {
        console.error("Masa başlatılamadı:", e);
        engine.dispose();
        toast.error("Bu cihazda 3D masa başlatılamadı.");
        tabletopActions.toggle();
        return;
      }
      if (cancelled) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;
      room.on(RoomEvent.DataReceived, onData);
      room.on(RoomEvent.ParticipantDisconnected, onLeft);

      if (isHost) {
        const classic = buildBuiltinInBrowser("classic");
        compiledRef.current = classic;
        engine.loadMod(classic);
        setModName(classic.name);
        resync = setInterval(() => sendFull(), FULL_RESYNC_MS);
      } else {
        publish(T.HELLO, {}, true, [hostId]);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      clearInterval(resync);
      clearTimeout(lastTimer.current);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
      reasm.clear();
      apiRef.current = {};
      engineRef.current = null;
      engine?.dispose();
      engine = null;
    };
  }, [room, localParticipant, myId, hostId, isHost]);

  const send = useCallback(
    (intent) => {
      const e = engineRef.current;
      if (!e) return;
      if (isHost) e.applyIntent(myId, intent);
      else
        try {
          localParticipant.publishData(enc(intent), { topic: T.IN, reliable: true, destinationIdentities: [hostId] });
        } catch (err) {}
    },
    [isHost, myId, hostId, localParticipant],
  );

  // Menü / bağlam menüsü dışına tıklayınca ya da Esc ile kapansın
  useEffect(() => {
    if (!menuOpen && !ctx) return;
    const onDown = (ev) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(ev.target)) setMenuOpen(false);
      if (ctx && !ev.target.closest?.("[data-tt-ctx]")) setCtx(null);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        setMenuOpen(false);
        setCtx(null);
        setHelp(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, ctx]);

  const loadHostMod = (mod, builtin) => apiRef.current.loadMod?.(mod, builtin);
  const faceOf = (i) => engineRef.current?.getFaceView(i) || { color: "#fff", text: "", textColor: "#111" };
  const others = Object.entries(handCounts).filter(([pid, n]) => pid !== myId && n > 0);

  const doCtx = (intent) => {
    send(intent);
    setCtx(null);
  };

  // Eldeki kartı oynat: ekran noktası verildiyse masadaki o noktaya, yoksa kendi önüne
  const playFromHand = (index, cx, cy) => {
    const pt = cx != null ? engineRef.current?.tablePoint(cx, cy) : null;
    if (cx != null && !pt) return; // masa dışına bırakıldı: iptal
    send({ k: "play", index, ...(pt || {}) });
  };

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-[#0b0c0f] animate-in fade-in duration-200"
      style={{ paddingBottom: controlBarHidden ? 0 : 108 }} // alt kontrol çubuğunun altında kalmasın
    >
      {/* Üst çubuk */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#111214]">
        <div className="flex items-center gap-2 mr-auto min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <Dices size={16} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{modName || "Masa"}</div>
            <div className="text-[10px] text-[#949ba4] truncate">{isHost ? "Masayı sen açtın" : `${session?.hostName || "Biri"} açtı`}</div>
          </div>
        </div>

        <Btn icon={Dices} label="Zarları At" onClick={() => send({ k: "rollAll" })} />
        <Btn icon={Plus} label="Zar" onClick={() => send({ k: "spawn", kind: "die" })} />
        <Btn
          icon={CircleDot}
          label="Parça"
          onClick={() => send({ k: "spawn", kind: "piece", color: ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6", "#e67e22"][Math.floor(Math.random() * 6)] })}
        />

        {/* Mod menüsü */}
        <div className="relative" ref={menuRef}>
          <Btn icon={Package} label="Mod" onClick={() => setMenuOpen((v) => !v)} active={menuOpen} />
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#111214] border border-white/10 shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                Hazır modlar {isHost ? "" : "(masayı açan seçer)"}
              </div>
              {BUILTIN_MODS.map((m) => (
                <button
                  key={m.id}
                  disabled={!isHost}
                  onClick={() => {
                    setMenuOpen(false);
                    loadHostMod(buildBuiltinInBrowser(m.id), m.id);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
                >
                  <div className="text-sm font-semibold text-white">{m.name}</div>
                  <div className="text-[11px] text-[#949ba4]">{m.description}</div>
                </button>
              ))}
              <div className="h-px bg-white/[0.06] my-1.5" />
              <MenuItem icon={Store} label="Atölye" onClick={() => { setMenuOpen(false); setWorkshop(true); }} />
              <button
                disabled={!isHost}
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40 text-[13px] font-medium text-[#dbdee1] transition"
              >
                <FileJson size={14} className="text-[#949ba4]" /> Dosyadan yükle
              </button>
              <MenuItem icon={Save} label="Modu dosyaya kaydet" onClick={() => compiledRef.current && downloadModFile(compiledRef.current)} />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = "";
              setMenuOpen(false);
              if (!f) return;
              try {
                if (f.size > 7_000_000) throw new Error("Dosya çok büyük.");
                loadHostMod(parseModText(await f.text()), null);
              } catch (err) {
                toast.error(err?.message || "Mod dosyası okunamadı.");
              }
            }}
          />
        </div>

        <Btn
          icon={muted ? VolumeX : Volume2}
          title={muted ? "Sesi aç" : "Sesi kapat"}
          onClick={() => {
            engineRef.current?.setMuted(!muted);
            setMuted(!muted);
          }}
        />
        <Btn icon={CircleHelp} title="Kontroller" active={help} onClick={() => setHelp((v) => !v)} />
        <Btn icon={Camera} label="Kamera" title="Kamerayı sıfırla (Boşluk)" onClick={() => engineRef.current?.resetCamera()} />
        {isHost && <Btn icon={RotateCcw} label="Sıfırla" onClick={() => send({ k: "reset" })} danger />}
        <Btn icon={X} label={isHost ? "Masayı Kapat" : "Ayrıl"} onClick={() => tabletopActions.toggle()} danger />
      </div>

      {/* 3D alan */}
      <div className="relative flex-1 min-h-0" style={{ background: "radial-gradient(ellipse at 50% 30%, #2b2e38 0%, #15171c 55%, #0b0c0f 100%)" }}>
        <div ref={containerRef} className="absolute inset-0" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-[#949ba4] text-sm gap-2 pointer-events-none">
            <Loader2 size={18} className="animate-spin" />
            Masa hazırlanıyor…
          </div>
        )}

        {progress !== null && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-64 rounded-xl bg-[#111214]/95 border border-white/10 p-3 pointer-events-none">
            <div className="text-xs text-white font-semibold mb-1.5">Mod alınıyor…</div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-amber-400 transition-all duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {last && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#111214]/95 border border-amber-500/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-black font-black text-lg flex items-center justify-center">{last.value}</div>
              <div className="text-sm text-white font-semibold">{nameOf(last.by)} attı</div>
            </div>
          </div>
        )}

        {/* Başkalarının el sayıları */}
        {others.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-col gap-1 pointer-events-none">
            {others.slice(0, 5).map(([pid, n]) => (
              <div key={pid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-[11px] text-[#dbdee1]">
                <Hand size={11} className="text-amber-400" />
                <span className="font-semibold text-white">{nameOf(pid)}</span> {n}
              </div>
            ))}
          </div>
        )}

        {/* Kontroller yardımı */}
        {help && (
          <div className="absolute top-3 left-3 w-80 max-w-[92%] rounded-xl bg-[#111214]/95 border border-white/10 p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-bold text-white mb-2">Kontroller</div>
            <div className="space-y-1.5">
              {HELP.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-[11px]">
                  <span className="shrink-0 w-24 font-mono text-amber-300">{k}</span>
                  <span className="text-[#b5bac1]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alt ile büyütülen kart */}
        {preview && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
            <FaceCard face={preview.face} dim={preview.dim} className={preview.dim === "tile" ? "w-[200px] h-[270px]" : "w-[240px] h-[336px]"} style={{ fontSize: 48 }}>
              {preview.count > 1 && (
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[11px] font-bold text-white">{preview.count}</span>
              )}
            </FaceCard>
          </div>
        )}

        {/* Sağ tık menüsü */}
        {ctx && ctx.kind !== "board" && (
          <div
            data-tt-ctx
            className="fixed z-[80] w-56 rounded-xl bg-[#111214] border border-white/10 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: Math.min(ctx.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 240), top: Math.min(ctx.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 360) }}
          >
            {ctx.kind === "deck" && (
              <>
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                  {ctx.n} {ctx.dim === "tile" ? "taş" : "kart"}
                </div>
                <MenuItem icon={FlipVertical2} label="Çevir" hint="F" onClick={() => doCtx({ k: "flip", id: ctx.id })} />
                {ctx.n > 1 && <MenuItem icon={Shuffle} label="Karıştır" hint="R" onClick={() => doCtx({ k: "shuffle", id: ctx.id })} />}
                {ctx.n > 1 && <MenuItem icon={Layers} label="Üstteki kartı çek" hint="Shift" onClick={() => doCtx({ k: "draw", id: ctx.id })} />}
                <MenuItem icon={Hand} label="Elime al" onClick={() => doCtx({ k: "draw", id: ctx.id, toHand: true })} />
                {ctx.n > 1 && (
                  <div className="px-2.5 py-1.5">
                    <div className="text-[11px] text-[#949ba4] mb-1">Herkese dağıt</div>
                    <div className="flex gap-1">
                      {[1, 3, 5, 7, 14].map((n) => (
                        <button
                          key={n}
                          onClick={() => doCtx({ k: "deal", id: ctx.id, n })}
                          className="flex-1 h-7 rounded-md bg-white/5 hover:bg-amber-500 hover:text-black text-xs font-bold text-white transition"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {ctx.kind === "die" && <MenuItem icon={Dices} label="Zarı at" hint="R" onClick={() => doCtx({ k: "roll", id: ctx.id })} />}
            <MenuItem icon={ctx.locked ? Unlock : Lock} label={ctx.locked ? "Kilidi aç" : "Kilitle"} onClick={() => doCtx({ k: "lock", id: ctx.id })} />
            <div className="h-px bg-white/[0.06] my-1" />
            <MenuItem icon={Trash2} label="Sil" hint="Del" danger onClick={() => doCtx({ k: "remove", id: ctx.id })} />
          </div>
        )}

        {/* El: yelpaze biçiminde, alt ortada. Kartlar yalnızca sana görünür. */}
        <div ref={handRef} className="absolute bottom-0 left-0 right-0 h-[150px] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-2 left-3 text-[10px] text-white/35 flex items-center gap-1">
            <Hand size={11} /> {hand.length ? `Elin (${hand.length}) · sürükle: masaya at` : "Elin boş · kartı buraya bırak"}
          </div>
          <HandFan
            hand={hand}
            faceOf={faceOf}
            containerRef={handRef}
            onPlay={playFromHand}
            onReorder={(from, to) => send({ k: "reorderHand", from, to })}
          />
        </div>
      </div>

      {workshop && (
        <WorkshopPanel
          isHost={isHost}
          currentMod={compiledRef.current}
          onLoadMod={(mod) => loadHostMod(mod, null)}
          onClose={() => setWorkshop(false)}
        />
      )}
    </div>
  );
}
