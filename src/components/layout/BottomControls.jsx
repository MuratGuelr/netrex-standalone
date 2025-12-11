"use client";

/**
 * 🎛️ BottomControls - Voice/Video Controls Bar
 * NDS v2.0 - Netrex Design System
 * 
 * The bottom control bar for active rooms:
 * - Microphone toggle
 * - Deafen toggle
 * - Camera toggle
 * - Screen share toggle
 * - Leave call button
 */

import { 
  Mic, 
  MicOff, 
  Headphones, 
  VolumeX, 
  Video, 
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  MoreVertical
} from "lucide-react";

export default function BottomControls({ 
  isMuted = false,
  isDeafened = false,
  isCameraOn = false,
  isScreenSharing = false,
  onMuteToggle,
  onDeafenToggle,
  onCameraToggle,
  onScreenShareToggle,
  onLeave,
  showCamera = true,
  showScreenShare = true,
  className = "" 
}) {
  return (
    <div className={`
      bottom-controls
      h-full w-full
      flex items-center justify-center
      gap-2
      ${className}
    `}>
      {/* Main Controls Group */}
      <div className="
        flex items-center
        gap-1
        glass-card
        rounded-2xl
        px-2 py-2
      ">
        {/* Microphone */}
        <ControlButton
          icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          active={!isMuted}
          danger={isMuted}
          onClick={onMuteToggle}
          tooltip={isMuted ? "Sesi Aç (M)" : "Sustur (M)"}
        />

        {/* Deafen */}
        <ControlButton
          icon={isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
          active={!isDeafened}
          danger={isDeafened}
          onClick={onDeafenToggle}
          tooltip={isDeafened ? "Sağırlaştırmayı Kapat" : "Sağırlaştır"}
        />

        {/* Divider */}
        <div className="w-px h-6 bg-nds-border-light mx-1" />

        {/* Camera */}
        {showCamera && (
          <ControlButton
            icon={isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            active={isCameraOn}
            onClick={onCameraToggle}
            tooltip={isCameraOn ? "Kamerayı Kapat" : "Kamerayı Aç"}
          />
        )}

        {/* Screen Share */}
        {showScreenShare && (
          <ControlButton
            icon={isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
            active={isScreenSharing}
            highlight={isScreenSharing}
            onClick={onScreenShareToggle}
            tooltip={isScreenSharing ? "Ekran Paylaşımını Durdur" : "Ekran Paylaş"}
          />
        )}
      </div>

      {/* Leave Button */}
      <button
        onClick={onLeave}
        className="
          h-12 px-5
          rounded-2xl
          flex items-center gap-2
          bg-nds-danger
          text-white
          font-semibold
          hover:bg-nds-danger-hover
          hover:shadow-glow-red
          hover:scale-105
          active:scale-95
          transition-all duration-normal
        "
      >
        <PhoneOff size={18} />
        <span className="text-small">Ayrıl</span>
      </button>
    </div>
  );
}

/**
 * 🔘 ControlButton - Individual control button
 */
function ControlButton({
  icon,
  active = false,
  danger = false,
  highlight = false,
  onClick,
  tooltip,
  className = ""
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        control-button
        w-12 h-12
        rounded-xl
        flex items-center justify-center
        transition-all duration-normal
        relative
        group
        
        ${danger
          ? 'bg-nds-danger/20 text-nds-danger hover:bg-nds-danger/30'
          : highlight
            ? 'bg-nds-accent-primary/20 text-nds-accent-primary hover:bg-nds-accent-primary/30 shadow-nds-glow'
            : active
              ? 'bg-white/10 text-nds-text-primary hover:bg-white/15'
              : 'bg-white/5 text-nds-text-tertiary hover:bg-white/10 hover:text-nds-text-primary'
        }
        
        hover:scale-105
        active:scale-95
        
        ${className}
      `}
    >
      {icon}

      {/* Tooltip */}
      <span className="
        absolute -top-10
        px-2 py-1
        rounded-lg
        bg-nds-bg-elevated
        text-nds-text-primary
        text-caption
        font-medium
        whitespace-nowrap
        opacity-0 group-hover:opacity-100
        pointer-events-none
        transition-opacity duration-fast
        shadow-nds-elevated
        border border-nds-border-subtle
      ">
        {tooltip}
      </span>
    </button>
  );
}

// Export ControlButton for reuse
BottomControls.Button = ControlButton;
