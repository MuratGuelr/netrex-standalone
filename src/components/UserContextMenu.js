import { useEffect, useRef, useState } from "react";
import { Volume2, Volume1, VolumeX, MicOff, Mic, Headphones, ShieldAlert } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useServerStore } from "@/src/store/serverStore";

export default function UserContextMenu({
  x,
  y,
  participant,
  onClose,
  isLocal,
  roomName,
}) {
  const menuRef = useRef(null);
  const { userVolumes, setUserVolume } = useSettingsStore();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { currentServer } = useServerStore();

  const canMute = useServerPermission("MUTE_MEMBERS");
  const canDeafen = useServerPermission("DEAFEN_MEMBERS");

  const currentVol = (userVolumes && userVolumes[participant.identity]) ?? 100;
  // Clamp to 200 max if stored value is higher
  const [volume, setVolume] = useState(Math.min(currentVol, 200));

  const targetMetadata = useMemo(() => {
    try {
      return participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch {
      return {};
    }
  }, [participant.metadata]);

  // Hedef kullanıcının durumları
  const isTargetSelfMuted = targetMetadata.isMuted || false; // Kullanıcı kendini muteladı
  const isTargetSelfDeafened = targetMetadata.isDeafened || false; // Kullanıcı kendini sağırlaştırdı
  const isTargetServerMuted = targetMetadata.serverMuted || false; // Sunucu tarafından mutelandi
  const isTargetServerDeafened = targetMetadata.serverDeafened || false; // Sunucu tarafından sağırlaştırıldı
  
  // Moderatör butonu gösterme mantığı:
  // - Eğer kullanıcı kendini muteladıysa VE server mute değilse -> moderatör sadece "Sustur" gösterebilir (yani ekstra susturma ekleyebilir)
  // - Eğer server tarafından muteliyse -> "Sesi Aç" göster
  // - Eğer kullanıcı kendini açmışsa VE server mute değilse -> "Sustur" göster
  const canShowUnmute = isTargetServerMuted; // Sadece server mute varsa açılabilir
  const canShowMute = !isTargetServerMuted; // Server mute yoksa susturulabilir
  
  const canShowUndeafen = isTargetServerDeafened; // Sadece server deafen varsa açılabilir  
  const canShowDeafen = !isTargetServerDeafened; // Server deafen yoksa sağırlaştırılabilir
  
  const [coords, setCoords] = useState({ top: y, left: x });

  useEffect(() => {
    let newLeft = x;
    let newTop = y;

    if (x + 260 > window.innerWidth) {
      newLeft = x - 260;
    }

    if (y + 150 > window.innerHeight) {
      newTop = y - 150;
    }

    setCoords({ top: newTop, left: newLeft });
  }, [x, y]);

  // Dışarı tıklayınca kapatma mantığı
  useEffect(() => {
    const handleClick = (e) => {
      // Eğer tıklanan yer menünün içindeyse (contains) kapatma
      // Ama asıl korumayı aşağıda onMouseDown içinde yapıyoruz.
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    // 'mousedown' kullanıyoruz çünkü 'click' bazen sürükleme işlemlerinde geç tetiklenir
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value);
    setVolume(newVol);
    setUserVolume(participant.identity, newVol);
  };

  const getIcon = () => {
    if (volume === 0) return <VolumeX size={18} className="text-red-400" />;
    if (volume < 50) return <Volume1 size={18} className="text-indigo-400" />;
    if (volume > 100) return <Volume2 size={18} className="text-yellow-400" />;
    return <Volume2 size={18} className="text-indigo-400" />;
  };

  // Calculate percentage for display (0-200 range)
  const displayPercent = Math.min((volume / 200) * 100, 100);

  // Firebase update helper
  const updateFirebaseStatus = async (type, value) => {
    if (!currentServer?.id || !participant.identity) return;

    try {
      const memberRef = doc(db, "servers", currentServer.id, "members", participant.identity);
      const updates = {};
      
      const moderatorInfo = {
        uid: localParticipant.identity,
        displayName: localParticipant.name || localParticipant.identity
      };

      if (type === "MUTE") {
        updates.isMutedByServer = value;
        if (value) {
          updates.mutedBy = moderatorInfo;
          updates.mutedAt = serverTimestamp();
        } else {
           updates.mutedBy = null;
           updates.mutedAt = null;
        }
      } else if (type === "DEAFEN") {
        updates.isDeafenedByServer = value;
        if (value) {
          updates.deafenedBy = moderatorInfo;
          updates.deafenedAt = serverTimestamp();
        } else {
          updates.deafenedBy = null;
          updates.deafenedAt = null;
        }
      }

      await updateDoc(memberRef, updates);
    } catch (error) {
      console.error("Firebase update failed:", error);
      toast.error("Veritabanı güncellenemedi.");
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 bg-[#0d0e10]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] p-3 flex flex-col gap-2 select-none animate-scaleIn origin-top-left"
      style={{ top: coords.top, left: coords.left }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - User Info */}
      <div className="flex items-center gap-3 px-2 pb-3 border-b border-white/[0.06]">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-md opacity-40"></div>
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-white/10">
            {(participant.name || participant.identity)?.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white truncate block">
            {participant.name || participant.identity}
          </span>
          <span className="text-[10px] text-[#5c5e66]">Kullanıcı</span>
        </div>
      </div>

      {/* Ses Slider */}
      {!isLocal ? (
        <div className="px-1 py-2 space-y-4">
          {/* Volume Control */}
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
                Kullanıcı Sesi
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                volume === 0 ? "text-red-400 bg-red-500/10" :
                volume > 100 ? "text-yellow-400 bg-yellow-500/10" :
                "text-indigo-400 bg-indigo-500/10"
              }`}>
                {volume}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="shrink-0 opacity-60">
                {getIcon()}
              </div>
              <div className="relative flex-1 h-6 flex items-center w-full group">
                {/* Track Background */}
                <div className="absolute w-full h-1.5 bg-[#1a1b1e] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 rounded-full ${
                      volume === 0 ? "bg-red-500/60" :
                      volume > 100 ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-yellow-500" :
                      "bg-gradient-to-r from-indigo-500 to-purple-500"
                    }`}
                    style={{ width: `${displayPercent}%` }}
                  ></div>
                </div>

                {/* Input */}
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={volume}
                  onChange={handleVolumeChange}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full absolute z-20 opacity-0 cursor-pointer h-full m-0 p-0"
                  title="Ses Seviyesi (0-200%)"
                />

                {/* Thumb */}
                <div
                  className={`absolute h-3.5 w-3.5 rounded-full shadow-lg pointer-events-none z-10 transition-all ${
                    volume === 0 ? "bg-red-400 ring-2 ring-red-500/50" :
                    volume > 100 ? "bg-yellow-400 ring-2 ring-yellow-500/50" :
                    "bg-white ring-2 ring-indigo-500/50"
                  }`}
                  style={{ left: `${displayPercent}%`, transform: "translateX(-50%)" }}
                ></div>
              </div>
            </div>
            
            {volume > 100 && (
              <div className="mt-2 text-[10px] text-yellow-400/70 text-center flex items-center justify-center gap-1">
                <span>⚠️</span>
                <span>100%'den yüksek ses seviyesi</span>
              </div>
            )}
          </div>

          {/* Moderasyon Bölümü */}
          {(canMute || canDeafen) && (
            <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04] space-y-2.5">
              {/* Section Header */}
              <div className="flex items-center gap-2">
                <ShieldAlert size={12} className="text-amber-500" />
                <span className="text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
                  Moderasyon
                </span>
              </div>

              {/* Self-mute/deafen bilgi mesajı */}
              {(isTargetSelfMuted || isTargetSelfDeafened) && (
                <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                  ⚠️ Kullanıcı kendini {isTargetSelfMuted && isTargetSelfDeafened ? 'susturdu ve sağırlaştırdı' : isTargetSelfMuted ? 'susturdu' : 'sağırlaştırdı'}.
                </div>
              )}

              {/* Toggle Rows */}
              <div className="space-y-1">
                {/* Server Mute Toggle */}
                {canMute && (
                  <div 
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newValue = !isTargetServerMuted;
                      const payload = JSON.stringify({
                        type: "MODERATION_COMMAND",
                        targetId: participant.identity,
                        moderatorName: localParticipant.name || localParticipant.identity,
                        action: "MUTE",
                        value: newValue
                      });
                      if (localParticipant) {
                        localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
                        updateFirebaseStatus("MUTE", newValue);
                        toast.success(newValue 
                          ? `${participant.name || participant.identity} susturuldu` 
                          : `${participant.name || participant.identity} susturması kaldırıldı`
                        );
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        isTargetServerMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'
                      }`}>
                        <MicOff size={13} />
                      </div>
                      <span className={`text-[13px] font-medium transition-colors ${
                        isTargetServerMuted ? 'text-red-400' : 'text-[#b5bac1] group-hover:text-white'
                      }`}>
                        Sunucu Susturması
                      </span>
                    </div>
                    
                    {/* Toggle Switch */}
                    <div className={`w-9 h-5 rounded-full transition-all duration-200 relative ${
                      isTargetServerMuted 
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                        : 'bg-[#2b2d31]'
                    }`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                        isTargetServerMuted ? 'left-[18px]' : 'left-0.5'
                      }`} />
                    </div>
                  </div>
                )}

                {/* Server Deafen Toggle */}
                {canDeafen && (
                  <div 
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newValue = !isTargetServerDeafened;
                      const payload = JSON.stringify({
                        type: "MODERATION_COMMAND",
                        targetId: participant.identity,
                        moderatorName: localParticipant.name || localParticipant.identity,
                        action: "DEAFEN",
                        value: newValue
                      });
                      if (localParticipant) {
                        localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
                        updateFirebaseStatus("DEAFEN", newValue);
                        toast.success(newValue 
                          ? `${participant.name || participant.identity} sağırlaştırıldı` 
                          : `${participant.name || participant.identity} sağırlaştırması kaldırıldı`
                        );
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        isTargetServerDeafened ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'
                      }`}>
                        <Headphones size={13} />
                      </div>
                      <span className={`text-[13px] font-medium transition-colors ${
                        isTargetServerDeafened ? 'text-orange-400' : 'text-[#b5bac1] group-hover:text-white'
                      }`}>
                        Sunucu Sağırlaştırması
                      </span>
                    </div>
                    
                    {/* Toggle Switch */}
                    <div className={`w-9 h-5 rounded-full transition-all duration-200 relative ${
                      isTargetServerDeafened 
                        ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' 
                        : 'bg-[#2b2d31]'
                    }`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                        isTargetServerDeafened ? 'left-[18px]' : 'left-0.5'
                      }`} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-2 py-3 text-xs text-[#5c5e66] italic text-center bg-white/[0.02] border border-white/[0.04] rounded-xl">
          Kendi sesini buradan ayarlayamazsın.
        </div>
      )}
    </div>
  );
}
