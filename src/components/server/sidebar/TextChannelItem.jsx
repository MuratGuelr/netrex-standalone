"use client";

import { memo } from "react";
import { MessageSquare, Lock, Volume2, VolumeX } from "lucide-react";

/**
 * 💬 TextChannelItem - OPTIMIZED Text Channel Item
 * Memoized to prevent re-renders when channel data doesn't change
 */
const TextChannelItem = memo(function TextChannelItem({
  channel,
  isActive,
  hasUnread,
  hasRestrictions,
  ttsEnabled,
  isTtsMuted,
  onToggleTtsMute,
  onClick,
  onContextMenu
}) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200
        ${isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}
      `}
    >
      {/* Active Pill Indicator */}
      {isActive && <div className="absolute left-0 h-6 w-1 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />}

      <MessageSquare 
        size={18} 
        className={`${isActive ? "text-purple-400" : "text-[#5c5e66] group-hover:text-[#949ba4]"} transition-colors`} 
      />
      
      <span className={`flex-1 truncate text-sm font-medium ${isActive ? "text-white" : "text-[#949ba4] group-hover:text-[#dbdee1]"}`}>
        {channel.name}
      </span>

      <div className="flex items-center gap-2">
        {ttsEnabled && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onToggleTtsMute(channel.id);
            }}
            className="flex items-center justify-center -mr-1 z-10 p-1 rounded-md hover:bg-white/5"
          >
            {isTtsMuted ? (
              <VolumeX size={14} className="text-red-400 hover:text-red-300 transition-colors" />
            ) : (
              <Volume2 size={14} className="text-[#5c5e66]/0 group-hover:text-[#5c5e66] transition-colors hover:!text-green-400" />
            )}
          </div>
        )}
        {hasUnread && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_currentColor]" />}
        {hasRestrictions && <Lock size={12} className="text-[#5c5e66]" />}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.channel.id === nextProps.channel.id &&
    prevProps.channel.name === nextProps.channel.name &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.hasUnread === nextProps.hasUnread &&
    prevProps.hasRestrictions === nextProps.hasRestrictions &&
    prevProps.ttsEnabled === nextProps.ttsEnabled &&
    prevProps.isTtsMuted === nextProps.isTtsMuted &&
    prevProps.onToggleTtsMute === nextProps.onToggleTtsMute // Bu değiştiyse re-render et!
  );
});

export default TextChannelItem;
