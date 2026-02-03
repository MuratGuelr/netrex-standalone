"use client";

import { memo } from "react";
import { Volume2, Signal, Lock } from "lucide-react";
import VoiceParticipantItem from "./VoiceParticipantItem";

/**
 * 🎤 VoiceChannelItem - OPTIMIZED Voice Channel Card
 * Memoized with participant list
 */
const VoiceChannelItem = memo(function VoiceChannelItem({
  channel,
  isActive,
  participants,
  hasRestrictions,
  onClick,
  onContextMenu
}) {
  return (
    <div className="flex flex-col">
      {/* Voice Channel Card */}
      <div 
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`
          group relative p-3 rounded-2xl cursor-pointer border transition-all duration-300
          ${isActive 
            ? "bg-gradient-to-br from-[#1a1b1e] to-[#111214] border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]" 
            : "bg-[#111214] border-white/5 hover:border-white/10 hover:bg-[#16171a]"
          }
        `}
      >
        {/* Channel Info Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`
              p-1.5 rounded-lg transition-colors
              ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'}
            `}>
              {isActive ? <Signal size={14} /> : <Volume2 size={14} />}
            </div>
            <span className={`truncate font-semibold text-sm ${isActive ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`}>
              {channel.name}
            </span>
          </div>
          {hasRestrictions && <Lock size={12} className="text-[#5c5e66]" />}
        </div>

        {/* Participants Count Badge */}
        <div className="flex items-center justify-between">
          {participants.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-cyan-400 font-semibold">{participants.length} kişi bağlı</span>
            </div>
          ) : (
            <span className="text-[10px] text-[#5c5e66] italic group-hover:text-[#80848e] transition-colors">
              Boş oda
            </span>
          )}
          
          {/* Active Dot if connected */}
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />}
        </div>
      </div>
      
      {/* Participants List (Under Channel Card) */}
      {participants.length > 0 && (
        <div className="mt-1 ml-3 space-y-0.5">
          {participants.map((participant) => (
            <VoiceParticipantItem 
              key={participant.userId} 
              participant={participant} 
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.channel.id === nextProps.channel.id &&
    prevProps.channel.name === nextProps.channel.name &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.hasRestrictions === nextProps.hasRestrictions &&
    prevProps.participants.length === nextProps.participants.length &&
    JSON.stringify(prevProps.participants) === JSON.stringify(nextProps.participants)
  );
});

export default VoiceChannelItem;
