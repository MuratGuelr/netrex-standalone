
import { useEffect, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Mic, MicOff, VolumeX, Headphones } from "lucide-react";
import { toast } from "@/src/utils/toast";

// Moderasyon Komutlarını Dinleyen ve Mikrofon Senkronizasyonu Yapan Bileşen
export default function ModerationHandler({ 
  setServerMuted, 
  setServerDeafened, 
  setMutedBy,
  setDeafenedBy,
  setMutedAt,
  setDeafenedAt,
  serverMuted, 
  serverDeafened, 
  isDeafened, 
  setIsDeafened, 
  isMuted, 
  setIsMuted, 
  playSound 
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // ✅ FIX v2.0: Sync Lock + Debounce for race condition prevention
  const syncLockRef = useRef(false);
  const syncTimerRef = useRef(null);
  const lastDesiredStateRef = useRef(null);

  // Mikrofon ve Hoparlör durumunu hem manuel hem de sunucu kısıtlamalarına göre senkronize et
  useEffect(() => {
    if (!localParticipant) return;

    // ✅ Desired state hesapla
    const shouldEnableMic = !(isMuted || serverMuted || isDeafened || serverDeafened);

    // ✅ Eğer istenen durum aynıysa tekrar çalıştırma
    if (lastDesiredStateRef.current === shouldEnableMic) {
      return;
    }
    lastDesiredStateRef.current = shouldEnableMic;

    // ✅ Debounce: Hızlı art arda değişimlerde sadece son durumu uygula (50ms)
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      // ✅ Sync Lock: Aynı anda birden fazla çağrı olmasın
      if (syncLockRef.current) {
        console.log("⏳ syncMicState atlandı (lock aktif)");
        return;
      }

      // Asıl istenen durumu tekrar kontrol et (debounce sırasında değişmiş olabilir)
      const currentDesiredState = !(isMuted || serverMuted || isDeafened || serverDeafened);
      
      // Döngü koruması: Mevcut durum zaten istenen gibiyse işlem yapma
      if (localParticipant.isMicrophoneEnabled === currentDesiredState) {
        return;
      }

      syncLockRef.current = true;

      try {
        await localParticipant.setMicrophoneEnabled(currentDesiredState);
        // ✅ FIX: Force-mute kaldırıldı!
        // Eski kodda pub.setMuted(true), track.enabled = false, mediaStreamTrack.enabled = false
        // yapıyorduk. Bu LiveKit'in dahili audio mixing mekanizmasıyla çatışıyordu ve
        // diğer kullanıcıların seslerinin bastırılmasına (ducking) yol açıyordu.
        // LiveKit'in setMicrophoneEnabled() zaten track state'ini yönetiyor.
      } catch (error) {
        console.error("Microphone state sync error:", error);
      } finally {
        syncLockRef.current = false;
      }
    }, 50); // 50ms debounce - hızlı toggle'ları birleştirir

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [isMuted, serverMuted, isDeafened, serverDeafened, localParticipant]);

  // İlk bağlantıda metadata'dan durumu oku
  useEffect(() => {
    if (localParticipant && localParticipant.metadata) {
       try {
         const meta = JSON.parse(localParticipant.metadata);
         if (meta.serverMuted !== undefined) setServerMuted(meta.serverMuted);
         if (meta.serverDeafened !== undefined) setServerDeafened(meta.serverDeafened);
         if (meta.mutedBy) setMutedBy(meta.mutedBy);
         if (meta.deafenedBy) setDeafenedBy(meta.deafenedBy);
         if (meta.mutedAt) setMutedAt(meta.mutedAt);
         if (meta.deafenedAt) setDeafenedAt(meta.deafenedAt);
       } catch (e) {
         console.error("Metadata parse error:", e);
       }
    }
  }, [localParticipant, setServerMuted, setServerDeafened, setMutedBy, setDeafenedBy, setMutedAt, setDeafenedAt]);

  // ✅ FIX: useRef guard to prevent duplicate event listener registration
  const hasRegisteredModerationRef = useRef(false);
  
  useEffect(() => {
    if (!room || !localParticipant) return;
    
    // ✅ CRITICAL FIX: Only register events ONCE per room instance
    if (hasRegisteredModerationRef.current) {
      return;
    }
    
    hasRegisteredModerationRef.current = true;
    console.log("✅ Registering moderation event listener (ONCE)");

    const handleDataReceived = (payload, participant) => {
      // Sadece debugging için log ekleyelim
      if (process.env.NODE_ENV === "development") {
        console.log("📨 Veri alındı:", participant?.identity);
      }
      const str = new TextDecoder().decode(payload);
      try {
        const data = JSON.parse(str);
        if (data.type === "MODERATION_COMMAND") {
          if (process.env.NODE_ENV === "development") {
            console.log("🛠️ Moderasyon komutu:", data.action, "Hedef:", data.targetId, "Sen:", localParticipant.identity);
          }
          // Eğer hedef bensem
           if (data.targetId === localParticipant.identity) {
             if (data.action === "MUTE") {
               const modName = data.moderatorName || "Bir yetkili";
               // ✅ FIX: Batch state updates - syncMicState'in tekrar çalışmasını sağla
               lastDesiredStateRef.current = null;
               setServerMuted(data.value);
               if (data.value) {
                 setMutedBy(modName);
                 setMutedAt(Date.now());
               } else {
                 setMutedBy(null);
                 setMutedAt(null);
               }
               
               // Metadata güncellemesi artık ActiveRoom'un ana useEffect'i tarafından yapılacak

               // Sadece bildirim ve ses
               if (data.value) {
                 playSound("mute");
                 toast.error(`${modName} tarafından susturuldunuz.`, {
                   icon: <MicOff className="text-red-500" size={18} />
                 });
               } else {
                 playSound("unmute");
                 toast.success(`${modName} susturmanızı kaldırdı.`, {
                   icon: <Mic className="text-green-500" size={18} />
                 });
               }
             } else if (data.action === "DEAFEN") {
                const modName = data.moderatorName || "Bir yetkili";
                const newValue = data.value;
                // ✅ FIX: syncMicState'in tekrar çalışmasını sağla
                lastDesiredStateRef.current = null;
                setServerDeafened(newValue);
                if (newValue) {
                  setDeafenedBy(modName);
                  setDeafenedAt(Date.now());
                } else {
                  setDeafenedBy(null);
                  setDeafenedAt(null);
                }

                if (newValue) {
                  playSound("deafen");
                  toast.error(`${modName} tarafından sağırlaştırıldınız.`, {
                    icon: <VolumeX className="text-red-500" size={18} />
                  });
                } else {
                  playSound("undeafen");
                  toast.success(`${modName} sağırlaştırmanızı kaldırdı.`, {
                    icon: <Headphones className="text-green-500" size={18} />
                  });
                }
             }
          }
        }
      } catch (e) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      console.log("🧹 Cleaning up moderation event listener");
      hasRegisteredModerationRef.current = false;
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, localParticipant]); // ✅ Minimal dependencies - callbacks are stable via closure

  return null;
}
