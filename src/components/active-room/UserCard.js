import React, { useEffect, useMemo } from "react";
import {
  useParticipantInfo,
  useTracks,
  useIsSpeaking,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Tv, Maximize, VolumeX, MicOff } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import ScreenSharePreviewComponent from "./ScreenSharePreview";

const UserCard = React.memo(({
  participant,
  totalCount,
  onContextMenu,
  compact,
  hideIncomingVideo,
  setActiveStreamId,
  activeStreamId,
}) => {
  // Extract both identity (for tracking) and name (for display)
  // identity = persistent unique ID (e.g., "userId_deviceShort")
  // name = user-friendly display name (e.g., "sk jsksos")
  const { identity, name, metadata } = useParticipantInfo({ participant });
  const livekitIsSpeaking = useIsSpeaking(participant);
  
  // Use name for display, fallback to identity if name is not set
  // For anonymous users, this ensures we have something to display
  const displayName = name || identity || "User";
  
  // Get initials from name (same logic as Avatar.jsx component)
  const getInitials = (nameStr) => {
    if (!nameStr) return "?";
    const trimmed = nameStr.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(" ");
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    // For multiple words, take first letter of first and last word
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };
  
  const userInitials = getInitials(displayName);
  
  // 🚀 v5.3: Speaking indicator - SIFIR EK CPU MALİYETİ
  // Local: Store'dan al (useVoiceProcessor zaten VAD yapıyor)
  // Remote: LiveKit native isSpeaking kullan
  // 🚀 v5.3: Rasyonel Optimizasyon - Sadece ilgili değerleri dinle (Selector mantığı)
  const localProfileColor = useSettingsStore(s => s.profileColor);
  const disableAnimations = useSettingsStore(s => s.disableAnimations);
  const graphicsQuality = useSettingsStore(s => s.graphicsQuality);
  const localIsSpeaking = useSettingsStore(s => s.localIsSpeaking);

  // Screen share track kontrolü
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks.find(
    (t) => t.participant.sid === participant.sid
  );
  const hasScreenShare = !!screenShareTrack;
  const isCurrentlyWatching = activeStreamId === participant.identity;
  
  // Performans modu: low veya potato ise animasyonları devre dışı bırak
  const shouldDisableAnimations = disableAnimations || graphicsQuality === 'low' || graphicsQuality === 'potato';
  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);

  // 🚀 v5.3: Rasyonel Optimizasyon - Sadece ilgili değerleri dinle (Selector mantığı)
  const storeIsMuted = useSettingsStore(s => s.isMuted);
  const storeIsDeafened = useSettingsStore(s => s.isDeafened);
  
  // Local participant için direkt store'dan, remote için metadata'dan oku
  // Bu sayede "SJ" kartındaki simge saniyesinde değişir, senkron kaybı yaşanmaz.
  const isMuted = participant.isLocal ? storeIsMuted : remoteState.isMuted;
  const isDeafened = participant.isLocal ? storeIsDeafened : remoteState.isDeafened;

  // Local participant ise settings'den, değilse metadata'dan renk al
  const userColor = participant.isLocal
    ? localProfileColor || "#6366f1"
    : remoteState.profileColor || "#6366f1";

  // Gradient için border rengi çıkar (gradient'in ilk rengini kullan)
  const getBorderColor = (color) => {
    if (!color || !color.includes("gradient")) return color || "#6366f1";
    // Gradient'ten ilk rengi çıkar: linear-gradient(135deg, #6366f1 0%, ...)
    const match = color.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#6366f1";
  };

  // 🚀 v5.5: Debounced Speaking State - Mikro-dalgalanmaları filtrele
  const [debouncedIsSpeaking, setDebouncedIsSpeaking] = React.useState(false);
  
  useEffect(() => {
    const rawIsSpeaking = participant.isLocal ? localIsSpeaking : livekitIsSpeaking;
    const isSpeakingNow = rawIsSpeaking && !isMuted && !isDeafened;
    
    if (isSpeakingNow) {
        setDebouncedIsSpeaking(true);
    } else {
        // Sustuğunda 150ms bekle, böylece 'stutter' (kekeleme) etkisi olmaz
        const timer = setTimeout(() => setDebouncedIsSpeaking(false), 150);
        return () => clearTimeout(timer);
    }
  }, [livekitIsSpeaking, localIsSpeaking, isMuted, isDeafened, participant.isLocal]);

  const isSpeaking = debouncedIsSpeaking;
  const avatarSize = compact
    ? "w-10 h-10 text-base"
    : totalCount <= 2
    ? "w-28 h-28 text-4xl"
    : "w-16 h-16 text-xl";

  // Mikrofon ikonu boyutunu avatar boyutuna göre ayarla
  const micIconSize = compact ? 12 : totalCount <= 2 ? 20 : 14;
  const micBadgeSize = compact
    ? "w-5 h-5"
    : totalCount <= 2
    ? "w-8 h-8"
    : "w-6 h-6";
  const micBorderSize = compact
    ? "border-[2px]"
    : totalCount <= 2
    ? "border-[3px]"
    : "border-[2px]";

  // useTracks hook'u sadece subscribe edilmiş track'leri döndürür
  // Remote participant tarafında track henüz subscribe edilmemişse bulunamaz
  // Bu yüzden direkt olarak participant'ın publication'ını kontrol ediyoruz
  const videoTrack = useTracks([Track.Source.Camera]).find(
    (t) => t.participant.sid === participant.sid
  );

  // Participant'ın publication'ını direkt kontrol et (useTracks'ten bağımsız)
  const cameraPublication = participant.getTrackPublication(
    Track.Source.Camera
  );

  // Debug: Track durumunu kontrol et (Sadece DEV ve throttled)
  useEffect(() => {
    // 🚀 v5.3: Production'da debug log yok
    if (process.env.NODE_ENV !== "development" || !cameraPublication) return;
    
    // Throttle: Max 2 saniyede bir log
    const logTimeout = setTimeout(() => {
      console.log(
        `📹 ${
          participant.isLocal ? "Local" : "Remote"
        } participant camera track durumu:`,
        {
          participant: participant.identity,
          trackSid: cameraPublication.trackSid,
          isMuted: cameraPublication.isMuted,
          hasTrack: !!cameraPublication.track,
          useTracksFound: !!videoTrack,
          isSubscribed: videoTrack?.isSubscribed,
        }
      );
    }, 2000);
    
    return () => clearTimeout(logTimeout);
  }, [cameraPublication, participant, videoTrack]);

  // Track görünürlük kontrolü
  // Local participant için: publication varsa ve muted değilse göster
  // Remote participant için: publication varsa, muted değilse ve (useTracks track'i buldu VEYA publication'da track var) göster
  const shouldShowVideo =
    cameraPublication &&
    !cameraPublication.isMuted &&
    !hideIncomingVideo &&
    cameraPublication.trackSid && // Track publish edilmiş olmalı
    (participant.isLocal
      ? true // Local participant için trackSid varsa göster
      : videoTrack?.isSubscribed || !!cameraPublication.track); // Remote için subscribed VEYA publication'da track mevcut olmalı

  // 🎨 v5.2: Konuşurken gradient border için wrapper

  return (
    <div
      className="w-full h-full p-1 will-change-transform"
    >
      <div
        onContextMenu={onContextMenu}
        className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center group cursor-context-menu overflow-hidden transition-all duration-200 will-change-[border-color,box-shadow,background-color]`}
        style={{
          background: "rgba(20, 20, 24, 0.85)",
          border: isSpeaking 
            ? shouldDisableAnimations ? `2px solid ${getBorderColor(userColor)}60` : `2px solid ${userColor}80`
            : isMuted || isDeafened 
              ? '2px solid rgba(239, 68, 68, 0.4)' 
              : '2px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isSpeaking ? `0 0 15px ${getBorderColor(userColor)}20` : "none",
        }}
      >
        {/* 🔮 Background Glow - Visual Smoothing - Snappier Transition */}
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
                if (
                  !isCurrentlyWatching &&
                  setActiveStreamId &&
                  participant.identity &&
                  ((hasScreenShare && screenShareTrack) || (shouldShowVideo && videoTrack))
                ) {
                  e.stopPropagation();
                  setActiveStreamId(participant.identity);
                }
              }}
              style={{
                cursor:
                  (hasScreenShare && screenShareTrack && !isCurrentlyWatching) ||
                  (shouldShowVideo && videoTrack && !isCurrentlyWatching)
                    ? "pointer"
                    : "default",
              }}
            >
              <VideoTrack
                trackRef={videoTrack}
                className="w-full h-full object-cover relative z-0"
              />

              {/* Speaking Indicator for Video - Simple Border Overlay */}
              {isSpeaking && (
                <div className="absolute inset-0 rounded-xl border-2 border-white/20 pointer-events-none"></div>
              )}

              {/* Hover overlay - Yayına Katıl (Video View) */}
              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/camera:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer z-50 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStreamId?.(participant.identity);
                  }}
                >
                  <Tv size={32} className="text-white drop-shadow-lg" />
                  <span className="text-xs font-bold text-white drop-shadow-lg uppercase tracking-wide">Yayına Katıl</span>
                </div>
              )}

              {/* Hover overlay - Kamerayı Büyüt */}
              {!hasScreenShare && shouldShowVideo && videoTrack && !isCurrentlyWatching && (
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover/camera:opacity-100 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer z-50 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStreamId?.(participant.identity);
                  }}
                >
                  <Maximize size={32} className="text-white drop-shadow-lg scale-90 group-hover/camera:scale-100 transition-transform duration-200" />
                  <span className="text-xs font-bold text-white drop-shadow-lg uppercase tracking-wide">Büyüt</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`${avatarSize} rounded-2xl flex items-center justify-center text-white font-bold z-10 relative transition-transform duration-300 group/avatar ${
                isSpeaking ? "scale-[1.02]" : ""
              }`}
              style={{
                background: userColor,
                transform: 'translateZ(0)', // Force GPU
              }}
            >
              {/* 🚀 v5.5: GPU Optimized Speaking Rings */}
              {isSpeaking && !shouldDisableAnimations && (
                <>
                   <div className="absolute inset-0 rounded-2xl ring-4 ring-emerald-500/40 animate-pulse border-2 border-emerald-400/50 z-20" />
                   <div className="absolute inset-0 rounded-2xl animate-speaking-ring border-2 border-emerald-500/30 -z-10" />
                </>
              )}
              {/* Letter */}
              <span className="relative z-10 drop-shadow-md">
                {userInitials}
              </span>

              {/* Hover overlay - Katıl (Avatar View) */}
              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer z-50 rounded-2xl gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStreamId?.(participant.identity);
                  }}
                >
                  <Tv size={32} className="text-white drop-shadow-lg" />
                  <span className="text-xs font-bold text-white drop-shadow-lg uppercase tracking-wide">Yayına Katıl</span>
                </div>
              )}
            </div>
          )}

          {/* İsim & Durum Badge */}
          <div
            className={`absolute z-40 max-w-[90%] ${
              compact 
                ? "bottom-1 left-1 bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm shadow-sm"
                : shouldShowVideo
                  ? "bottom-2 left-2 bg-black/60 px-2.5 py-1.5 rounded-lg backdrop-blur-sm"
                  : "bottom-3 left-3 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-white tracking-wide truncate drop-shadow-md ${compact ? "text-[10px]" : "text-xs"}`}>
                {displayName}
              </span>
            </div>
          </div>

          {/* Screen Share Preview */}
          {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
            <ScreenSharePreviewComponent trackRef={screenShareTrack} />
          )}

          {/* Live Badge */}
          {hasScreenShare && screenShareTrack && (
            <div className="absolute top-2 left-2 z-40 bg-red-600/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm">
              CANLI
            </div>
          )}
        </div>

        {/* 🔇 Mute/Deafen Overlay - Simplified for Performance */}
        {(isMuted || isDeafened) && (
          <div 
            className={`absolute z-30 pointer-events-none rounded-xl overflow-hidden transition-opacity duration-300 ${
              (shouldShowVideo && videoTrack) 
                ? "top-2 right-2 flex flex-col items-end group-hover:opacity-0" 
                : `inset-0 flex items-center justify-center ${
                    ((hasScreenShare && screenShareTrack)) ? "group-hover:opacity-0" : ""
                  }`
            }`}
          >
             {/* 🚀 CPU OPTİMİZASYONU: Backdrop blur kaldırıldı */}
             {!(shouldShowVideo && videoTrack) && (
                <div className="absolute inset-0 bg-black/50 transition-all duration-300" />
             )}
             
             <div className={`relative flex flex-col items-center 
                ${(shouldShowVideo && videoTrack) ? 'gap-1' : (compact ? 'gap-1.5' : 'gap-3')}
             `}>
               <div className={`
                  bg-zinc-900 border border-white/10 flex items-center justify-center rounded-full
                  ${(shouldShowVideo && videoTrack) ? 'p-1.5' : (compact ? 'p-2' : 'p-4')}
               `}>
                  {isDeafened ? (
                    <VolumeX 
                      size={(shouldShowVideo && videoTrack) ? 16 : (compact ? 18 : 32)} 
                      className="text-red-500" 
                      strokeWidth={2.5} 
                    />
                  ) : (
                    <MicOff 
                      size={(shouldShowVideo && videoTrack) ? 16 : (compact ? 18 : 32)} 
                      className="text-red-500" 
                      strokeWidth={2.5} 
                    />
                  )}
               </div>
               
               {!(shouldShowVideo && videoTrack) && (
                 <div className={`bg-black/60 rounded-full border border-white/5 ${compact ? 'px-2 py-0.5' : 'px-3 py-1'}`}>
                   <span className={`font-bold text-white/90 tracking-wide uppercase leading-none block ${compact ? 'text-[9px]' : 'text-xs'}`}>
                     {isDeafened ? "SAĞIRLAŞTIRDI" : "SUSTURDU"}
                   </span>
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default UserCard;
