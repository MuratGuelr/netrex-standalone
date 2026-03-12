import React, { useEffect, useMemo, memo, useState, useCallback, useRef } from "react";
import {
  useParticipantInfo,
  useTracks,
  useIsSpeaking,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Tv, Maximize, VolumeX, MicOff, Clock } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import ScreenSharePreviewComponent from "./ScreenSharePreview";

const UserCard = ({
  participant,
  totalCount,
  onContextMenu,
  compact,
  hideIncomingVideo,
  setPinnedStreamIds,
  pinnedStreamIds,
}) => {
  const { identity, name, metadata } = useParticipantInfo({ participant });
  const livekitIsSpeaking = useIsSpeaking(participant);
  
  const displayName = name || identity || "User";
  
  const getInitials = useCallback((nameStr) => {
    if (!nameStr) return "?";
    const trimmed = nameStr.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, []);
  
  const userInitials = useMemo(() => getInitials(displayName), [displayName, getInitials]);
  
  // 🚀 Store Optimizasyonu
  const localProfileColor = useSettingsStore(s => s.profileColor);
  const cameraMirrorEffect = useSettingsStore(s => s.cameraMirrorEffect);
  const disableAnimations = useSettingsStore(s => s.disableAnimations);
  const graphicsQuality = useSettingsStore(s => s.graphicsQuality);
  const localIsSpeaking = useSettingsStore(s => s.localIsSpeaking);
  const storeIsMuted = useSettingsStore(s => s.isMuted);
  const storeIsDeafened = useSettingsStore(s => s.isDeafened);

  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks.find(
    (t) => t.participant.sid === participant.sid
  );
  const hasScreenShare = !!screenShareTrack;
  const isCurrentlyWatching = pinnedStreamIds?.some(id => 
    id === participant.identity || 
    id === `${participant.identity}:screen` || 
    id === `${participant.identity}:camera`
  );
  
  // ✅ DÜZELTME: Animasyon kontrolleri
  const shouldAnimate = useMemo(() => {
    if (disableAnimations === true) return false;
    if (graphicsQuality === 'potato') return false;
    return true;
  }, [disableAnimations, graphicsQuality]);

  const shouldBlur = useMemo(() => {
    if (!graphicsQuality) return true;
    return graphicsQuality === 'high' || graphicsQuality === 'medium';
  }, [graphicsQuality]);

  const shouldAnimateRings = useMemo(() => {
    if (disableAnimations === true) return false;
    return !graphicsQuality || graphicsQuality === 'high';
  }, [disableAnimations, graphicsQuality]);

  // ✅ PATATES MODU: Statik glow (animasyon yok, sadece opacity)
  const isPotatoMode = useMemo(() => {
    return graphicsQuality === 'potato' || disableAnimations === true;
  }, [graphicsQuality, disableAnimations]);

  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);

  const isMuted = participant.isLocal ? storeIsMuted : remoteState.isMuted;
  const isDeafened = participant.isLocal ? storeIsDeafened : remoteState.isDeafened;

  const userColor = participant.isLocal
    ? localProfileColor || "#6366f1"
    : remoteState.profileColor || "#6366f1";

  const borderColor = useMemo(() => {
    if (!userColor || !userColor.includes("gradient")) return userColor || "#6366f1";
    const match = userColor.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#6366f1";
  }, [userColor]);

  const borderStyle = useMemo(() => ({
    border: isMuted || isDeafened 
        ? '2px solid rgba(239, 68, 68, 0.4)' 
        : '2px solid rgba(255, 255, 255, 0.08)',
    transform: 'translateZ(0)'
  }), [isMuted, isDeafened]);

  // ✅ FIX v2.0: Speaking state - anında açılsın, gecikmeli kapansın
  const [debouncedIsSpeaking, setDebouncedIsSpeaking] = useState(false);
  const speakingTimerRef = useRef(null);
  
  useEffect(() => {
    const rawIsSpeaking = participant.isLocal 
      ? localIsSpeaking 
      : livekitIsSpeaking;
    const isSpeakingNow = rawIsSpeaking && !isMuted && !isDeafened;
    
    if (isSpeakingNow) {
      // ✅ Konuşma ANINDA başlasın - debounce yok
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
      setDebouncedIsSpeaking(true);
    } else {
      // ✅ Kapanma 200ms gecikmeli - çok kısa kesintilerde titreme olmasın
      if (!speakingTimerRef.current) {
        speakingTimerRef.current = setTimeout(() => {
          setDebouncedIsSpeaking(false);
          speakingTimerRef.current = null;
        }, 200);
      }
    }
    
    return () => {
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    };
  }, [livekitIsSpeaking, localIsSpeaking, isMuted, isDeafened, participant.isLocal]);

  const isSpeaking = debouncedIsSpeaking;

  const avatarSize = useMemo(() => {
    if (compact) return "w-10 h-10 text-base";
    if (totalCount <= 2) return "w-28 h-28 text-4xl";
    return "w-16 h-16 text-xl";
  }, [compact, totalCount]);

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

  const handleVideoClick = useCallback((e) => {
    if (!isCurrentlyWatching && setPinnedStreamIds && participant.identity && (hasScreenShare || shouldShowVideo)) {
      e.stopPropagation();
      // ✅ Hem ekran hem kamera açıksa IKISINIDE ekle
      const newPins = [];
      if (hasScreenShare) newPins.push(`${participant.identity}:screen`);
      if (shouldShowVideo) newPins.push(`${participant.identity}:camera`);
      setPinnedStreamIds(prev => Array.from(new Set([...(prev || []), ...newPins])));
    }
  }, [isCurrentlyWatching, setPinnedStreamIds, participant.identity, hasScreenShare, shouldShowVideo]);

  const videoStyle = useMemo(() => ({
    transform: participant.isLocal && cameraMirrorEffect ? 'scaleX(-1)' : undefined
  }), [participant.isLocal, cameraMirrorEffect]);

  // ✅ SPEAKING INDICATOR STYLE (Animasyonlu + Statik)
  const speakingIndicatorStyle = useMemo(() => {
    if (isPotatoMode) {
      // 🥔 PATATES MODU: Statik border, animasyon yok
      return {
        opacity: isSpeaking ? 1 : 0,
        border: `2px solid ${borderColor}`,
        transition: 'opacity 200ms ease-out',  // Sadece opacity transition
      };
    } else {
      // 🎨 NORMAL MOD: Animasyonlu + glow
      return {
        opacity: isSpeaking ? 1 : 0,
        border: `2px solid ${borderColor}cc`,
        boxShadow: `0 0 20px ${borderColor}40, 0 0 10px ${borderColor}20`,
      };
    }
  }, [isSpeaking, borderColor, isPotatoMode]);

  // ✅ BACKGROUND GLOW STYLE (Sadece normal modda)
  const backgroundGlowStyle = useMemo(() => {
    if (isPotatoMode) {
      // 🥔 PATATES: Hafif statik glow (animasyon yok)
      return {
        background: borderColor,
        opacity: isSpeaking ? 0.08 : 0,  // Çok hafif
        transition: 'opacity 200ms ease-out',
      };
    } else {
      // 🎨 NORMAL: Animasyonlu glow
      return {
        background: userColor,
        opacity: isSpeaking ? 0.15 : 0,
        animation: isSpeaking ? "pulse-glow 3s infinite ease-in-out" : "none"
      };
    }
  }, [isSpeaking, isPotatoMode, userColor, borderColor]);

  // ✅ AVATAR TRANSFORM STYLE
  const avatarTransformStyle = useMemo(() => ({
    background: userColor,
    transform: 'translateZ(0)',
    transition: shouldAnimate && !isPotatoMode ? 'transform 300ms ease-out' : 'none'
  }), [userColor, shouldAnimate, isPotatoMode]);

  return (
    <div className="w-full h-full p-1 will-change-transform">
      <div
        onContextMenu={onContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (hasScreenShare || shouldShowVideo) {
             setPinnedStreamIds?.(prev => prev.includes(participant.identity) 
               ? prev.filter(id => id !== participant.identity)
               : [...prev, participant.identity]
             );
          }
        }}
        className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center group overflow-hidden bg-[#141418]/85 ${(hasScreenShare || shouldShowVideo) ? 'cursor-pointer' : 'cursor-context-menu'}`}
        style={borderStyle}
      >
        {/* 🚀 Speaking Indicator Layer - Her modda göster */}
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none z-20 will-change-opacity"
          style={speakingIndicatorStyle}
        />
        
        {/* 🔮 Background Glow - Her modda göster (patates'te minimal) */}
        <div
          className="absolute inset-0 pointer-events-none will-change-opacity z-0"
          style={backgroundGlowStyle}
        />

        <div className="relative mb-2 w-full h-full flex flex-col items-center justify-center z-10">
          {shouldShowVideo && videoTrack ? (
            <div
              className="relative w-full h-full rounded-xl overflow-hidden z-20 group/camera"
              onClick={handleVideoClick}
              style={{ cursor: hasVisibleContent && !isCurrentlyWatching ? "pointer" : "default" }}
            >
              <VideoTrack
                trackRef={videoTrack}
                className="w-full h-full object-cover relative z-0"
                style={videoStyle}
              />

              {/* ✅ PATATES: Basit border, animasyon yok */}
              {isSpeaking && (
                <div 
                  className="absolute inset-0 rounded-xl border-2 pointer-events-none"
                  style={{
                    borderColor: isPotatoMode ? borderColor : 'rgba(255, 255, 255, 0.2)',
                    transition: isPotatoMode ? 'none' : 'border-color 200ms'
                  }}
                ></div>
              )}

              {/* Hover overlay - Ekran Paylaşımı İzleme */}
              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className={`absolute inset-0 bg-black/60 opacity-0 group-hover/camera:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer z-50 gap-1.5 ${shouldBlur ? 'backdrop-blur-sm' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Yayını izle + kamera da açıksa onu da ekle
                    const newPins = [`${participant.identity}:screen`];
                    if (shouldShowVideo) newPins.push(`${participant.identity}:camera`);
                    setPinnedStreamIds?.(prev => Array.from(new Set([...(prev || []), ...newPins])));
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-[#5865f2]/20 border border-[#5865f2]/40 flex items-center justify-center">
                    <Tv size={22} className="text-[#5865f2] drop-shadow-lg" />
                  </div>
                  <span className="text-sm font-bold text-white drop-shadow-lg">Yayını İzle</span>
                  <span className="text-[10px] text-white/60">Tıkla ve ekran paylaşımını aç</span>
                </div>
              )}

              {/* Hover overlay - Kamerayı Büyüt */}
              {!hasScreenShare && shouldShowVideo && !isCurrentlyWatching && (
                <div
                  className={`absolute inset-0 bg-black/40 opacity-0 group-hover/camera:opacity-100 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer z-50 gap-1.5 ${shouldBlur ? 'backdrop-blur-sm' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedStreamIds?.(prev => Array.from(new Set([...(prev || []), `${participant.identity}:camera`])));
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                    <Maximize size={20} className="text-white drop-shadow-lg" />
                  </div>
                  <span className="text-sm font-bold text-white drop-shadow-lg">Kamerayı Büyüt</span>
                  <span className="text-[10px] text-white/60">Kamerayı tam boyut izle</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`${avatarSize} rounded-2xl flex items-center justify-center text-white font-bold z-10 relative group/avatar`}
              style={{
                ...avatarTransformStyle,
                // ✅ PATATES: Statik scale (animasyon yok)
                transform: isPotatoMode 
                  ? 'translateZ(0)' 
                  : (shouldAnimate && isSpeaking ? 'translateZ(0) scale(1.02)' : 'translateZ(0)')
              }}
            >
              {/* ✅ RING ANIMASYONLARI - Sadece high quality'de */}
              {isSpeaking && !isPotatoMode && shouldAnimateRings && (
                <>
                  <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400 z-20 animate-nds-speaking-ring" style={{ '--speaking-color': '#34d399' }} />
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-500/60 z-20" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                </>
              )}

              {/* 🥔 PATATES: Statik ring (animasyon yok) */}
              {isSpeaking && isPotatoMode && (
                <div 
                  className="absolute inset-0 rounded-2xl border-2 z-20"
                  style={{
                    borderColor: borderColor,
                    opacity: 0.8,
                    transition: 'opacity 200ms ease-out'
                  }}
                />
              )}

              <span className="relative z-10 drop-shadow-md">{userInitials}</span>

              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className={`absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer z-50 rounded-2xl ${shouldBlur ? 'backdrop-blur-md' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setPinnedStreamIds?.(prev => Array.from(new Set([...(prev || []), `${participant.identity}:screen`]))); }}
                >
                  <div className="w-12 h-12 rounded-full bg-[#5865f2]/20 border border-[#5865f2]/40 flex items-center justify-center shadow-lg transform group-hover/avatar:scale-110 transition-transform duration-300">
                    <Tv size={20} className="text-[#5865f2] drop-shadow-md" />
                  </div>
                  <span className="text-[12px] font-bold text-white/90 tracking-wide drop-shadow-md mt-2">Yayını İzle</span>
                  <span className="text-[9px] text-white/50 mt-0.5">Ekran paylaşımını aç</span>
                </div>
              )}
            </div>
          )}

          {/* İsim & Durum Badge */}
          <div
            className={`absolute z-40 max-w-[90%] ${
              compact 
                ? `bottom-1 left-1 bg-black/40 px-2 py-1 rounded-md ${shouldBlur ? 'backdrop-blur-sm' : ''}`
                : shouldShowVideo 
                  ? `bottom-2 left-2 bg-black/60 px-2.5 py-1.5 rounded-lg ${shouldBlur ? 'backdrop-blur-sm' : ''}`
                  : `bottom-3 left-3 bg-black/40 px-3 py-1.5 rounded-full shadow-sm ${shouldBlur ? 'backdrop-blur-sm' : ''}`
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

        {/* 🚀 QUICK STATUS DISPLAY - OPTIMIZED (No Animation) */}
        {remoteState.quickStatus && (
          <div 
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            {/* Kapsayıcıya hafif pulse animasyonu ekledik */}
            {compact ? (
              // 📱 COMPACT MOD: Sadece İkon (Statik Kırmızı)
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 shadow-lg bg-gradient-to-br from-red-600 to-red-900"
                style={{ 
                  boxShadow: `0 0 10px ${userColor ? `${userColor}80` : '#ef444480'}` // Sabit User Color Glow
                }}
              >
                <span className="text-sm drop-shadow-md select-none text-white">{remoteState.quickStatus.icon || "⏰"}</span>
              </div>
            ) : (
              // 🖥️ NORMAL MOD: İkon + Yazı (Statik Kırmızı)
              <div 
                className="flex items-center gap-3 px-5 py-2.5 rounded-2xl border border-white/20 shadow-lg relative overflow-hidden max-w-[90%] bg-gradient-to-br from-red-600 via-red-700 to-red-900"
                style={{ 
                  boxShadow: `0 8px 25px ${userColor ? `${userColor}60` : '#b91c1c60'}` // Sabit User Color Aura
                }}
              >
                {/* Parlama Efekti (Statik) */}
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                
                {/* İçerik */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <span className="text-2xl mb-1 drop-shadow-lg filter contrast-125 select-none">
                    {remoteState.quickStatus.icon || "⏰"}
                  </span>
                  <span className="text-[11px] font-black text-white uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] leading-tight truncate w-full max-w-[120px]">
                    {remoteState.quickStatus.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(UserCard);