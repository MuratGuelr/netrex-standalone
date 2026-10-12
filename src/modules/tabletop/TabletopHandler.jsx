"use client";

import { Component, Suspense, lazy, useEffect } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Dices } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { toast } from "@/src/utils/toast";
import { useTabletopStore } from "./store";

/**
 * 🎲 Masa modülü — oda içi oturum yöneticisi (HAFİF)
 *
 * Bu dosya ana pakette yer alır ama sadece birkaç KB: "masa açık mı" bilgisini ve açma/kapama mantığını taşır.
 * Ağır kısım (three.js + fizik) `TabletopTable` içindedir ve `lazy()` ile SADECE masa açılınca yüklenir.
 * Ayarlardan modül kapalıysa bu bileşen hiçbir şey yapmaz, hiçbir dinleyici kurmaz.
 */

const TabletopTable = lazy(() => import("./TabletopTable"));

export const TT_TOPICS = { OPEN: "tt_open", CLOSE: "tt_close", ASK: "tt_ask" };

const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
const publish = (lp, topic, obj, dest) => {
  try {
    lp?.publishData(enc(obj), { topic, reliable: true, ...(dest ? { destinationIdentities: dest } : {}) });
  } catch (e) {}
};

// Oda dışından (alt çubuktaki düğme) çağrılabilsin diye köprü
let bridge = null;
export const tabletopActions = {
  isReady: () => !!bridge,
  toggle: () => bridge?.toggle(),
};

/** Masada bir sorun çıkarsa (WebGL yok, bellek vb.) oda ve ses ETKİLENMESİN */
class TabletopBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("Masa modülü hatası:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0e0f12]/95">
          <div className="max-w-sm text-center p-6 rounded-2xl bg-[#111214] border border-red-500/30">
            <div className="text-sm font-bold text-red-400 mb-1">Masa açılamadı</div>
            <p className="text-xs text-[#949ba4] mb-4">
              Bu cihazda 3D masa çalıştırılamadı. Oda ve ses etkilenmedi.
            </p>
            <button
              onClick={this.props.onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
            >
              Kapat
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabletopSession() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const viewing = useTabletopStore((s) => s.viewing);
  const myId = localParticipant?.identity;

  useEffect(() => {
    if (!room || !localParticipant || !myId) return;
    const st = () => useTabletopStore.getState();

    const open = (hostId, hostName) => st().setSession({ hostId, hostName });

    const onData = (payload, participant, _k, topic) => {
      if (!participant || !topic || !topic.startsWith("tt_")) return;
      const from = participant.identity;
      if (from === myId) return;

      if (topic === TT_TOPICS.ASK) {
        // Yeni gelen "masa var mı?" diye soruyor: masayı ben açtıysam sadece ona söyle
        if (st().session?.hostId === myId) {
          publish(localParticipant, TT_TOPICS.OPEN, { hostName: localParticipant.name || "Biri" }, [from]);
        }
        return;
      }
      if (topic === TT_TOPICS.OPEN) {
        if (st().session) return; // zaten bir masa var: ilk açılan geçerli
        let name = participant.name || "Biri";
        try {
          name = JSON.parse(new TextDecoder().decode(payload))?.hostName || name;
        } catch (e) {}
        open(from, name);
        toast.info(`${name} bir masa açtı`, {
          id: "tt-open",
          duration: 8000,
          action: { label: "Katıl", onClick: () => tabletopActions.toggle() },
        });
        return;
      }
      if (topic === TT_TOPICS.CLOSE && st().session?.hostId === from) {
        st().reset();
        toast.info("Masa kapatıldı");
      }
    };

    const onLeft = (p) => {
      if (st().session?.hostId === p?.identity) {
        st().reset();
        toast.info("Masayı açan kişi ayrıldı, masa kapandı");
      }
    };

    bridge = {
      toggle: () => {
        const s = st();
        if (s.viewing) {
          if (s.session?.hostId === myId) {
            publish(localParticipant, TT_TOPICS.CLOSE, {});
            s.setSession(null);
          }
          s.setViewing(false);
          return;
        }
        if (!s.session) {
          const name = localParticipant.name || "Biri";
          s.setSession({ hostId: myId, hostName: name });
          publish(localParticipant, TT_TOPICS.OPEN, { hostName: name });
        }
        s.setViewing(true);
      },
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    publish(localParticipant, TT_TOPICS.ASK, {}); // odada açık masa var mı?

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
      if (st().session?.hostId === myId) publish(localParticipant, TT_TOPICS.CLOSE, {});
      bridge = null;
      st().reset();
    };
  }, [room, localParticipant, myId]);

  if (!viewing) return null;

  return (
    <TabletopBoundary onClose={() => tabletopActions.toggle()}>
      <Suspense
        fallback={
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0e0f12]/95 text-[#949ba4] text-sm gap-2">
            <Dices size={18} className="animate-spin" />
            Masa hazırlanıyor…
          </div>
        }
      >
        <TabletopTable />
      </Suspense>
    </TabletopBoundary>
  );
}

/** Ayarlardan kapalıysa HİÇBİR ŞEY çalışmaz */
export default function TabletopHandler() {
  const enabled = useSettingsStore((s) => s.tabletopEnabled);
  if (!enabled) return null;
  return <TabletopSession />;
}
