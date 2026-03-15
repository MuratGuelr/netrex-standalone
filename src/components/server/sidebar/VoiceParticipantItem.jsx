"use client";

import { memo } from "react";
import { MicOff, Headphones } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";

const VoiceParticipantItem = memo(
  function VoiceParticipantItem({ participant }) {
    const displayName =
      participant.displayName || participant.username || "Kullanıcı";

    // profileColor hem avatar arka planı hem border için
    const effectiveColor =
      participant.profileColor || participant.color || null;

    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-default">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar
            size="sm"
            src={participant.photoURL || null}
            name={displayName}
            color={effectiveColor}
            borderColor={effectiveColor}
          />
          {(participant.isMuted || participant.isDeafened) && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-[#111214] rounded-full p-[2px]">
              {participant.isDeafened ? (
                <Headphones size={8} className="text-red-400" />
              ) : (
                <MicOff size={8} className="text-red-400" />
              )}
            </div>
          )}
        </div>

        {/* Username & Status */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs text-[#949ba4] font-medium truncate">
            {displayName}
          </span>
          {participant.quickStatus && (
            <span
              className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-indigo-500/15 text-indigo-400 font-bold text-[8px] uppercase tracking-tighter border border-indigo-500/20"
              title={participant.quickStatus.label}
            >
              <span>{participant.quickStatus.icon}</span>
              <span className="hidden sm:inline truncate max-w-[40px]">
                {participant.quickStatus.label}
              </span>
            </span>
          )}
        </div>

        {/* Speaking Indicator */}
        {!participant.isMuted && !participant.isDeafened && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.participant.userId === next.participant.userId &&
      prev.participant.isMuted === next.participant.isMuted &&
      prev.participant.isDeafened === next.participant.isDeafened &&
      prev.participant.username === next.participant.username &&
      prev.participant.displayName === next.participant.displayName &&
      prev.participant.quickStatus === next.participant.quickStatus &&
      prev.participant.photoURL === next.participant.photoURL &&
      prev.participant.profileColor === next.participant.profileColor &&
      prev.participant.color === next.participant.color
    );
  },
);

export default VoiceParticipantItem;
