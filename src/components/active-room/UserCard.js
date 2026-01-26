
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
      style={speakingBorderStyle}
      className={`w-full h-full ${isSpeaking ? 'rounded-[18px]' : ''}`}
    >
      <div
        onContextMenu={onContextMenu}
        className={`relative w-full h-full rounded-2xl flex flex-col items-center justify-center group cursor-context-menu backdrop-blur-md ${!isSpeaking ? 'hover:shadow-soft-lg hover:scale-[1.02]' : ''}`}
        style={{
          background: isSpeaking
            ? 'linear-gradient(135deg, rgba(15,15,20,0.98) 0%, rgba(10,10,12,0.99) 100%)'
            : isMuted || isDeafened
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(10,10,12,0.7) 50%, rgba(10,10,12,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(30,30,35,0.95) 0%, rgba(10,10,12,0.98) 100%)',
          // Border sadece muted/deafened durumunda görünür
          border: isMuted || isDeafened ? '2px solid rgba(239, 68, 68, 0.4)' : 'none',
          boxShadow: isMuted || isDeafened
            ? `inset 0 0 0 3px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.3)`
            : '0 4px 15px rgba(0,0,0,0.15)',
          overflow: "hidden",
          transition: 'all 0.25s ease-out',
        }}
      >
      {/* Animated background glow for speaking - Smooth fade in/out */}
      {/* 🚀 v5.2: Performans modunda animasyon devre dışı */}
      {!shouldDisableAnimations && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: userColor.includes("gradient")
              ? `radial-gradient(circle at center, ${getBorderColor(userColor)}20 0%, transparent 70%)`
              : `radial-gradient(circle at center, ${userColor}20 0%, transparent 70%)`,
            transform: "scale(0.95)",
            opacity: isSpeaking ? 1 : 0,
            animation: isSpeaking ? 'pulseGlowSlow 3s ease-in-out infinite' : 'none',
            transition: 'opacity 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        />
      )}
      <div className="relative mb-2 w-full h-full flex flex-col items-center justify-center z-10 ">
        {/* Screen share varsa ve izleniyorsa normal görünüm, izlenmiyorsa avatar/video gösterilmez */}
        {/* Screen share gizlenmişse (activeStreamId null) kamera gösterilmeli */}
        {/* Eğer kullanıcı kendi screen share'ini açtıysa, kendi kameranın gösterilmesi gerekiyor */}
        {/* Screen share varsa bile kamera gösterilmeli (screen share preview arka planda) */}
        {/* Kameraya tıklandığında yayına katıl (eğer screen share varsa ve izlenmiyorsa) */}
        {shouldShowVideo && videoTrack ? (
          <div
            className="relative w-full h-full rounded-2xl overflow-hidden shadow-soft-lg z-20 group/camera"
            onClick={(e) => {
              // Kameraya veya yayına tıklandığında activeStreamId'yi güncelle
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
              className="w-full h-full object-cover transition-all duration-500 relative z-0"
              style={{
                filter: isSpeaking
                  ? "brightness(1.1) contrast(1.15) saturate(1.2) hue-rotate(5deg)"
                  : "brightness(1) contrast(1.08) saturate(1.1)",
                transform: `${isSpeaking ? "scale(1.05)" : "scale(1)"} ${
                  participant.isLocal && cameraMirrorEffect ? "scaleX(-1)" : ""
                }`,
                transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            {/* Speaking durumunda animasyonlu arka plan glow - Resimdeki gibi - Container içinde kalacak şekilde */}
            {/* 🚀 v5.2: Performans modunda animasyonlar devre dışı */}
            {isSpeaking && !shouldDisableAnimations && (
              <>
                {/* Ana glow layer - Radial gradient - Container içinde, padding ile */}
                <div
                  className="absolute rounded-2xl pointer-events-none animate-speaking-glow"
                  style={{
                    top: "4px",
                    left: "4px",
                    right: "4px",
                    bottom: "4px",
                    background: `radial-gradient(circle at center, ${getBorderColor(
                      userColor
                    )}40 0%, ${getBorderColor(
                      userColor
                    )}20 30%, ${getBorderColor(
                      userColor
                    )}10 50%, transparent 80%)`,
                    zIndex: 1,
                  }}
                />

                {/* Pulsing ring effect - Container içinde, padding ile */}
                <div
                  className="absolute rounded-2xl pointer-events-none animate-speaking-pulse-ring"
                  style={{
                    top: "6px",
                    left: "6px",
                    right: "6px",
                    bottom: "6px",
                    background: `radial-gradient(circle at center, ${getBorderColor(
                      userColor
                    )}30 0%, transparent 60%)`,
                    zIndex: 2,
                  }}
                />

                {/* Border glow - Container içinde */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse-border-video"
                  style={{
                    boxShadow: `inset 0 0 0 3px ${getBorderColor(
                      userColor
                    )}80, inset 0 0 20px ${getBorderColor(userColor)}30`,
                    background: `linear-gradient(135deg, ${getBorderColor(
                      userColor
                    )}25 0%, transparent 60%)`,
                    zIndex: 3,
                  }}
                />

                {/* Corner glow accents - Container içinde, padding ile */}
                <div
                  className="absolute rounded-2xl pointer-events-none animate-speaking-corner-glow"
                  style={{
                    top: "4px",
                    left: "4px",
                    width: "40%",
                    height: "40%",
                    background: `radial-gradient(circle at top left, ${getBorderColor(
                      userColor
                    )}35 0%, transparent 60%)`,
                    zIndex: 2,
                  }}
                />
                <div
                  className="absolute rounded-2xl pointer-events-none animate-speaking-corner-glow"
                  style={{
                    bottom: "4px",
                    right: "4px",
                    width: "40%",
                    height: "40%",
                    background: `radial-gradient(circle at bottom right, ${getBorderColor(
                      userColor
                    )}35 0%, transparent 60%)`,
                    zIndex: 2,
                    animationDelay: "0.5s",
                  }}
                />
              </>
            )}

            {/* Enhanced gradient overlay - Speaking durumunda daha az koyu */}
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                isSpeaking ? "opacity-40" : "opacity-100"
              }`}
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
                zIndex: 4,
              }}
            />
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                isSpeaking ? "opacity-30" : "opacity-100"
              }`}
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, transparent 50%, rgba(0,0,0,0.4) 100%)",
                zIndex: 4,
              }}
            />

            {/* Hover overlay - Yayına Katıl (sadece screen share varsa ve izlenmiyorsa) */}
            {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
              <div
                className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 opacity-0 group-hover/camera:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm cursor-pointer z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  if (setActiveStreamId && participant.identity) {
                    setActiveStreamId(participant.identity);
                  }
                }}
              >
                <div className="glass-strong border border-white/40 bg-gradient-to-r from-indigo-500/95 to-purple-500/95 px-4 py-2 rounded-xl backdrop-blur-xl flex items-center gap-2.5 font-semibold text-white text-sm shadow-soft-lg transform group-hover/camera:scale-110 transition-transform duration-300 hover:scale-125 hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-75 animate-pulse"></div>
                    <div className="relative w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                  </div>
                  <span className="drop-shadow-lg">Yayına Katıl</span>
                  <Tv size={16} className="drop-shadow-lg" />
                </div>
              </div>
            )}

            {/* Hover overlay - Kamerayı Büyüt (screen share yoksa ve izlenmiyorsa) */}
             {!hasScreenShare && shouldShowVideo && videoTrack && !isCurrentlyWatching && (
              <div
                className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 opacity-0 group-hover/camera:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm cursor-pointer z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  if (setActiveStreamId && participant.identity) {
                    setActiveStreamId(participant.identity);
                  }
                }}
              >
                <div className="glass-strong border border-white/40 bg-gradient-to-r from-indigo-500/95 to-purple-500/95 px-4 py-2 rounded-xl backdrop-blur-xl flex items-center gap-2.5 font-semibold text-white text-sm shadow-soft-lg transform group-hover/camera:scale-110 transition-transform duration-300 hover:scale-125 hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]">
                  <Maximize size={16} className="drop-shadow-lg" />
                  <span className="drop-shadow-lg">Büyüt</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`${avatarSize} rounded-2xl flex items-center justify-center text-white font-bold shadow-soft-lg z-10 relative transition-all duration-500 overflow-hidden group/avatar ${
              isSpeaking
                ? "speaking-avatar ring-4 ring-offset-4 ring-offset-transparent animate-avatar-pulse"
                : isMuted || isDeafened
                ? "bg-gray-600/80 ring-4 ring-red-500/40 grayscale opacity-70"
                : "hover:shadow-glow hover:scale-110"
            }`}
            style={{
              background:
                isMuted || isDeafened
                  ? undefined
                  : userColor.includes("gradient")
                  ? userColor
                  : userColor,
              "--tw-ring-color": isSpeaking
                ? getBorderColor(userColor)
                : undefined,
              boxShadow: isSpeaking
                ? userColor.includes("gradient")
                ? `0 0 40px ${getBorderColor(
                    userColor
                  )}70, 0 12px 35px rgba(0,0,0,0.5), inset 0 0 20px ${getBorderColor(
                    userColor
                  )}20`
                : `0 0 40px ${userColor}70, 0 12px 35px rgba(0,0,0,0.5), inset 0 0 20px ${userColor}20`
                : undefined,
            }}
          >
            {/* Avatar gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20 pointer-events-none rounded-2xl"></div>

            {/* Animated shimmer effect */}
            {!isMuted && !isDeafened && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/avatar:translate-x-full transition-transform duration-1000 pointer-events-none rounded-2xl"></div>
            )}

            {/* Letter - use userInitials for proper initials (handles anonymous users) */}
            <span className="relative z-10 drop-shadow-lg">
              {userInitials}
            </span>

            {/* Speaking pulse rings */}
            {/* 🚀 v5.2: Performans modunda devre dışı */}
            {isSpeaking && !shouldDisableAnimations && (
              <>
                <div
                  className="absolute inset-0 rounded-2xl animate-ping"
                  style={{
                    border: `2px solid ${getBorderColor(userColor)}`,
                    opacity: 0.3,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-2xl animate-ping"
                  style={{
                    border: `2px solid ${getBorderColor(userColor)}`,
                    opacity: 0.2,
                    animationDelay: "0.5s",
                  }}
                />
              </>
            )}

            {/* Hover overlay - Yayına Katıl (sadece screen share varsa ve izlenmiyorsa) */}
            {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 flex flex-col items-center justify-end pb-4 cursor-pointer z-50 rounded-2xl"
                onClick={(e) => {
                  e.stopPropagation();
                  if (setActiveStreamId && participant.identity) {
                    setActiveStreamId(participant.identity);
                  }
                }}
              >
                {/* Canlı yayın göstergesi - üstte */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-75 animate-pulse"></div>
                    <div className="relative w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                  </div>
                  <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Canlı</span>
                </div>
                
                {/* Katıl butonu - modern tasarım */}
                <button 
                  className="relative overflow-hidden px-5 py-2.5 rounded-xl font-semibold text-white text-sm shadow-2xl transform transition-all duration-300 hover:scale-110 active:scale-95 group/btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.95) 0%, rgba(168,85,247,0.95) 100%)',
                  }}
                >
                  {/* Shimmer efekti */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                  
                  {/* Border glow */}
                  <div className="absolute inset-0 rounded-xl border border-white/30 group-hover/btn:border-white/50 transition-colors"></div>
                  
                  {/* İçerik */}
                  <div className="relative flex items-center gap-2">
                    <Tv size={16} className="drop-shadow-lg" />
                    <span className="drop-shadow-lg">Yayına Katıl</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* İsim - Alt kısımda - Enhanced with status indicator */}
        <div
          className={`absolute z-10 max-w-[80%] transition-all duration-300 group-hover:scale-105 ${
            shouldShowVideo
              ? "-bottom-1 left-1 glass-strong px-3 py-1.5 rounded-xl backdrop-blur-xl border border-white/20 shadow-soft-lg"
              : "bottom-2 left-3 glass-strong px-4 py-2 rounded-xl backdrop-blur-xl border border-white/20 shadow-soft-lg"
          }`}
          style={{
            background: shouldShowVideo
              ? "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)"
              : "linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)",
          }}
        >
          {/* Muted By veya Normal İsim */}
          {(remoteState.serverMuted || remoteState.serverDeafened) && (remoteState.mutedBy || remoteState.deafenedBy) ? (
            <div className="flex flex-col items-start gap-0.5 animate-in slide-in-from-bottom-1 fade-in duration-300">
               <div className="flex items-center gap-1.5 leading-none">
                 {remoteState.serverDeafened ? (
                   <VolumeX size={12} className="text-red-400" />
                 ) : (
                   <MicOff size={12} className="text-red-400" />
                 )}
                 <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest leading-none">
                   {remoteState.serverDeafened ? "SAĞIRLAŞTIRILDI" : "SUSTURULDU"}
                 </span>
               </div>
               <div className="flex items-center gap-1">
                 <span className="text-[10px] text-zinc-400 leading-tight">Yapan:</span>
                 <span className="text-xs font-bold text-white/90 leading-tight">
                    {remoteState.serverDeafened ? remoteState.deafenedBy : remoteState.mutedBy}
                 </span>
               </div>
            </div>
          ) : (
            /* Normal Durum */
            <div className="flex items-center gap-2">
              {/* Status indicator - Minimal */}
              {(isDeafened || isMuted) && (
                <div className="relative shrink-0">
                  {isDeafened ? (
                    <VolumeX size={12} className="text-red-400" />
                  ) : (
                    <MicOff size={12} className="text-red-400" />
                  )}
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-sm animate-pulse"></div>
                </div>
              )}
              {isSpeaking && !isMuted && !isDeafened && (
                <div className="relative shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                  <div className="absolute inset-0 bg-green-500/30 rounded-full blur-sm animate-ping"></div>
                </div>
              )}
              <span
                className={`font-semibold text-white tracking-normal truncate block drop-shadow-2xl ${
                  compact ? "text-[10px] leading-tight" : "text-sm"
                }`}
                style={{
                  textShadow:
                    "0 2px 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6)",
                }}
              >
                {displayName}
              </span>
            </div>
          )}
        </div>

        {/* Screen Share Önizleme - İlk 1 saniye canlı, sonra donmuş frame (sadece izlenmiyorsa) */}
        {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
          <ScreenSharePreviewComponent trackRef={screenShareTrack} />
        )}

        {/* Üstte çok küçük "yayın yapıyor" badge'i - Screen share varsa ve izleniyorsa */}
        {hasScreenShare && screenShareTrack && isCurrentlyWatching && (
          <div className="absolute top-2 left-2 z-30 glass-strong px-2 py-0.5 rounded-md backdrop-blur-md border border-white/20 shadow-soft">
            <span className="font-medium text-white text-[10px] drop-shadow-lg flex items-center gap-1">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full blur-sm opacity-75 animate-pulse"></div>
                <div className="relative w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              </div>
              Yayında
            </span>
          </div>
        )}

        {/* Üstte "yayın yapıyor" badge'i - Screen share varsa ama izlenmiyorsa */}
        {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
          <div className="absolute top-3 left-3 z-30 glass-strong px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/20 shadow-soft">
            <span className="font-medium text-white text-xs drop-shadow-lg flex items-center gap-1.5">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full blur-sm opacity-75 animate-pulse"></div>
                <div className="relative w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              Yayında
            </span>
          </div>
        )}
      </div>
      {/* 🚀 v5.2: Performans modunda animasyonlar devre dışı */}
      {!shouldShowVideo && isSpeaking && !shouldDisableAnimations && (
        <>
          {/* Ana glow layer - Container içinde, padding ile */}
          <div
            className="absolute pointer-events-none rounded-2xl animate-speaking-glow overflow-hidden"
            style={{
              top: "4px",
              left: "4px",
              right: "4px",
              bottom: "4px",
              background: userColor.includes("gradient")
                ? `radial-gradient(circle at center, ${getBorderColor(
                    userColor
                  )}40 0%, ${getBorderColor(userColor)}25 30%, ${getBorderColor(
                    userColor
                  )}15 50%, transparent 80%)`
                : `radial-gradient(circle at center, ${userColor}40 0%, ${userColor}25 30%, ${userColor}15 50%, transparent 80%)`,
              zIndex: 0,
            }}
          />
          {/* Pulsing ring effect - Container içinde, padding ile */}
          <div
            className="absolute pointer-events-none rounded-2xl animate-speaking-pulse-ring overflow-hidden"
            style={{
              top: "6px",
              left: "6px",
              right: "6px",
              bottom: "6px",
              background: userColor.includes("gradient")
                ? `radial-gradient(circle at center, ${getBorderColor(
                    userColor
                  )}30 0%, transparent 60%)`
                : `radial-gradient(circle at center, ${userColor}30 0%, transparent 60%)`,
              zIndex: 0,
            }}
          />
          {/* Corner accents - Container içinde, padding ile */}
          <div
            className="absolute rounded-2xl pointer-events-none animate-speaking-corner-glow overflow-hidden"
            style={{
              top: "4px",
              left: "4px",
              width: "40%",
              height: "40%",
              background: userColor.includes("gradient")
                ? `radial-gradient(circle at top left, ${getBorderColor(
                    userColor
                  )}35 0%, transparent 60%)`
                : `radial-gradient(circle at top left, ${userColor}35 0%, transparent 60%)`,
              zIndex: 0,
            }}
          />
          <div
            className="absolute rounded-2xl pointer-events-none animate-speaking-corner-glow overflow-hidden"
            style={{
              bottom: "4px",
              right: "4px",
              width: "40%",
              height: "40%",
              background: userColor.includes("gradient")
                ? `radial-gradient(circle at bottom right, ${getBorderColor(
                    userColor
                  )}35 0%, transparent 60%)`
                : `radial-gradient(circle at bottom right, ${userColor}35 0%, transparent 60%)`,
              zIndex: 0,
              animationDelay: "0.5s",
            }}
          />
        </>
      )}
      </div>
    </div>
  );
}
