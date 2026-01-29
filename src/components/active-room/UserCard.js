
import { useEffect, useMemo } from "react";
import {
  useParticipantInfo,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Tv, Maximize, VolumeX, MicOff } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAudioActivity } from "./hooks/useAudioActivity";
import ScreenSharePreviewComponent from "./ScreenSharePreview";

export default function UserCard({
  participant,
  totalCount,
  onContextMenu,
  compact,
  hideIncomingVideo,
  setActiveStreamId,
  activeStreamId,
}) {
  // Extract both identity (for tracking) and name (for display)
  // identity = persistent unique ID (e.g., "userId_deviceShort")
  // name = user-friendly display name (e.g., "sk jsksos")
  const { identity, name, metadata, isSpeaking: participantIsSpeaking } = useParticipantInfo({ participant });
  
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
  const audioActive = useAudioActivity(participant);

  // Screen share track kontrolü
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks.find(
    (t) => t.participant.sid === participant.sid
  );
  const hasScreenShare = !!screenShareTrack;
  const isCurrentlyWatching = activeStreamId === participant.identity;
  // 🚀 v5.2: Performans modu için animasyon kontrolü eklendi
  const { 
    profileColor: localProfileColor, 
    cameraMirrorEffect,
    disableAnimations,
    graphicsQuality 
  } = useSettingsStore();
  
  // Performans modu: low veya potato ise animasyonları devre dışı bırak
  const shouldDisableAnimations = disableAnimations || graphicsQuality === 'low' || graphicsQuality === 'potato';
  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);
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

  // Local participant için de metadata'dan oku (kendi durumunu görmek için)
  const isMuted = participant.isLocal
    ? remoteState.isMuted !== undefined
      ? remoteState.isMuted
      : false
    : remoteState.isMuted;
  const isDeafened = participant.isLocal
    ? remoteState.isDeafened !== undefined
      ? remoteState.isDeafened
      : false
    : remoteState.isDeafened;
  const isSpeaking = (audioActive || participantIsSpeaking) && !isMuted && !isDeafened;
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

  // Debug: Track durumunu kontrol et
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && cameraPublication) {
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
    }
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
  const speakingBorderStyle = isSpeaking ? {
    background: userColor.includes("gradient") 
      ? userColor  // Gradient direkt kullan
      : `linear-gradient(135deg, ${userColor}, ${userColor})`,
    padding: '2.5px',
    borderRadius: '18px',
    boxShadow: userColor.includes("gradient")
      ? `0 0 80px ${getBorderColor(userColor)}70, 0 0 40px ${getBorderColor(userColor)}50`
      : `0 0 80px ${userColor}70, 0 0 40px ${userColor}50`,
    transform: 'scale(1.02)',
    zIndex: 10,
    transition: 'all 0.25s ease-out',
  } : {};

  return (
    <div
      className="w-full h-full p-1"
    >
      <div
        onContextMenu={onContextMenu}
        className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center group cursor-context-menu overflow-hidden transition-colors duration-200`}
        style={{
          background: "rgba(20, 20, 24, 0.85)", // Eski koyu ton, ama daha opak (belirgin)
          // 🚀 CPU OPTİMİZASYONU: Border animate etme, sadece renk değiştir (GPU dostu)
          border: isSpeaking 
            ? `2px solid ${getBorderColor(userColor)}` 
            : isMuted || isDeafened 
              ? '2px solid rgba(239, 68, 68, 0.4)' 
              : '2px solid rgba(255, 255, 255, 0.08)', // Varsayılan border biraz daha belirgin
        }}
      >
      {/* 🔮 Background Glow - Static (No Animation) */}
      {isSpeaking && (
        <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
                background: userColor.includes("gradient") ? userColor : `radial-gradient(circle, ${userColor} 0%, transparent 70%)`
            }}
        />
      )}

      <div className="relative mb-2 w-full h-full flex flex-col items-center justify-center z-10 ">
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

            {/* Hover overlay - Yayına Katıl */}
            {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
              <div
                className="absolute inset-0 bg-black/60 opacity-0 group-hover/camera:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStreamId?.(participant.identity);
                }}
              >
                <div className="bg-indigo-600 px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-2">
                  <Tv size={14} />
                  <span>İzle</span>
                </div>
              </div>
            )}

            {/* Hover overlay - Kamerayı Büyüt */}
             {!hasScreenShare && shouldShowVideo && videoTrack && !isCurrentlyWatching && (
              <div
                className="absolute inset-0 bg-black/60 opacity-0 group-hover/camera:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStreamId?.(participant.identity);
                }}
              >
                <div className="bg-indigo-600 px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-2">
                  <Maximize size={14} />
                  <span>Büyüt</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`${avatarSize} rounded-2xl flex items-center justify-center text-white font-bold z-10 relative transition-transform duration-200 group/avatar`}
            style={{
              background: userColor, // 🎨 Background is ALWAYS user color now (overlay handles the 'dimming')
              // 🚀 CPU OPTİMİZASYONU: Box-shadow animasyonu yerine basit outline
              outline: isSpeaking ? `3px solid ${getBorderColor(userColor)}` : 'none',
              outlineOffset: '2px'
            }}
          >
            {/* Letter */}
            <span className="relative z-10 drop-shadow-md">
              {userInitials}
            </span>

            {/* Hover overlay - Katıl */}
            {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
              <div
                className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer z-50 rounded-2xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStreamId?.(participant.identity);
                }}
              >
                 <Tv size={16} />
              </div>
            )}
          </div>
        )}

        {/* İsim & Durum Badge - Her zaman sol altta ve isim görünür - Overlay'in üzerinde olması için z-40 */}
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

        {/* Screen Share Preview (Small) */}
        {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
          <ScreenSharePreviewComponent trackRef={screenShareTrack} />
        )}

        {/* Live Badge (Simple) */}
        {hasScreenShare && screenShareTrack && (
          <div className="absolute top-2 left-2 z-40 bg-red-600/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm">
            CANLI
          </div>
        )}
      </div>

      {/* 🔇 Mute/Deafen Overlay (Professional Glassmorphism with Text) */}
      {(isMuted || isDeafened) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none rounded-xl overflow-hidden">
           {/* Backdrop Dimmer & Blur */}
           <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-all duration-300" />
           
           {/* Icon & Text Container */}
           <div className={`relative flex flex-col items-center ${compact ? 'gap-1.5' : 'gap-3'} animate-in fade-in zoom-in-95 duration-200`}>
             <div className={`${compact ? 'p-2' : 'p-4'} bg-zinc-900/80 rounded-full border border-white/10 shadow-2xl backdrop-blur-md flex items-center justify-center`}>
                {isDeafened ? (
                  <VolumeX size={compact ? 18 : 32} className="text-red-500 drop-shadow-md" strokeWidth={2.5} />
                ) : (
                  <MicOff size={compact ? 18 : 32} className="text-red-500 drop-shadow-md" strokeWidth={2.5} />
                )}
             </div>
             {/* Text Label */}
             <div className={`${compact ? 'px-2 py-0.5' : 'px-3 py-1'} bg-black/50 rounded-full backdrop-blur-md border border-white/5`}>
               <span className={`${compact ? 'text-[9px]' : 'text-xs'} font-bold text-white/90 tracking-wide uppercase drop-shadow-lg leading-none block`}>
                 {isDeafened ? "SAĞIRLAŞTIRDI" : "SUSTURDU"}
               </span>
             </div>
           </div>
        </div>
      )}
      </div>
    </div>
  );
}
