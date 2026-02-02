
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTracks, useLocalParticipant, useParticipants, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Monitor,
  Eye,
  EyeOff,
  StopCircle,
  Layers,
  Minimize,
  Maximize,
  VolumeX,
  Volume1,
  Volume2,
  AlertTriangle,
  Users,
  MicOff
} from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import ParticipantList from "./ParticipantList";
import PipGrid from "./PipGrid";
import ChatView from "../ChatView";

const MemoizedStageBackground = React.memo(({ disableBackgroundEffects, activeSpeakerColor }) => {
  // Extract primary hex if it's a gradient
  const getBaseColor = (color) => {
    if (!color) return null;
    if (!color.includes("gradient")) return color;
    const match = color.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : null;
  };

  const baseColor = getBaseColor(activeSpeakerColor);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {!disableBackgroundEffects && (
        <>
          <div 
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out will-change-opacity pointer-events-none"
            style={{
              opacity: baseColor ? 0.25 : 0,
              background: baseColor || 'transparent',
              filter: 'blur(80px)',
              maskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 70%)',
              transform: 'translateZ(0)' // Direct GPU hint
            }}
          />

          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-500/[0.08] rounded-full blur-[80px] animate-pulse-slow will-change-opacity" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/[0.06] rounded-full blur-[65px] animate-pulse-slow will-change-opacity" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/[0.05] rounded-full blur-[100px] animate-pulse-slow will-change-opacity" style={{ animationDelay: '2s' }} />
          
          <div 
            className="absolute inset-0 opacity-[0.015] will-change-opacity"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
              maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)'
            }}
          />
        </>
      )}
    </div>
  );
});

function StageManager({
  showVoicePanel,
  showChatPanel,
  currentTextChannel,
  chatPosition,
  chatWidth,
  setChatWidth,
  username,
  userId,
  onUserContextMenu,
  activeStreamId,
  setActiveStreamId,
  hideIncomingVideo,
  stopScreenShare,
}) {
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const userStoppedWatchingRef = useRef(false); // Kullanıcı manuel olarak izlemeyi durdurdu mu?
  const prevScreenTracksRef = useRef([]); // Önceki screen share track'lerini takip etmek için

  // Resize handler - throttle ile optimize edilmiş
  const resizeTimeoutRef = useRef(null);
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;

      // Throttle: Her 16ms'de bir güncelle (60fps)
      if (resizeTimeoutRef.current) return;

      resizeTimeoutRef.current = requestAnimationFrame(() => {
        resizeTimeoutRef.current = null;

        const containerRect = containerRef.current.getBoundingClientRect();
        const minWidth = 300; // Minimum chat genişliği
        const maxWidth = containerRect.width * 0.7; // Maksimum %70

        let newWidth;
        if (chatPosition === "right") {
          // Sağdan soldan çek
          newWidth = containerRect.right - e.clientX;
        } else {
          // Soldan sağdan çek
          newWidth = e.clientX - containerRect.left;
        }

        // Sınırları kontrol et
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setChatWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
    };
  }, [isResizing, chatPosition, setChatWidth]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  
  const activeTrack = useMemo(() => {
    if (!activeStreamId) return null;
    const screen = screenTracks.find((t) => t.participant.identity === activeStreamId);
    if (screen) return screen;
    const camera = cameraTracks.find((t) => t.participant.identity === activeStreamId);
    return camera;
  }, [activeStreamId, screenTracks, cameraTracks]);
  const { localParticipant } = useLocalParticipant();
  const amISharing = localParticipant.isScreenShareEnabled;
  const { desktopNotifications, notifyOnJoin } = useSettingsStore();

  // 🌈 v5.4 Adaptive Background Logic
  const participants = useParticipants();
  const localIsSpeaking = useSettingsStore(s => s.localIsSpeaking);
  const localProfileColor = useSettingsStore(s => s.profileColor);

  const activeSpeakerColor = useMemo(() => {
    if (localIsSpeaking) return localProfileColor || "#6366f1";
    
    // Remote speaker bul
    const speaker = participants.find(p => p.isSpeaking && !p.isLocal);
    if (!speaker) return null;

    try {
      const meta = speaker.metadata ? JSON.parse(speaker.metadata) : {};
      return meta.profileColor || "#6366f1";
    } catch {
      return "#6366f1";
    }
  }, [participants, localIsSpeaking, localProfileColor]);

  // Yayın açıldığında bildirim göster
  useEffect(() => {
    if (screenTracks.length > prevScreenTracksRef.current.length) {
      // Yeni bir yayın başladı
      const newTracks = screenTracks.filter(
        (t) =>
          !prevScreenTracksRef.current.find(
            (pt) => pt.participant.sid === t.participant.sid
          )
      );

      newTracks.forEach((track) => {
        if (
          !track.participant.isLocal &&
          desktopNotifications &&
          notifyOnJoin
        ) {
          const participantName = track.participant.name || track.participant.identity || "Birisi";
          if (Notification.permission === "granted") {
            const notification = new Notification("Yayın Başladı", {
              body: `${participantName} ekran paylaşımı başlattı`,
              icon: "/favicon.ico",
              tag: `screen-share-${track.participant.sid}`,
            });

            notification.onclick = () => {
              if (window.netrex?.focusWindow) {
                window.netrex.focusWindow();
              } else {
                window.focus();
              }
              notification.close();
            };
          }
        }
      });
    }
    prevScreenTracksRef.current = screenTracks;
  }, [screenTracks, desktopNotifications, notifyOnJoin]);

  // activeStreamId'yi yönet - sadece track değiştiğinde veya track kaybolduğunda güncelle
  // Kullanıcı manuel olarak durdurduğunda (null yaptığında) tekrar seçme
  useEffect(() => {
    // Kullanıcı manuel olarak durdurduysa, tekrar otomatik seçme
    if (userStoppedWatchingRef.current && !activeStreamId) {
      // Kullanıcı durdurdu, track'ler değişmediyse hiçbir şey yapma
      return;
    }

    // Track kaybolduysa (artık yoksa) null yap
    const isScreenTrack = screenTracks.find((t) => t.participant.identity === activeStreamId);
    const isCameraTrack = cameraTracks.find((t) => t.participant.identity === activeStreamId);

    if (activeStreamId && !isScreenTrack && !isCameraTrack) {
      userStoppedWatchingRef.current = false; // Track kayboldu, reset
      setActiveStreamId(null);
      return;
    }

    // YENİ: Otomatik seçim kaldırıldı - kullanıcılar manuel olarak yayına katılacak
    // Sadece kendi yayınını açan kişi için otomatik olarak kendi yayınını göster
    if (screenTracks.length > 0 && !activeStreamId) {
      const myScreenShare = screenTracks.find((t) => t.participant.isLocal);
      if (myScreenShare) {
        // Kendi yayınını açan kişi için otomatik olarak kendi yayınını göster
        userStoppedWatchingRef.current = false;
        setActiveStreamId(myScreenShare.participant.identity);
      }
      // Diğer kullanıcılar için otomatik seçim yok - manuel olarak katılmaları gerekiyor
    }
  }, [screenTracks, cameraTracks, activeStreamId, setActiveStreamId]);

  const isLocalSharing = activeTrack?.participant.isLocal;
  const [localPreviewHidden, setLocalPreviewHidden] = useState(false);
  useEffect(() => {
    if (!activeTrack) setLocalPreviewHidden(false);
  }, [activeTrack]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex overflow-hidden min-h-0 relative bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12]"
    >
      <MemoizedStageBackground 
        disableBackgroundEffects={useSettingsStore.getState().disableBackgroundEffects} 
        activeSpeakerColor={activeSpeakerColor}
      />
      {showVoicePanel && (
        <div
          className={`flex-1 overflow-y-auto custom-scrollbar min-w-0 flex flex-col transition-all duration-300 ease-in-out ${
            showChatPanel && currentTextChannel
              ? chatPosition === "left"
              ? "order-2"
              : "order-1"
              : ""
          }`}
          style={{
            width:
              showChatPanel && currentTextChannel
                ? `calc(100% - ${chatWidth}px - 4px)`
                : "100%",
            flexShrink: 1,
          }}
        >
          {screenTracks.length > 1 && activeStreamId && (
            <div className="bg-[#1e1f22] p-2 flex gap-2 overflow-x-auto border-b border-[#111214] shrink-0">
              {screenTracks.map((t) => (
                <button
                  key={t.participant.sid}
                  onClick={() => {
                    setActiveStreamId(t.participant.identity);
                    setLocalPreviewHidden(false);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${
                    activeStreamId === t.participant.identity
                      ? "bg-[#5865f2] text-white"
                      : "bg-[#2b2d31] text-[#949ba4] hover:text-white"
                  }`}
                >
                  <Monitor size={12} />
                  {t.participant.isLocal
                    ? "Senin Yayının"
                    : (t.participant.name || t.participant.identity)}
                </button>
              ))}
            </div>
          )}
          {activeTrack ? (
            isLocalSharing && localPreviewHidden ? (
              <LocalHiddenPlaceholder
                onShow={() => setLocalPreviewHidden(false)}
                onStopSharing={async () => {
                  // stopScreenShare fonksiyonunu kullan (daha güvenilir)
                  if (stopScreenShare) {
                    await stopScreenShare();
                  } else {
                    // Fallback: Eski yöntem
                    try {
                      if (activeTrack.track) {
                        activeTrack.track.stop();
                      }
                      // Publication kontrolü yap
                      if (activeTrack.participant && activeTrack.track) {
                        try {
                          await activeTrack.participant.unpublishTrack(
                            activeTrack.track
                          );
                        } catch (error) {
                          // Publication zaten yoksa veya başka bir hata varsa sessizce devam et
                          if (process.env.NODE_ENV === "development") {
                            console.warn(
                              "Track unpublish hatası (normal olabilir):",
                              error
                            );
                          }
                        }
                      }
                    } catch (error) {
                      console.error("Yayını durdurma hatası:", error);
                    }
                  }
                }}
              />
            ) : (
              <ScreenShareStage
                trackRef={activeTrack}
                onStopWatching={() => {
                  console.log(
                    "🛑 onStopWatching çağrıldı, activeStreamId null yapılıyor"
                  );
                  userStoppedWatchingRef.current = true; // Kullanıcı manuel olarak durdurdu
                  setActiveStreamId(null);
                }}
                onUserContextMenu={onUserContextMenu}
                isLocalSharing={isLocalSharing}
                amISharing={amISharing}
                onHideLocal={() => setLocalPreviewHidden(true)}
                setActiveStreamId={setActiveStreamId}
                activeStreamId={activeStreamId}
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 relative transition-all duration-300 ease-in-out" style={{ opacity: 1, transform: 'scale(1)' }}>
              <ParticipantList
                onUserContextMenu={onUserContextMenu}
                compact={false}
                hideIncomingVideo={hideIncomingVideo}
                setActiveStreamId={setActiveStreamId}
                activeStreamId={activeStreamId}
              />
            </div>
          )}
        </div>
      )}
      {/* Chat Panel - Always rendered, animated with transform */}
      <div
        className={`overflow-hidden border-[#26272d] bg-[#313338] flex flex-col min-w-0 shadow-xl z-10 transition-all duration-300 ease-in-out ${
          chatPosition === "left" ? "order-1 border-r" : "order-2 border-l"
        } ${
          showChatPanel && currentTextChannel
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        style={{
          width: showChatPanel && currentTextChannel ? `${chatWidth}px` : "0px",
          flexShrink: 0,
          transform: showChatPanel && currentTextChannel 
            ? "translateX(0)" 
            : chatPosition === "left" 
              ? "translateX(-20px)" 
              : "translateX(20px)",
        }}
      >
        {currentTextChannel && (
          <>
            {/* Resizable Divider */}
            {showVoicePanel && showChatPanel && (
              <div
                onMouseDown={handleResizeStart}
                className={`absolute ${chatPosition === "left" ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#26272d] hover:bg-[#5865f2] cursor-col-resize transition-colors z-20 ${
                  isResizing ? "bg-[#5865f2]" : ""
                }`}
                style={{ userSelect: "none" }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-12 bg-[#5865f2] rounded-full opacity-0 hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            )}
            <ChatView
              channelId={currentTextChannel}
              username={username}
              userId={userId}
            />
          </>
        )}
      </div>
      {!showVoicePanel && (!showChatPanel || !currentTextChannel) && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#313338]">
          <Users size={32} className="opacity-50 mb-4" />
          <p>Görünüm gizli.</p>
        </div>
      )}
    </div>
  );
}

function LocalHiddenPlaceholder({ onShow, onStopSharing }) {
  return (
    <div className="flex flex-col h-full w-full bg-[#313338] items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#313338] to-[#313338]"></div>
      <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="w-28 h-28 glass-strong rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/10 backdrop-blur-xl relative">
          <EyeOff size={44} className="text-[#949ba4]" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Önizleme Gizlendi
        </h2>
        <p className="text-gray-400 text-sm max-w-sm mb-10 leading-relaxed">
          Yayının devam ediyor. Performansı artırmak ve ayna etkisini önlemek
          için önizlemeyi kapattın.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onShow}
            className="glass-strong hover:glass border border-white/10 hover:border-white/20 text-white px-6 py-3 rounded-xl font-semibold shadow-soft-lg transition-all duration-200 flex items-center gap-2.5 hover:scale-105 hover:shadow-glow backdrop-blur-xl group"
          >
            <Eye
              size={18}
              className="group-hover:scale-110 transition-transform"
            />
            <span>Önizlemeyi Aç</span>
          </button>
          <button
            onClick={onStopSharing}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-soft-lg transition-all duration-200 flex items-center gap-2.5 hover:scale-105 hover:shadow-glow-red border border-red-500/30 group"
          >
            <StopCircle
              size={18}
              className="group-hover:scale-110 transition-transform"
            />
            <span>Yayını Durdur</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- STAGE OVERLAY COMPONENTS ---
const StageOverlay = React.memo(({ showOverlay, showCursor, isLocalSharing, isAudioDisabled, volume, isFullscreen, viewerCount, participant, trackRef, onStopWatching, onHideLocal, toggleMuteStream, toggleFullscreen, togglePip, showPip, cameraTracks, pipParticipant, setVolume }) => {
  return (
    <>
      {/* Overlay Gradients - Top and Bottom only (Center remains clear) */}
      <div
        className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-500 pointer-events-none will-change-opacity ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-500 pointer-events-none will-change-opacity ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Top Bar - Premium Design */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 sm:p-6 z-50 pointer-events-none">
        <div
          className={`flex items-center gap-2 sm:gap-3 backdrop-blur-md bg-white/[0.08] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/[0.12] shadow-xl transition-all duration-500 pointer-events-auto hover:scale-105 will-change-transform ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-red-500 rounded-xl blur-md opacity-75 animate-pulse" />
            <div className="relative bg-red-500 px-2.5 sm:px-3 py-1 rounded-xl text-[10px] sm:text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Canlı
            </div>
          </div>
          <span className="text-white font-bold drop-shadow-lg text-sm sm:text-base tracking-tight">
            {isLocalSharing
              ? "Senin Yayının"
              : trackRef.source === Track.Source.ScreenShare
              ? `${participant?.name || participant?.identity || "Kullanıcı"} yayını`
              : `${participant?.name || participant?.identity || "Kullanıcı"} kamerası`}
          </span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          {isLocalSharing && (
            <button
              onClick={onHideLocal}
              className={`backdrop-blur-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
                showOverlay ? "opacity-100" : "opacity-0"
              }`}
            >
              <EyeOff size={18} />
            </button>
          )}
          {trackRef.source !== Track.Source.Camera && cameraTracks.some(t => t.participant.identity === pipParticipant?.identity) && (
            <button
              onClick={togglePip}
              className={`backdrop-blur-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
                showOverlay ? "opacity-100" : "opacity-0"
              } ${showPip ? "bg-indigo-500/20 border-indigo-500/50" : ""}`}
            >
              {showPip ? <Layers size={18} /> : <Monitor size={18} />}
            </button>
          )}
          <button
            onClick={onStopWatching}
            className={`backdrop-blur-md bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.12] text-white/70 hover:text-red-400 p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
              showOverlay ? "opacity-100" : "opacity-0"
            }`}
          >
            <Minimize size={18} />
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-end p-6 transition-all duration-500 pointer-events-none will-change-opacity ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto flex justify-between items-end gap-4">
          <div className="flex items-center gap-2 bg-[#2b2d31]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-soft">
            <Users size={14} className="text-indigo-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#949ba4] font-medium">İzleyici</span>
              <span className="text-xs font-bold text-white">{viewerCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isLocalSharing && (
              <div className="flex items-center gap-3">
                {isAudioDisabled ? (
                  <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold px-3 py-1.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <AlertTriangle size={18} />
                    <span>Ses Kapalı</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={toggleMuteStream}
                      className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-110 border border-white/10 backdrop-blur-sm ${
                        volume === 0 ? "text-red-400" : "text-white"
                      }`}
                    >
                      {volume === 0 ? <VolumeX size={20} /> : volume < 50 ? <Volume1 size={20} /> : <Volume2 size={20} />}
                    </button>
                    <div className="w-0 hover:w-36 overflow-hidden transition-all duration-300 flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-32"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl border border-white/10 text-white hover:bg-indigo-500/20 transition-all duration-200 hover:scale-110 backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
});

function ScreenShareStage({
  trackRef,
  onStopWatching,
  onUserContextMenu,
  isLocalSharing,
  onHideLocal,
  amISharing,
  setActiveStreamId,
  activeStreamId,
}) {
  const [showPip, setShowPip] = useState(false);
  const { disableBackgroundEffects, cameraMirrorEffect } = useSettingsStore();
  const pipGridRef = useRef(null);
  
  const [volume, setVolume] = useState(50);
  const [prevVolume, setPrevVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const mouseMoveTimeoutRef = useRef(null);
  const cursorTimeoutRef = useRef(null);


  const participants = useParticipants();
  const viewerCount = Math.max(0, participants.length - 1);
  const participant = trackRef?.participant;
  const audioTracks = useTracks([Track.Source.ScreenShareAudio]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const audioTrackRef = audioTracks.find(
    (t) => t.participant.sid === participant?.sid
  );
  const isAudioDisabled = amISharing && !isLocalSharing;

  // Filter valid camera tracks for PiP Grid
  const validCameraTracks = useMemo(() => {
    return cameraTracks.filter(t => t.publication && !t.publication.isMuted);
  }, [cameraTracks]);

  // PiP camera data - moved from inline IIFE to top level to follow Rules of Hooks
  const pipParticipant = trackRef?.participant;
  const pipTrackRef = cameraTracks.find(t => t.participant.identity === pipParticipant?.identity);
  const hasPipCamera = pipTrackRef && pipTrackRef.publication?.isSubscribed;

  useEffect(() => {
    if (audioTrackRef?.publication?.track && audioRef.current) {
      audioTrackRef.publication.track.attach(audioRef.current);
    }
    return () => {
      if (audioTrackRef?.publication?.track && audioRef.current) {
        audioTrackRef.publication.track.detach(audioRef.current);
      }
    };
  }, [audioTrackRef]);

  useEffect(() => {
    if (audioRef.current) {
      // Agresif ses kapatma: tüm yöntemleri kullan
      if (volume === 0) {
        // 1. Audio element'i mute et
        audioRef.current.muted = true;
        // 2. Volume'u 0 yap
        audioRef.current.volume = 0;
        // 3. Audio element'i devre dışı bırak (ekstra güvenlik)
        audioRef.current.pause();
        // 4. Track'in mediaStreamTrack'ini de mute et (eğer varsa)
        if (audioTrackRef?.publication?.track?.mediaStreamTrack) {
          audioTrackRef.publication.track.mediaStreamTrack.enabled = false;
        }
      } else {
        // Ses açıldığında tüm kontrolleri geri al
        audioRef.current.muted = false;
        // Logaritmik (exponential) mapping: ses algısı logaritmik olduğu için
        // Linear mapping yerine exponential kullanıyoruz
        // Formül:
        // - 0-100%: volume = (percent/100)^2.5 (daha hassas düşük ses kontrolü)
        // - 100-200%: volume = 1.0 - (200-percent)/100 * 0.2 (100%'den 200%'e yumuşak artış, max 1.0)
        // NOT: HTMLMediaElement volume 0-1 aralığında olmalı, bu yüzden 1.0 ile sınırlıyoruz
        // %100-200 arası için daha hassas kontrol sağlamak için exponential mapping kullanıyoruz
        // 100% = 1.0, 150% = 0.9, 200% = 0.8 (daha yumuşak eğri)
        const mappedVolume =
          volume === 0
            ? 0
            : volume <= 100
            ? Math.pow(volume / 100, 2.5) // 0-100% arası için exponential
            : Math.min(1.0 - ((200 - volume) / 100) * 0.2, 1.0); // 100-200% arası için yumuşak artış, ama max 1.0 (HTMLMediaElement limiti)
        audioRef.current.volume = mappedVolume;
        audioRef.current.play().catch(() => {}); // AutoPlay policy nedeniyle hata olabilir, yoksay
        // Track'i tekrar aktif et
        if (audioTrackRef?.publication?.track?.mediaStreamTrack) {
          audioTrackRef.publication.track.mediaStreamTrack.enabled = true;
        }
      }
    }
  }, [volume, audioTrackRef]);

  // Handle PiP Toggle via Grid Component
  const togglePip = useCallback(() => {
    if (pipGridRef.current) {
      pipGridRef.current.togglePip();
      // We don't manually set showPip here because PipGrid manages its own state 
      // or we can sync it via a callback if needed, but for the button icon:
      // We can assume user intention.
      setShowPip(prev => !prev);
    }
  }, []);

  // Sync state with External Exit - Handled inside PipGrid largely, 
  // but if we want to sync the button icon perfectly we might need a callback.
  // For now, simple toggle is fine.

  const toggleMuteStream = () => {
    if (isAudioDisabled) return;
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 50);
    }
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Mouse movement tracking - overlay ve cursor kontrolü
  // 🚀 OPTIMIZATION: Throttle eklendi
  const lastOverlayMouseMoveRef = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = () => {
      // 🚀 THROTTLE: 200ms aralıklarla işle (CPU Optimizasyonu v5.3)
      const now = Date.now();
      if (now - lastOverlayMouseMoveRef.current < 200) return;
      lastOverlayMouseMoveRef.current = now;

      // Overlay'i göster
      setShowOverlay(true);
      setShowCursor(true);

      // Önceki timeout'ları temizle
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }

      // 2 saniye hareketsizlikten sonra overlay'i gizle
      mouseMoveTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 2000);

      // 2 saniye hareketsizlikten sonra cursor'u gizle
      cursorTimeoutRef.current = setTimeout(() => {
        setShowCursor(false);
      }, 800);
    };

    const handleMouseEnter = () => {
      setShowOverlay(true);
      setShowCursor(true);
    };

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseenter", handleMouseEnter);
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12] relative overflow-hidden">
      {/* Ambient background orbs - Conditional Rendering */}
      {!disableBackgroundEffects && (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[60px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[50px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>
      )}

      <div
        ref={containerRef}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          !showCursor ? "cursor-none" : ""
        }`}
        style={{ cursor: showCursor ? "default" : "none" }}
      >
        <VideoTrack
          trackRef={trackRef}
          className="max-w-full max-h-full object-contain shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          style={{
            // Kamera track'i için ayna efekti uygula (sadece local participant ve kamera için)
            transform: trackRef.source === Track.Source.Camera && trackRef.participant?.isLocal && cameraMirrorEffect 
              ? 'scaleX(-1)' 
              : undefined,
          }}
        />
        {!isLocalSharing && trackRef.source === Track.Source.ScreenShare && <audio ref={audioRef} autoPlay />}

        <StageOverlay 
            showOverlay={showOverlay}
            showCursor={showCursor}
            isLocalSharing={isLocalSharing}
            isAudioDisabled={isAudioDisabled}
            volume={volume}
            isFullscreen={isFullscreen}
            viewerCount={viewerCount}
            participant={participant}
            trackRef={trackRef}
            onStopWatching={onStopWatching}
            onHideLocal={onHideLocal}
            toggleMuteStream={toggleMuteStream}
            toggleFullscreen={toggleFullscreen}
            togglePip={togglePip}
            showPip={showPip}
            cameraTracks={cameraTracks}
            pipParticipant={pipParticipant}
            setVolume={setVolume}
        />
      </div>
      {!isFullscreen && (
        <div className="h-36 bg-gradient-to-t from-[#1e1f22]/95 via-[#25272a]/90 to-[#1e1f22]/95 p-3 flex gap-3 overflow-x-auto custom-scrollbar border-t border-white/10 shrink-0 backdrop-blur-md">
          <ParticipantList
            onUserContextMenu={onUserContextMenu}
            compact={true}
            setActiveStreamId={setActiveStreamId}
            activeStreamId={activeStreamId}
          />
        </div>
      )}
    </div>
  );
}

export default StageManager;
