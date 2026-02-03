
import React, { useEffect, useMemo, memo } from "react";
import {
  useParticipantInfo,
  useTracks,
  useIsSpeaking,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Tv, Maximize, VolumeX, MicOff } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAudioLevelStore } from "@/src/store/audioLevelStore";
import ScreenSharePreviewComponent from "./ScreenSharePreview";

const UserCard = ({
  participant,
  totalCount,
  onContextMenu,
  compact,
  hideIncomingVideo,
  setActiveStreamId,
  activeStreamId,
}) => {
  // Extract both identity (for tracking) and name (for display)
  const { identity, name, metadata } = useParticipantInfo({ participant });
  const livekitIsSpeaking = useIsSpeaking(participant);
  
  const displayName = name || identity || "User";
  
  const getInitials = (nameStr) => {
    if (!nameStr) return "?";
    const trimmed = nameStr.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };
  
  const userInitials = getInitials(displayName);
  
  // 🚀 v5.3+: Store Optimizasyonu - Sadece ilgili değerleri dinle
  const localProfileColor = useSettingsStore(s => s.profileColor);
  const cameraMirrorEffect = useSettingsStore(s => s.cameraMirrorEffect);
  const disableAnimations = useSettingsStore(s => s.disableAnimations);
  const graphicsQuality = useSettingsStore(s => s.graphicsQuality);
  const localIsSpeaking = useSettingsStore(s => s.localIsSpeaking);
  const storeIsMuted = useSettingsStore(s => s.isMuted);
  const storeIsDeafened = useSettingsStore(s => s.isDeafened);

  // Screen share track kontrolü
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks.find(
    (t) => t.participant.sid === participant.sid
  );
  const hasScreenShare = !!screenShareTrack;
  const isCurrentlyWatching = activeStreamId === participant.identity;
  
  const shouldDisableAnimations = disableAnimations || graphicsQuality === 'low' || graphicsQuality === 'potato';
  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);

  // Local participant için direkt store'dan, remote için metadata'dan oku
  const isMuted = participant.isLocal ? storeIsMuted : remoteState.isMuted;
  const isDeafened = participant.isLocal ? storeIsDeafened : remoteState.isDeafened;

  const userColor = participant.isLocal
    ? localProfileColor || "#6366f1"
    : remoteState.profileColor || "#6366f1";

  const getBorderColor = (color) => {
    if (!color || !color.includes("gradient")) return color || "#6366f1";
    const match = color.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#6366f1";
  };

  // 🚀 v5.5: Debounced Speaking State - Mikro-dalgalanmaları filtrele
  const [debouncedIsSpeaking, setDebouncedIsSpeaking] = React.useState(false);
  
  // ✅ Merkezi store'dan audio level al (tek global interval)
  const remoteAudioLevel = useAudioLevelStore(s => s.audioLevels[participant.sid] ?? 0);
  
  useEffect(() => {
    // Local: store'dan, Remote: audioLevel > 0.01 VEYA livekitIsSpeaking
    const rawIsSpeaking = participant.isLocal 
      ? localIsSpeaking 
      : (livekitIsSpeaking || remoteAudioLevel > 0.01);
    const isSpeakingNow = rawIsSpeaking && !isMuted && !isDeafened;
    
    if (isSpeakingNow) {
        setDebouncedIsSpeaking(true);
    } else {
        const timer = setTimeout(() => setDebouncedIsSpeaking(false), 50);
        return () => clearTimeout(timer);
    }
  }, [livekitIsSpeaking, localIsSpeaking, remoteAudioLevel, isMuted, isDeafened, participant.isLocal]);

  const isSpeaking = debouncedIsSpeaking;

  const avatarSize = compact
    ? "w-10 h-10 text-base"
    : totalCount <= 2
    ? "w-28 h-28 text-4xl"
    : "w-16 h-16 text-xl";

  const videoTrack = useTracks([Track.Source.Camera]).find(
    (t) => t.participant.sid === participant.sid
  );

  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);

  const shouldShowVideo =
    cameraPublication &&
    !cameraPublication.isMuted &&
    !hideIncomingVideo &&
    cameraPublication.trackSid &&
    (participant.isLocal
      ? true
      : videoTrack?.isSubscribed || !!cameraPublication.track);

  const hasVisibleContent = (shouldShowVideo && videoTrack) || (hasScreenShare && screenShareTrack);

  return (
    <div className="w-full h-full p-1 will-change-transform">
      <div
        onContextMenu={onContextMenu}
        className="relative w-full h-full rounded-xl flex flex-col items-center justify-center group cursor-context-menu overflow-hidden bg-[#141418]/85"
        style={{
          border: isMuted || isDeafened 
              ? '2px solid rgba(239, 68, 68, 0.4)' 
              : '2px solid rgba(255, 255, 255, 0.08)',
          transform: 'translateZ(0)' // Force GPU layer
        }}
      >
        {/* 🚀 CPU Optimized Speaking Indicator Layer */}
        {/* Instead of transitioning box-shadow (expensive), we transition opacity (cheap) */}
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-200 z-20 will-change-opacity"
          style={{
            opacity: isSpeaking ? 1 : 0,
            border: `2px solid ${getBorderColor(userColor)}${shouldDisableAnimations ? '80' : 'cc'}`,
            boxShadow: !shouldDisableAnimations 
              ? `0 0 20px ${getBorderColor(userColor)}40, 0 0 10px ${getBorderColor(userColor)}20`
              : "none",
          }}
        />
        {/* 🔮 Background Glow */}
        <div
          className="absolute inset-0 pointer-events-none will-change-opacity z-0 transition-opacity duration-300"
          style={{
            background: userColor,
            opacity: isSpeaking ? 0.15 : 0,
            animation: (isSpeaking && !shouldDisableAnimations) ? "pulse-glow 3s infinite ease-in-out" : "none"
          }}
        />

        <div className="relative mb-2 w-full h-full flex flex-col items-center justify-center z-10">
          {shouldShowVideo && videoTrack ? (
            <div
              className="relative w-full h-full rounded-xl overflow-hidden z-20 group/camera"
              onClick={(e) => {
                if (!isCurrentlyWatching && setActiveStreamId && participant.identity && (hasScreenShare || shouldShowVideo)) {
                  e.stopPropagation();
                  setActiveStreamId(participant.identity);
                }
              }}
              style={{ cursor: hasVisibleContent && !isCurrentlyWatching ? "pointer" : "default" }}
            >
              <VideoTrack
                trackRef={videoTrack}
                className="w-full h-full object-cover relative z-0"
                style={{ transform: participant.isLocal && cameraMirrorEffect ? 'scaleX(-1)' : undefined }}
              />

              {isSpeaking && (
                <div className="absolute inset-0 rounded-xl border-2 border-white/20 pointer-events-none"></div>
              )}

              {/* Hover over video */}
              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/camera:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer z-50 gap-2"
                  onClick={(e) => { e.stopPropagation(); setActiveStreamId?.(participant.identity); }}
                >
                  <Tv size={32} className="text-white drop-shadow-lg" />
                  <span className="text-xs font-bold text-white drop-shadow-lg uppercase tracking-wide">Yayına Katıl</span>
                </div>
              )}

              {!hasScreenShare && shouldShowVideo && !isCurrentlyWatching && (
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover/camera:opacity-100 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer z-50 gap-2"
                  onClick={(e) => { e.stopPropagation(); setActiveStreamId?.(participant.identity); }}
                >
                  <Maximize size={32} className="text-white drop-shadow-lg scale-90 group-hover/camera:scale-100 transition-transform duration-200" />
                  <span className="text-xs font-bold text-white drop-shadow-lg uppercase tracking-wide">Büyüt</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`${avatarSize} rounded-2xl flex items-center justify-center text-white font-bold z-10 relative group/avatar ${isSpeaking ? "scale-[1.02]" : ""}`}
              style={{ background: userColor, transform: 'translateZ(0)', transition: 'transform 300ms ease-out' }}
            >
              {isSpeaking && !shouldDisableAnimations && (
                <>
                  <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400 z-20 animate-nds-speaking-ring" style={{ '--speaking-color': '#34d399' }} />
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-500/60 z-20" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                </>
              )}
              <span className="relative z-10 drop-shadow-md">{userInitials}</span>

              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer z-50 rounded-2xl"
                  onClick={(e) => { e.stopPropagation(); setActiveStreamId?.(participant.identity); }}
                >
                   <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transform group-hover/avatar:scale-110 transition-transform duration-300">
                      <Tv size={20} className="text-white drop-shadow-md" />
                   </div>
                   <span className="text-[12px] font-semibold text-white/90 tracking-wide drop-shadow-md mt-2">Yayını İzle</span>
                </div>
              )}
            </div>
          )}

          {/* İsim & Durum Badge */}
          <div
            className={`absolute z-40 max-w-[90%] ${
              compact ? "bottom-1 left-1 bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm" : 
              shouldShowVideo ? "bottom-2 left-2 bg-black/60 px-2.5 py-1.5 rounded-lg backdrop-blur-sm" : 
              "bottom-3 left-3 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {(isMuted || isDeafened) && hasVisibleContent && (
                isDeafened ? <VolumeX size={compact ? 10 : 14} className="text-red-500" /> : <MicOff size={compact ? 10 : 14} className="text-red-500" />
              )}
              <span className={`font-semibold text-white tracking-wide truncate drop-shadow-md ${compact ? "text-[10px]" : "text-xs"}`}>
                {displayName}
              </span>
            </div>
          </div>

          {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
            <ScreenSharePreviewComponent trackRef={screenShareTrack} />
          )}

          {hasScreenShare && screenShareTrack && (
            <div className="absolute top-2 left-2 z-40 bg-red-600/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm">CANLI</div>
          )}
        </div>

        {/* 🔇 Mute/Deafen Overlay */}
        {(isMuted || isDeafened) && (
          <div 
            className={`absolute z-30 pointer-events-none rounded-xl overflow-hidden transition-opacity duration-300 ${
              (shouldShowVideo && videoTrack) 
                ? "top-2 right-2 flex flex-col items-end group-hover:opacity-0" 
                : `inset-0 flex items-center justify-center ${hasScreenShare ? "group-hover:opacity-0" : ""}`
            }`}
          >
             {!(shouldShowVideo && videoTrack) && (
                <div className="absolute inset-0 bg-black/50 transition-all duration-300" />
             )}
             
             <div className={`relative flex flex-col items-center ${(shouldShowVideo && videoTrack) ? 'gap-1' : (compact ? 'gap-1.5' : 'gap-3')}`}>
               <div className={`bg-zinc-900 border border-white/10 flex items-center justify-center rounded-full ${(shouldShowVideo && videoTrack) ? 'p-1.5' : (compact ? 'p-2' : 'p-4')}`}>
                  {isDeafened ? (
                    <VolumeX size={(shouldShowVideo && videoTrack) ? 16 : (compact ? 18 : 32)} className="text-red-500" strokeWidth={2.5} />
                  ) : (
                    <MicOff size={(shouldShowVideo && videoTrack) ? 16 : (compact ? 18 : 32)} className="text-red-500" strokeWidth={2.5} />
                  )}
               </div>
               
               {!(shouldShowVideo && videoTrack) && (
                 <div className={`bg-black/60 rounded-xl border border-white/5 flex flex-col items-center justify-center ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
                   <span className={`font-bold text-white/90 tracking-wide uppercase block ${compact ? 'text-[9px]' : 'text-xs'}`}>
                     {remoteState.serverDeafened 
                        ? "SUNUCU SAĞIRLAŞTIRMASI" 
                        : remoteState.serverMuted 
                          ? "SUNUCU SUSTURMASI" 
                          : isDeafened 
                            ? "SAĞIRLAŞTIRDI" 
                            : "SUSTURDU"}
                   </span>
                   {(remoteState.serverDeafened || remoteState.serverMuted) && (remoteState.deafenedBy || remoteState.mutedBy) && (
                     <span className={`font-medium text-red-400 mt-0.5 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                        {remoteState.serverDeafened 
                          ? `Tarafından: ${typeof remoteState.deafenedBy === 'object' ? remoteState.deafenedBy.displayName : remoteState.deafenedBy}` 
                          : `Tarafından: ${typeof remoteState.mutedBy === 'object' ? remoteState.mutedBy.displayName : remoteState.mutedBy}`}
                     </span>
                   )}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(UserCard);
