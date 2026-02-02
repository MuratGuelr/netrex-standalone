
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

  // Mikrofon ve Hoparlör durumunu hem manuel hem de sunucu kısıtlamalarına göre senkronize et
  useEffect(() => {
    if (localParticipant) {
      // Mikrofon açık olmalı mı? (Manuel mute kapalı VE sunucu susturması kapalı VE sağırlaştırma kapalı)
      const shouldEnableMic = !(isMuted || serverMuted || isDeafened || serverDeafened);
      localParticipant.setMicrophoneEnabled(shouldEnableMic);
    }
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

  useEffect(() => {
    if (!room || !localParticipant) return;

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
    return () => room.off(RoomEvent.DataReceived, handleDataReceived);
  }, [room, localParticipant, setServerMuted, setServerDeafened, isDeafened, setIsDeafened, setIsMuted, playSound, setMutedBy, setDeafenedBy, setMutedAt, setDeafenedAt]);

  return null;
}
