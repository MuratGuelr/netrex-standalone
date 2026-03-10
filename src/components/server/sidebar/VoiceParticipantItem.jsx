"use client";

import { memo } from "react";
import { MicOff, Headphones } from "lucide-react";

/**
 * 👤 VoiceParticipantItem - OPTIMIZED Voice Participant
 * Memoized to prevent re-renders
 */
const VoiceParticipantItem = memo(function VoiceParticipantItem({ participant }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-default">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-[#2b2d31] flex items-center justify-center overflow-hidden ring-1 ring-white/10">
          {participant.photoURL ? (
            <img 
              src={participant.photoURL} 
              alt={participant.username} 
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[9px] text-white font-bold">
              {participant.username?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {/* Mic/Deaf Indicators */}
        {(participant.isMuted || participant.isDeafened) && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-[#111214] rounded-full p-[2px]">
            {participant.isDeafened ? (
              <Headphones size={8} className="text-red-400"/>
            ) : (
              <MicOff size={8} className="text-red-400"/>
            )}
          </div>
        )}
      </div>
      
      {/* Username & Status */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-xs text-[#949ba4] font-medium truncate">
          {participant.username || "Kullanıcı"}
        </span>
        {participant.quickStatus && (
          <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-indigo-500/15 text-indigo-400 font-bold text-[8px] uppercase tracking-tighter border border-indigo-500/20" title={participant.quickStatus.label}>
            <span>{participant.quickStatus.icon}</span>
            <span className="hidden sm:inline truncate max-w-[40px]">{participant.quickStatus.label}</span>
          </span>
        )}
      </div>
      
      {/* Speaking Indicator */}
      {!participant.isMuted && !participant.isDeafened && (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.participant.userId === nextProps.participant.userId &&
    prevProps.participant.isMuted === nextProps.participant.isMuted &&
    prevProps.participant.isDeafened === nextProps.participant.isDeafened &&
    prevProps.participant.username === nextProps.participant.username &&
    prevProps.participant.quickStatus === nextProps.participant.quickStatus &&
    prevProps.participant.photoURL === nextProps.participant.photoURL
  );
});

export default VoiceParticipantItem;
