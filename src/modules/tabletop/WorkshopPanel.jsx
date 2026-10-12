"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Download, Star, Flag, Trash2, Upload, Loader2, Play, FileJson, Layers, LayoutGrid, PackagePlus } from "lucide-react";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "@/src/utils/toast";
import { parseModText, LIMITS } from "./modFormat";
import { buildDeckMod, buildBoardMod, makeThumb, downloadModFile } from "./modBuilder";
import { listMods, downloadMod, publishMod, deleteMod, rateMod, getMyRating, reportMod } from "./workshopService";

/**
 * 🎲 Masa Atölyesi paneli: modları keşfet / indir / yayınla / oluştur.
 * Modlar yalnızca veridir; indirilen her şey yeniden doğrulanır (bkz. modFormat.js).
 */

const SORT_LABELS = { new: "Yeni", popular: "Popüler", top: "En iyi" };

const Stars = ({ value, onPick, size = 16 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onPick}
        onClick={() => onPick?.(n)}
        className={onPick ? "hover:scale-110 transition" : "cursor-default"}
      >
        <Star size={size} className={n <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-white/20"} />
      </button>
    ))}
  </div>
);

const fmtSize = (chars) => (chars > 1_000_000 ? `${(chars / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(chars / 1000))} KB`);

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full bg-[#1e1f22] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#5c5e66] outline-none focus:border-amber-500/50 transition";

export default function WorkshopPanel({ isHost, currentMod, onLoadMod, onClose }) {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("browse"); // browse | create
  const [sort, setSort] = useState("new");
  const [mods, setMods] = useState(null); // null = yükleniyor
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState("");
  const [myRating, setMyRating] = useState(0);

  // Oluştur sekmesi
  const [draft, setDraft] = useState(currentMod || null); // derlenmiş mod
  const [kind, setKind] = useState("deck");
  const [form, setForm] = useState({ name: "", description: "", cardBackColor: "#1e3a8a", width: 24, depth: 24, pieces: 4 });
  const filesRef = useRef({ back: null, fronts: [], board: null });
  const fileInputRef = useRef(null);

  const refresh = useCallback(async () => {
    setMods(null);
    setError("");
    try {
      setMods(await listMods(sort));
    } catch (e) {
      console.error(e);
      setMods([]);
      setError("Atölye şu an yüklenemedi (bağlantı ya da izin sorunu).");
    }
  }, [sort]);

  useEffect(() => {
    if (tab === "browse") refresh();
  }, [tab, refresh]);

  useEffect(() => {
    setMyRating(0);
    if (selected && user?.uid) getMyRating(selected.id, user.uid).then(setMyRating).catch(() => {});
  }, [selected, user?.uid]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return mods || [];
    return (mods || []).filter((m) => `${m.name} ${m.author} ${(m.tags || []).join(" ")}`.toLowerCase().includes(s));
  }, [mods, q]);

  const run = async (label, fn) => {
    setBusy(label);
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "İşlem başarısız.");
    } finally {
      setBusy("");
    }
  };

  const loadToTable = (mod) => {
    if (!isHost) return toast.info("Mod yüklemeyi yalnızca masayı açan kişi yapabilir.");
    onLoadMod(mod);
    toast.success(`"${mod.name}" masaya kuruldu.`);
    onClose();
  };

  // ───── Keşfet ─────
  const detail = selected && (
    <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-[#111214] border-l border-white/10 flex flex-col animate-in fade-in slide-in-from-right-2 duration-200 z-10">
      <div className="p-3 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="font-bold text-white text-sm truncate flex-1">{selected.name}</div>
        <button onClick={() => setSelected(null)} className="text-[#949ba4] hover:text-white"><X size={16} /></button>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar flex-1">
        {selected.thumb ? <img src={selected.thumb} alt="" className="w-full h-36 object-cover rounded-xl border border-white/10" /> : null}
        <div className="text-xs text-[#949ba4]">{selected.author || "Bilinmiyor"} · {selected.objects} nesne · {fmtSize(selected.size || 0)}</div>
        <p className="text-sm text-[#dbdee1] whitespace-pre-wrap break-words">{selected.description || "Açıklama yok."}</p>
        <div className="flex items-center gap-3 text-xs text-[#949ba4]">
          <span className="flex items-center gap-1"><Download size={12} />{selected.downloads || 0}</span>
          <span className="flex items-center gap-1"><Star size={12} />{selected.ratingCount ? (selected.ratingSum / selected.ratingCount).toFixed(1) : "—"} ({selected.ratingCount || 0})</span>
        </div>
        <div>
          <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">Puanın</div>
          <Stars
            value={myRating}
            onPick={(n) =>
              run("rate", async () => {
                await rateMod(selected.id, user.uid, n);
                setMyRating(n);
                toast.success("Puan verildi.");
                refresh();
              })
            }
          />
        </div>
      </div>
      <div className="p-3 border-t border-white/[0.06] space-y-2">
        <button
          disabled={!!busy}
          onClick={() =>
            run("load", async () => {
              const mod = await downloadMod(selected.id);
              loadToTable(mod);
            })
          }
          className={`w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
            isHost ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-white/5 text-[#949ba4] cursor-not-allowed"
          }`}
          title={isHost ? "Modu masaya kur" : "Sadece masayı açan kişi mod yükleyebilir"}
        >
          {busy === "load" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Masaya Kur
        </button>
        <div className="flex gap-2">
          <button
            disabled={!!busy}
            onClick={() => run("save", async () => downloadModFile(await downloadMod(selected.id)))}
            className="flex-1 h-9 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-[#dbdee1] hover:bg-white/10 flex items-center justify-center gap-1.5"
          >
            <FileJson size={14} /> Dosyaya kaydet
          </button>
          <button
            onClick={() =>
              run("report", async () => {
                const ok = await reportMod(selected.id, user.uid);
                toast[ok ? "success" : "info"](ok ? "Bildirildi, teşekkürler." : "Bunu zaten bildirdin.");
              })
            }
            className="h-9 px-3 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-[#dbdee1] hover:bg-red-500/20 hover:text-red-300 flex items-center gap-1.5"
            title="Telifli / uygunsuz içeriği bildir"
          >
            <Flag size={14} />
          </button>
          {selected.authorId === user?.uid && (
            <button
              onClick={() =>
                run("del", async () => {
                  await deleteMod(selected.id);
                  toast.success("Mod silindi.");
                  setSelected(null);
                  refresh();
                })
              }
              className="h-9 px-3 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center gap-1.5"
              title="Kendi modunu sil"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const browse = (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="p-3 flex flex-wrap items-center gap-2 border-b border-white/[0.06]">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c5e66]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mod ara…" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex items-center gap-1 bg-[#1e1f22] rounded-xl p-1 border border-white/10">
          {Object.entries(SORT_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-3 h-7 rounded-lg text-xs font-bold transition ${sort === k ? "bg-amber-500 text-black" : "text-[#949ba4] hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {mods === null ? (
          <div className="h-40 flex items-center justify-center text-[#949ba4] gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Yükleniyor…</div>
        ) : error ? (
          <div className="text-center text-sm text-red-300 py-10">{error}</div>
        ) : shown.length === 0 ? (
          <div className="text-center text-sm text-[#949ba4] py-10">Henüz mod yok. İlk modu sen yayınla!</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {shown.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className={`text-left rounded-2xl overflow-hidden border bg-[#16171a] hover:bg-[#1b1c20] transition active:scale-[0.98] ${selected?.id === m.id ? "border-amber-500/60" : "border-white/10"}`}
              >
                <div className="h-24 bg-[#1e1f22]">
                  {m.thumb ? <img src={m.thumb} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-white/30">{(m.name || "?")[0]}</div>}
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-bold text-white truncate">{m.name}</div>
                  <div className="text-[11px] text-[#949ba4] truncate">{m.author || "—"}</div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#949ba4]">
                    <Stars value={m.ratingCount ? m.ratingSum / m.ratingCount : 0} size={11} />
                    <span className="flex items-center gap-1"><Download size={11} />{m.downloads || 0}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {detail}
    </div>
  );

  // ───── Oluştur / Yayınla ─────
  const makeMod = () =>
    run("build", async () => {
      const meta = { name: form.name.trim(), author: user?.displayName || "", description: form.description };
      if (!meta.name) throw new Error("Modun bir adı olmalı.");
      const mod =
        kind === "deck"
          ? await buildDeckMod({ ...meta, back: filesRef.current.back, fronts: filesRef.current.fronts, cardBackColor: form.cardBackColor })
          : await buildBoardMod({ ...meta, board: filesRef.current.board, width: Number(form.width), depth: Number(form.depth), pieces: Number(form.pieces) });
      setDraft(mod);
      toast.success("Mod hazırlandı.");
    });

  const loadFile = (file) =>
    run("file", async () => {
      if (!file) return;
      if (file.size > LIMITS.maxFileChars) throw new Error("Dosya çok büyük.");
      setDraft(parseModText(await file.text()));
      toast.success("Mod dosyası okundu.");
    });

  const create = (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-5">
      {/* Hazır mod kartı */}
      {draft && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <PackagePlus size={16} className="text-amber-400" />
            <div className="font-bold text-white text-sm truncate flex-1">{draft.name}</div>
            <button onClick={() => setDraft(null)} className="text-[#949ba4] hover:text-white"><X size={14} /></button>
          </div>
          <div className="text-xs text-[#949ba4] mt-1">{draft.objects.length} nesne · {Object.keys(draft.assets).length} görsel</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => loadToTable(draft)}
              className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${isHost ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-white/5 text-[#949ba4] cursor-not-allowed"}`}
              title={isHost ? "" : "Sadece masayı açan kişi mod yükleyebilir"}
            >
              <Play size={14} /> Masaya Kur
            </button>
            <button
              disabled={!!busy}
              onClick={() =>
                run("publish", async () => {
                  if (!user?.uid) throw new Error("Yayınlamak için giriş yapın.");
                  await publishMod(draft, { uid: user.uid, authorName: user.displayName || "", thumb: await makeThumb(draft) });
                  toast.success("Atölyede yayınlandı!");
                  setTab("browse");
                })
              }
              className="h-9 px-3 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white hover:bg-white/15 flex items-center gap-1.5 transition active:scale-95"
            >
              {busy === "publish" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Atölyede Yayınla
            </button>
            <button
              onClick={() => downloadModFile(draft)}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-[#dbdee1] hover:bg-white/10 flex items-center gap-1.5 transition active:scale-95"
            >
              <FileJson size={14} /> Dosyaya Kaydet
            </button>
          </div>
          <p className="text-[10px] text-[#5c5e66] mt-2">
            Yayınlamadan önce: başkasının telifli görsellerini (ticari oyun kartları, tahtalar) yüklemeyin. Bildirilen modlar kaldırılır.
          </p>
        </div>
      )}

      {/* Dosyadan yükle */}
      <div>
        <div className="text-xs font-bold text-white mb-2">Dosyadan yükle</div>
        <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-10 px-4 rounded-xl text-sm font-bold bg-white/5 border border-dashed border-white/20 text-[#dbdee1] hover:bg-white/10 flex items-center gap-2 transition"
        >
          <FileJson size={16} /> .netrexmod.json dosyası seç
        </button>
      </div>

      {/* Oluştur */}
      <div>
        <div className="text-xs font-bold text-white mb-2">Yeni mod oluştur</div>
        <div className="flex gap-2 mb-3">
          {[
            ["deck", "Kart destesi", Layers],
            ["board", "Tahta oyunu", LayoutGrid],
          ].map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${kind === k ? "bg-amber-500 text-black border-amber-500" : "bg-white/5 border-white/10 text-[#dbdee1] hover:bg-white/10"}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <Field label="Mod adı">
            <input value={form.name} maxLength={LIMITS.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Örn. Hafıza Kartları" />
          </Field>
          <Field label="Açıklama">
            <textarea value={form.description} maxLength={LIMITS.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} h-16 resize-none`} />
          </Field>
          {kind === "deck" ? (
            <>
              <Field label="Kart ön yüzleri (her görsel bir kart)">
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => (filesRef.current.fronts = [...e.target.files])} className="text-xs text-[#949ba4]" />
              </Field>
              <Field label="Kart arkası (isteğe bağlı)">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => (filesRef.current.back = e.target.files?.[0] || null)} className="text-xs text-[#949ba4]" />
              </Field>
              <Field label="Arka rengi (görsel yoksa)">
                <input type="color" value={form.cardBackColor} onChange={(e) => setForm({ ...form, cardBackColor: e.target.value })} className="h-8 w-14 bg-transparent" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Tahta görseli">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => (filesRef.current.board = e.target.files?.[0] || null)} className="text-xs text-[#949ba4]" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Genişlik"><input type="number" min={6} max={38} value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} className={inputCls} /></Field>
                <Field label="Derinlik"><input type="number" min={6} max={24} value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value })} className={inputCls} /></Field>
                <Field label="Parça sayısı"><input type="number" min={0} max={6} value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} className={inputCls} /></Field>
              </div>
            </>
          )}
          <button
            disabled={!!busy}
            onClick={makeMod}
            className="h-10 px-4 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-2 transition active:scale-95"
          >
            {busy === "build" ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />} Modu Hazırla
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-[45] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-3xl h-full max-h-[640px] rounded-2xl bg-[#0d0e10] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="font-bold text-white">Masa Atölyesi</div>
          <div className="flex items-center gap-1 ml-3 bg-[#1e1f22] rounded-xl p-1 border border-white/10">
            {[["browse", "Keşfet"], ["create", "Oluştur / Yayınla"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3 h-7 rounded-lg text-xs font-bold transition ${tab === k ? "bg-amber-500 text-black" : "text-[#949ba4] hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="ml-auto text-[#949ba4] hover:text-white"><X size={18} /></button>
        </div>
        {tab === "browse" ? browse : create}
      </div>
    </div>
  );
}
