import { useEffect, useRef, useState, useMemo } from "react";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useServerStore } from "@/src/store/serverStore";
import VolumeSlider from "@/src/components/VolumeSlider";
import ModerationPanel from "@/src/components/ModerationPanel";
import QuickStatusManager from "@/src/components/settings/QuickStatusManager";

/**
 * ✅ ULTRA-OPTIMIZED UserContextMenu v3.1
 * 
 * Component structure:
 * - VolumeSlider: Isolated (volume slider hareket ettiğinde sadece o re-render)
 * - ModerationPanel: Isolated (status değiştiğinde sadece o re-render)
 * - QuickStatusManager: Local user status management
 * - Main: Minimal state (sadece positioning)
 */
export default function UserContextMenu({
  x,
  y,
  participant,
  onClose,
  isLocal,
  roomName,
}) {
  const menuRef = useRef(null);
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { currentServer } = useServerStore();

  const canMute = useServerPermission("MUTE_MEMBERS");
  const canDeafen = useServerPermission("DEAFEN_MEMBERS");

  // ✅ Cached metadata parse
  const targetMetadata = useMemo(() => {
    try {
      return participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch {
      return {};
    }
  }, [participant.metadata]);

  // ✅ Cached status flags
  const statusFlags = useMemo(() => ({
    isTargetSelfMuted: targetMetadata.isMuted || false,
    isTargetSelfDeafened: targetMetadata.isDeafened || false,
    isTargetServerMuted: targetMetadata.serverMuted || false,
    isTargetServerDeafened: targetMetadata.serverDeafened || false,
    mutedBy: targetMetadata.mutedBy || null,
    deafenedBy: targetMetadata.deafenedBy || null,
  }), [targetMetadata]);

  const [coords, setCoords] = useState({ top: y, left: x });
  const [isPositioned, setIsPositioned] = useState(false);

  // ✅ Akıllı pozisyonlama - gerçek menü boyutunu ÖLÇ, sonra konumla
  useEffect(() => {
    setIsPositioned(false);
    
    // RAF ile DOM ölçümü yap (menü render edildikten sonra)
    const raf = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;

      const rect = menu.getBoundingClientRect();
      const mWidth = rect.width || 288;
      const mHeight = rect.height || 400;
      
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const PADDING = 8; // Ekran kenarından minimum boşluk

      let newLeft = x;
      let newTop = y;

      // Sağ kenardan taşıyorsa sola kaydır
      if (newLeft + mWidth > viewW - PADDING) {
        newLeft = x - mWidth;
      }
      
      // Sol kenardan taşıyorsa sağa çek
      if (newLeft < PADDING) {
        newLeft = PADDING;
      }

      // Alt kenardan taşıyorsa yukarı kaydır
      if (newTop + mHeight > viewH - PADDING) {
        newTop = viewH - mHeight - PADDING;
      }
      
      // Üst kenardan taşıyorsa aşağı çek
      if (newTop < PADDING) {
        newTop = PADDING;
      }

      setCoords({ top: newTop, left: newLeft });
      setIsPositioned(true);
    });

    return () => cancelAnimationFrame(raf);
  }, [x, y]);

  // Outside click + ESC handler
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 bg-[#0d0e10] border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] p-3 flex flex-col gap-2 select-none overflow-y-auto custom-scrollbar"
      style={{ 
        top: coords.top, 
        left: coords.left,
        maxHeight: 'calc(100vh - 16px)',
        opacity: isPositioned ? 1 : 0,
        transform: isPositioned ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        transformOrigin: 'top left',
      }}
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

      {/* Content */}
      <div className="px-1 py-1">
        {!isLocal ? (
          <div className="space-y-4 py-2">
            {/* ✅ Isolated VolumeSlider */}
            <VolumeSlider participantIdentity={participant.identity} />

            {/* ✅ Isolated ModerationPanel */}
            {(canMute || canDeafen) && (
              <ModerationPanel
                participant={participant}
                localParticipant={localParticipant}
                statusFlags={statusFlags}
                currentServerId={currentServer?.id}
                canMute={canMute}
                canDeafen={canDeafen}
              />
            )}
          </div>
        ) : (
          <QuickStatusManager />
        )}
      </div>
    </div>
  );
}
