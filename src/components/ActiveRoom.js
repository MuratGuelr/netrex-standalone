import { useEffect, useState, useRef, useMemo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useParticipantInfo,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  VideoTrack,
  AudioTrack,
} from "@livekit/components-react";
import { Track, RoomEvent, VideoPresets } from "livekit-client";
import "@livekit/components-styles";
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  PhoneOff,
  MessageSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Monitor,
  MonitorOff,
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  Volume1,
  Layers,
  StopCircle,
  Tv,
  AlertTriangle,
  Video,
  VideoOff,
  CameraOff,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import ChatView from "./ChatView";
import UserContextMenu from "./UserContextMenu";
import ScreenShareModal from "./ScreenShareModal";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useVoiceProcessor } from "@/src/hooks/useVoiceProcessor";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";

// --- STYLES ---
const styleInjection = `
  @keyframes pulse-ring { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
  .speaking-avatar { animation: pulse-ring 2s infinite; }
  .volume-slider { -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; }
  .volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; cursor: pointer; }
`;

// --- MIKROFON YÖNETİCİSİ ---
function MicrophoneManager() {
  const audioTracks = useTracks([Track.Source.Microphone]);
  const { userVolumes } = useSettingsStore();
  return (
    <>
      {audioTracks.map((trackRef) => (
        <AudioTrack
          key={trackRef.publication.trackSid}
          trackRef={trackRef}
          volume={(userVolumes[trackRef.participant.identity] ?? 100) / 100}
        />
      ))}
    </>
  );
}

// --- GLOBAL CHAT & EVENTS ---
function GlobalChatListener({ showChatPanel }) {
  const room = useRoomContext();
  const { incrementUnread, currentChannel } = useChatStore();
  const { user } = useAuthStore();
  const { playSound } = useSoundEffects();
  useEffect(() => {
    if (!room) return;
    const handleData = (payload, participant, kind, topic) => {
      if (topic !== "chat") return;
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "chat" && data.message.userId !== user?.uid) {
          if (
            !currentChannel ||
            currentChannel.id !== data.channelId ||
            !showChatPanel
          ) {
            incrementUnread(data.channelId);
            playSound("message");
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => room.off(RoomEvent.DataReceived, handleData);
  }, [room, currentChannel, incrementUnread, user, showChatPanel, playSound]);
  return null;
}

function VoiceProcessorHandler() {
  const { rawAudioMode } = useSettingsStore();
  if (!rawAudioMode) useVoiceProcessor();
  return null;
}
function RoomEventsHandler() {
  const room = useRoomContext();
  const { playSound } = useSoundEffects();
  useEffect(() => {
    if (!room) return;
    const onJoin = () => playSound("join");
    const onLeave = () => playSound("someone-left");
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room, playSound]);
  return null;
}
function DeafenManager({ isDeafened }) {
  useEffect(() => {
    const muteAll = () => {
      document.querySelectorAll("audio").forEach((el) => {
        el.muted = isDeafened;
      });
    };
    muteAll();
    const obs = new MutationObserver(muteAll);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isDeafened]);
  return null;
}
function useAudioActivity(participant) {
  const [isActive, setIsActive] = useState(false);
  const { isMuted } = useParticipantInfo({ participant });
  useEffect(() => {
    if (isMuted) {
      setIsActive(false);
      return;
    }
    let ctx, analyser, raf;
    const setup = (track) => {
      if (!track?.mediaStreamTrack) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const src = ctx.createMediaStreamSource(
          new MediaStream([track.mediaStreamTrack])
        );
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setIsActive(sum / data.length > 5);
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {}
    };
    if (participant.isLocal) {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) setup(pub.track);
    } else {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) setup(pub.track);
      participant.on(RoomEvent.TrackSubscribed, (t) => setup(t));
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ctx && ctx.state !== "closed") ctx.close();
    };
  }, [participant, isMuted]);
  return isActive;
}

// --- ANA BİLEŞEN ---
export default function ActiveRoom({
  roomName,
  username,
  onLeave,
  currentTextChannel,
  userId,
}) {
  const [token, setToken] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hideIncomingVideo, setHideIncomingVideo] = useState(false);

  const [showVoicePanel, setShowVoicePanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatPosition, setChatPosition] = useState("right");
  const [contextMenu, setContextMenu] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState(null);

  const { noiseSuppression, echoCancellation, autoGainControl } =
    useSettingsStore();
  const { playSound } = useSoundEffects();

  useEffect(() => {
    if (currentTextChannel) setShowChatPanel(true);
  }, [currentTextChannel]);
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (window.netrex) {
          const t = await window.netrex.getLiveKitToken(roomName, username);
          setToken(t);
        }
      } catch (e) {
        console.error(e);
        onLeave();
      }
    })();
  }, [roomName, username]);

  const handleManualLeave = () => {
    playSound("left");
    onLeave();
  };
  const handleDisconnect = () => {
    setIsReconnecting(true);
  };
  useEffect(() => {
    if (token) playSound("join");
  }, [token]);
  const handleUserContextMenu = (e, participant) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      participant,
      isLocal: participant.isLocal,
    });
  };

  if (!token)
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#313338] gap-4">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Kanala Bağlanılıyor...</span>
      </div>
    );

  return (
    <LiveKitRoom
      video={isCameraOn}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      className="flex-1 flex flex-col bg-[#313338]"
      onDisconnected={handleDisconnect}
      connectOptions={{ autoSubscribe: true, dynacast: true }}
      options={{
        audioCaptureDefaults: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
        // VARSAYILAN KOTA DOSTU AYARLAR
        videoCaptureDefaults: {
          resolution: { width: 640, height: 360 }, // Max 360p
          maxBitrate: 200_000, // 200 kbps limit
          deviceId: "",
        },
        reconnect: true,
      }}
    >
      <GlobalChatListener showChatPanel={showChatPanel} />
      <VoiceProcessorHandler />
      <RoomEventsHandler />
      <MicrophoneManager />

      {isReconnecting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <h2 className="text-xl font-bold">Bağlantı Koptu</h2>
          <button
            onClick={handleManualLeave}
            className="mt-6 px-6 py-2 bg-red-600 rounded hover:bg-red-700 transition"
          >
            Vazgeç ve Çık
          </button>
        </div>
      )}

      <style>{styleInjection}</style>
      <RoomAudioRenderer />
      <DeafenManager isDeafened={isDeafened} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <div className="h-12 bg-[#313338] flex items-center px-4 justify-between shrink-0 shadow-sm border-b border-[#26272d] z-20 select-none">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 size={24} className="text-[#80848e] flex-shrink-0" />
            <span className="text-white font-bold text-base tracking-tight truncate">
              {roomName}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-[#3f4147] mx-1 hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-2 cursor-help group">
            <div className="flex items-end gap-[2px] h-3">
              <div className="w-[3px] h-1 bg-[#23a559] rounded-sm"></div>
              <div className="w-[3px] h-2 bg-[#23a559] rounded-sm"></div>
              <div className="w-[3px] h-3 bg-[#23a559] rounded-sm"></div>
            </div>
            <span className="text-xs font-bold text-[#23a559]">Bağlandı</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          <button
            onClick={() => setHideIncomingVideo(!hideIncomingVideo)}
            className={`p-1.5 rounded transition-all ${
              hideIncomingVideo
                ? "bg-red-500/20 text-red-500"
                : "text-[#b5bac1] hover:text-[#dbdee1]"
            }`}
            title="Gelen kameraları kapat (Veri tasarrufu)"
          >
            {hideIncomingVideo ? <CameraOff size={20} /> : <Video size={20} />}
          </button>
          <div className="w-[1px] h-6 bg-[#3f4147] hidden md:block"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVoicePanel(!showVoicePanel)}
              className={`p-1.5 rounded transition-all ${
                showVoicePanel
                  ? "text-[#dbdee1]"
                  : "text-[#b5bac1] hover:text-[#dbdee1]"
              }`}
            >
              <Users
                size={22}
                className={showVoicePanel ? "fill-[#dbdee1]" : ""}
              />
            </button>
            {currentTextChannel && (
              <button
                onClick={() => setShowChatPanel(!showChatPanel)}
                className={`p-1.5 rounded transition-all ${
                  showChatPanel
                    ? "text-[#dbdee1]"
                    : "text-[#b5bac1] hover:text-[#dbdee1]"
                }`}
              >
                <MessageSquare
                  size={22}
                  className={showChatPanel ? "fill-[#dbdee1]" : ""}
                />
              </button>
            )}
            {showVoicePanel && showChatPanel && currentTextChannel && (
              <button
                onClick={() =>
                  setChatPosition(chatPosition === "right" ? "left" : "right")
                }
                className="text-[#b5bac1] hover:text-[#dbdee1] p-1 ml-1"
              >
                {chatPosition === "right" ? (
                  <ChevronLeft size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <StageManager
        showVoicePanel={showVoicePanel}
        showChatPanel={showChatPanel}
        currentTextChannel={currentTextChannel}
        chatPosition={chatPosition}
        username={username}
        userId={userId}
        onUserContextMenu={handleUserContextMenu}
        activeStreamId={activeStreamId}
        setActiveStreamId={setActiveStreamId}
        hideIncomingVideo={hideIncomingVideo}
      />

      <BottomControls
        username={username}
        onLeave={handleManualLeave}
        onOpenSettings={() => setShowSettings(true)}
        isDeafened={isDeafened}
        setIsDeafened={setIsDeafened}
        playSound={playSound}
        setActiveStreamId={setActiveStreamId}
        isCameraOn={isCameraOn}
        setIsCameraOn={setIsCameraOn}
      />
      {contextMenu && (
        <UserContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          participant={contextMenu.participant}
          isLocal={contextMenu.isLocal}
          onClose={() => setContextMenu(null)}
        />
      )}
    </LiveKitRoom>
  );
}

function StageManager({
  showVoicePanel,
  showChatPanel,
  currentTextChannel,
  chatPosition,
  username,
  userId,
  onUserContextMenu,
  activeStreamId,
  setActiveStreamId,
  hideIncomingVideo,
}) {
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const activeTrack = activeStreamId
    ? screenTracks.find((t) => t.participant.identity === activeStreamId)
    : null;
  const { localParticipant } = useLocalParticipant();
  const amISharing = localParticipant.isScreenShareEnabled;

  useEffect(() => {
    if (screenTracks.length > 0 && !activeStreamId)
      setActiveStreamId(screenTracks[0].participant.identity);
    if (
      activeStreamId &&
      !screenTracks.find((t) => t.participant.identity === activeStreamId)
    )
      setActiveStreamId(null);
  }, [screenTracks, activeStreamId, setActiveStreamId]);

  const isLocalSharing = activeTrack?.participant.isLocal;
  const [localPreviewHidden, setLocalPreviewHidden] = useState(false);
  useEffect(() => {
    if (!activeTrack) setLocalPreviewHidden(false);
  }, [activeTrack]);

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 relative bg-black">
      {showVoicePanel && (
        <div
          className={`flex-1 overflow-y-auto custom-scrollbar min-w-0 flex flex-col ${
            showChatPanel && currentTextChannel
              ? chatPosition === "left"
                ? "order-2"
                : "order-1"
              : ""
          }`}
          style={{
            flexBasis: showChatPanel && currentTextChannel ? "60%" : "100%",
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
                    : t.participant.identity}
                </button>
              ))}
            </div>
          )}
          {activeTrack ? (
            isLocalSharing && localPreviewHidden ? (
              <LocalHiddenPlaceholder
                onShow={() => setLocalPreviewHidden(false)}
                onStopSharing={() => {
                  activeTrack.track?.stop();
                  activeTrack.participant.unpublishTrack(activeTrack.track);
                }}
              />
            ) : (
              <ScreenShareStage
                trackRef={activeTrack}
                onStopWatching={() => setActiveStreamId(null)}
                onUserContextMenu={onUserContextMenu}
                isLocalSharing={isLocalSharing}
                amISharing={amISharing}
                onHideLocal={() => setLocalPreviewHidden(true)}
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
              {screenTracks.length > 0 && (
                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                  <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-[#2b2d31]">
                    <div className="text-[10px] uppercase font-bold text-[#949ba4] mb-1 px-1">
                      Canlı Yayınlar
                    </div>
                    {screenTracks.map((t) => (
                      <button
                        key={t.participant.sid}
                        onClick={() =>
                          setActiveStreamId(t.participant.identity)
                        }
                        className="bg-[#5865f2] hover:bg-[#4752c4] text-white w-full px-4 py-2 rounded-md shadow-sm text-sm font-bold flex items-center gap-2 mb-1"
                      >
                        <Tv size={14} />{" "}
                        {t.participant.isLocal
                          ? "Yayınına Dön"
                          : `${t.participant.identity} izle`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <ParticipantList
                onUserContextMenu={onUserContextMenu}
                compact={false}
                hideIncomingVideo={hideIncomingVideo}
              />
            </div>
          )}
        </div>
      )}
      {showChatPanel && currentTextChannel && (
        <div
          className={`flex-1 overflow-hidden border-[#26272d] bg-[#313338] flex flex-col min-w-0 shadow-xl z-10 ${
            chatPosition === "left" ? "order-1 border-r" : "order-2 border-l"
          }`}
          style={{ flexBasis: showVoicePanel ? "40%" : "100%" }}
        >
          <ChatView
            channelId={currentTextChannel}
            username={username}
            userId={userId}
          />
        </div>
      )}
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
        <div className="w-24 h-24 bg-[#2b2d31] rounded-full flex items-center justify-center mb-6 shadow-xl border border-[#3f4147]">
          <EyeOff size={40} className="text-[#949ba4]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Önizleme Gizlendi</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-8">
          Yayının devam ediyor.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onShow}
            className="bg-[#2b2d31] hover:bg-[#35373c] text-white px-6 py-2.5 rounded font-medium shadow-md transition flex items-center gap-2"
          >
            <Eye size={18} /> Önizlemeyi Aç
          </button>
          <button
            onClick={onStopSharing}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded font-medium shadow-md transition flex items-center gap-2"
          >
            <StopCircle size={18} /> Yayını Durdur
          </button>
        </div>
      </div>
    </div>
  );
}

function ScreenShareStage({
  trackRef,
  onStopWatching,
  onUserContextMenu,
  isLocalSharing,
  onHideLocal,
  amISharing,
}) {
  const [volume, setVolume] = useState(50);
  const [prevVolume, setPrevVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  const participants = useParticipants();
  const viewerCount = Math.max(0, participants.length - 1);
  const participant = trackRef?.participant;
  const audioTracks = useTracks([Track.Source.ScreenShareAudio]);
  const audioTrackRef = audioTracks.find(
    (t) => t.participant.sid === participant?.sid
  );
  const isAudioDisabled = amISharing && !isLocalSharing;

  useEffect(() => {
    if (audioTrackRef?.publication?.track && audioRef.current)
      audioTrackRef.publication.track.attach(audioRef.current);
    return () => {
      if (audioTrackRef?.publication?.track && audioRef.current)
        audioTrackRef.publication.track.detach(audioRef.current);
    };
  }, [audioTrackRef]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = volume === 0;
    }
  }, [volume]);

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

  return (
    <div className="flex flex-col h-full w-full bg-black">
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center bg-black group overflow-hidden"
      >
        <VideoTrack
          trackRef={trackRef}
          className="max-w-full max-h-full object-contain shadow-2xl"
        />
        {!isLocalSharing && <audio ref={audioRef} autoPlay />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-[#5865f2] px-3 py-1 rounded text-xs font-bold text-white shadow-md uppercase">
                Canlı
              </div>
              <span className="text-white font-semibold drop-shadow-md text-lg">
                {isLocalSharing
                  ? "Senin Yayının"
                  : `${participant?.identity} yayını`}
              </span>
            </div>
            <div className="flex gap-2">
              {isLocalSharing && (
                <button
                  onClick={onHideLocal}
                  className="bg-black/50 hover:bg-black/80 text-gray-300 hover:text-white p-2 rounded-full backdrop-blur-md transition-colors"
                  title="Önizlemeyi Gizle"
                >
                  <EyeOff size={20} />
                </button>
              )}
              <button
                onClick={onStopWatching}
                className="bg-black/50 hover:bg-red-500/80 text-gray-300 hover:text-white p-2 rounded-full backdrop-blur-md transition-colors"
                title="İzlemeyi Durdur"
              >
                <Minimize size={20} />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 text-gray-300 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">
              <Users size={16} />
              <span className="text-sm font-bold">{viewerCount} izliyor</span>
            </div>
            <div className="flex items-center gap-4 bg-black/60 p-2 rounded-lg backdrop-blur-md">
              {!isLocalSharing && (
                <div className="flex items-center gap-2 group/vol">
                  {isAudioDisabled ? (
                    <div
                      className="flex items-center gap-2 text-yellow-500 text-xs font-bold px-2"
                      title="Ses döngüsünü önlemek için ses kapatıldı."
                    >
                      <AlertTriangle size={16} />
                      <span className="hidden group-hover/vol:inline">
                        Ses Kapalı
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={toggleMuteStream}
                        className="text-white hover:text-indigo-400 transition"
                        title={volume === 0 ? "Sesi Aç" : "Sesi Kapat"}
                      >
                        {volume === 0 ? (
                          <VolumeX size={20} />
                        ) : volume < 50 ? (
                          <Volume1 size={20} />
                        ) : (
                          <Volume2 size={20} />
                        )}
                      </button>
                      <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={(e) => setVolume(Number(e.target.value))}
                          className="volume-slider w-20 ml-2"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {!isLocalSharing && !isAudioDisabled && (
                <div className="w-[1px] h-5 bg-white/20"></div>
              )}
              {!isLocalSharing ? (
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-indigo-400 transition"
                  title="Tam Ekran"
                >
                  {isFullscreen ? (
                    <Minimize size={20} />
                  ) : (
                    <Maximize size={20} />
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-gray-400 px-2 select-none cursor-default">
                  Önizleme
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {!isFullscreen && (
        <div className="h-32 bg-[#1e1f22] p-2 flex gap-2 overflow-x-auto custom-scrollbar border-t border-[#111214] shrink-0">
          <ParticipantList
            onUserContextMenu={onUserContextMenu}
            compact={true}
          />
        </div>
      )}
    </div>
  );
}

// --- KATILIMCI LİSTESİ ---
function ParticipantList({ onUserContextMenu, compact, hideIncomingVideo }) {
  const participants = useParticipants();
  const count = participants.length;
  if (count === 0) return null;
  if (compact) {
    return participants.map((p) => (
      <div key={p.sid} className="min-w-[140px] h-full">
        <UserCard
          participant={p}
          totalCount={count}
          onContextMenu={(e) => onUserContextMenu(e, p)}
          compact={true}
          hideIncomingVideo={hideIncomingVideo}
        />
      </div>
    ));
  }
  let gridClass = "";
  if (count === 1)
    gridClass = "grid-cols-1 w-full max-w-[800px] aspect-video max-h-[600px]";
  else if (count === 2)
    gridClass = "grid-cols-1 md:grid-cols-2 w-full max-w-[1000px] gap-4";
  else if (count <= 4) gridClass = "grid-cols-2 w-full max-w-[900px] gap-4";
  else if (count <= 6)
    gridClass = "grid-cols-2 md:grid-cols-3 w-full max-w-[1100px] gap-4";
  else gridClass = "grid-cols-3 md:grid-cols-4 w-full max-w-[1200px] gap-3";
  return (
    <div
      className={`grid ${gridClass} items-center justify-center content-center w-full`}
    >
      {participants.map((p) => (
        <div key={p.sid} className="w-full h-full aspect-[16/9] min-h-[180px]">
          <UserCard
            participant={p}
            totalCount={count}
            onContextMenu={(e) => onUserContextMenu(e, p)}
            hideIncomingVideo={hideIncomingVideo}
          />
        </div>
      ))}
    </div>
  );
}

function UserCard({
  participant,
  totalCount,
  onContextMenu,
  compact,
  hideIncomingVideo,
}) {
  const { identity, metadata } = useParticipantInfo({ participant });
  const audioActive = useAudioActivity(participant);
  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);
  const userColor = remoteState.profileColor || "#6366f1";
  const isMuted = remoteState.isMuted;
  const isSpeaking = audioActive && !isMuted && !remoteState.isDeafened;
  const avatarSize = compact
    ? "w-10 h-10 text-base"
    : totalCount <= 2
    ? "w-28 h-28 text-4xl"
    : "w-16 h-16 text-xl";

  const videoTrack = useTracks([Track.Source.Camera]).find(
    (t) => t.participant.sid === participant.sid
  );
  const shouldShowVideo =
    videoTrack &&
    !hideIncomingVideo &&
    (participant.isLocal || videoTrack.isSubscribed);

  return (
    <div
      onContextMenu={onContextMenu}
      className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center transition-all duration-300 overflow-hidden group cursor-context-menu ${
        isSpeaking
          ? "speaking-card border-[3px] shadow-lg bg-[#2b2d31]"
          : "bg-[#2b2d31] hover:bg-[#32343a] border-[3px] border-transparent"
      }`}
      style={{
        borderColor: isSpeaking
          ? userColor.includes("gradient")
            ? "#fff"
            : userColor
          : "transparent",
        boxShadow: isSpeaking
          ? userColor.includes("gradient")
            ? `0 0 25px rgba(255,255,255,0.2)`
            : `0 0 25px ${userColor}40`
          : "none",
      }}
    >
      <div className="relative mb-2 w-full h-full flex flex-col items-center justify-center">
        {shouldShowVideo ? (
          <VideoTrack
            trackRef={videoTrack}
            className="w-full h-full object-cover absolute inset-0"
          />
        ) : (
          <div
            className={`${avatarSize} rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10 relative transition-transform duration-200 group-hover:scale-105 ${
              isSpeaking
                ? "speaking-avatar ring-4 ring-offset-2 ring-offset-[#2b2d31]"
                : isMuted || remoteState.isDeafened
                ? "bg-gray-600 ring-4 ring-red-500/30 grayscale"
                : ""
            }`}
            style={{
              background:
                isMuted || remoteState.isDeafened ? undefined : userColor,
              "--tw-ring-color": isSpeaking
                ? userColor.includes("gradient")
                  ? "#fff"
                  : userColor
                : undefined,
            }}
          >
            {identity?.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          className={`absolute ${
            shouldShowVideo ? "bottom-2 right-2" : "-bottom-1 -right-1"
          } z-20`}
        >
          {remoteState.isDeafened ? (
            <div className="w-5 h-5 bg-[#2b2d31] rounded-full flex items-center justify-center border-[2px] border-[#2b2d31]">
              <div className="w-full h-full bg-red-500 rounded-full flex items-center justify-center">
                <VolumeX size={10} className="text-white fill-white" />
              </div>
            </div>
          ) : isMuted ? (
            <div className="w-5 h-5 bg-[#2b2d31] rounded-full flex items-center justify-center border-[2px] border-[#2b2d31]">
              <div className="w-full h-full bg-red-500 rounded-full flex items-center justify-center">
                <MicOff size={10} className="text-white" />
              </div>
            </div>
          ) : isSpeaking && !shouldShowVideo ? (
            <div className="w-5 h-5 bg-[#2b2d31] rounded-full flex items-center justify-center border-[2px] border-[#2b2d31]">
              <div
                className="w-full h-full rounded-full flex items-center justify-center animate-pulse"
                style={{ background: userColor }}
              >
                <Mic size={10} className="text-white fill-white" />
              </div>
            </div>
          ) : null}
        </div>
        <div
          className={`absolute bottom-2 left-2 z-10 max-w-[80%] ${
            shouldShowVideo
              ? "bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm"
              : ""
          }`}
        >
          <span
            className={`font-bold text-white tracking-wide truncate block ${
              compact ? "text-xs" : "text-base"
            }`}
          >
            {identity}
          </span>
        </div>
      </div>
      {!shouldShowVideo && isSpeaking && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{ background: userColor, opacity: 0.08 }}
        ></div>
      )}
    </div>
  );
}

// --- ALT KONTROLLER ---
function BottomControls({
  username,
  onLeave,
  onOpenSettings,
  isDeafened,
  setIsDeafened,
  playSound,
  setActiveStreamId,
  isCameraOn,
  setIsCameraOn,
}) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setMuted] = useState(false);
  const { profileColor } = useSettingsStore();
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const stateRef = useRef({
    isMuted,
    isDeafened,
    localParticipant,
    profileColor,
    isCameraOn,
  });
  useEffect(() => {
    stateRef.current = {
      isMuted,
      isDeafened,
      localParticipant,
      profileColor,
      isCameraOn,
    };
  }, [isMuted, isDeafened, localParticipant, profileColor, isCameraOn]);

  useEffect(() => {
    let mounted = true;
    const updateStatus = async () => {
      if (!localParticipant) return;
      try {
        const newMetadata = JSON.stringify({
          isDeafened,
          isMuted,
          profileColor,
        });
        if (localParticipant.metadata === newMetadata) return;
        await localParticipant.setMetadata(newMetadata);
      } catch (error) {
        console.warn("Metadata error:", error);
      }
    };
    updateStatus();
    return () => {
      mounted = false;
    };
  }, [isDeafened, isMuted, localParticipant, profileColor]);

  const toggleMute = () => {
    const { isMuted, isDeafened, localParticipant } = stateRef.current;
    if (isDeafened) return;
    const newState = !isMuted;
    setMuted(newState);
    if (localParticipant) localParticipant.setMicrophoneEnabled(!newState);
    playSound(newState ? "mute" : "unmute");
  };
  const toggleDeaf = () => {
    const { isDeafened, isMuted, localParticipant } = stateRef.current;
    const newState = !isDeafened;
    setIsDeafened(newState);
    playSound(newState ? "deafen" : "undeafen");
    if (newState) {
      if (!isMuted) {
        setMuted(true);
        if (localParticipant) localParticipant.setMicrophoneEnabled(false);
      }
    } else {
      setMuted(false);
      if (localParticipant) localParticipant.setMicrophoneEnabled(true);
    }
  };
  const toggleCamera = async () => {
    const { isCameraOn, localParticipant } = stateRef.current;
    const newState = !isCameraOn;
    setIsCameraOn(newState);
    // OPTİMİZASYON: 360p, 15fps, 150kbps, NO SIMULCAST
    await localParticipant.setCameraEnabled(newState, {
      resolution: { width: 640, height: 360 },
      frameRate: 15,
      maxBitrate: 150000,
      simulcast: false,
    });
  };

  const startScreenShare = async ({ resolution, fps, sourceId, withAudio }) => {
    try {
      const { width, height } =
        resolution === 1080
          ? { width: 1920, height: 1080 }
          : resolution === 720
          ? { width: 1280, height: 720 }
          : { width: 854, height: 480 };
      const constraints = {
        audio: withAudio
          ? { mandatory: { chromeMediaSource: "desktop" } }
          : false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
            minWidth: width,
            maxWidth: width,
            minHeight: height,
            maxHeight: height,
            minFrameRate: fps,
            maxFrameRate: fps,
          },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.contentHint = fps > 15 ? "motion" : "detail";
      const maxBitrate = fps > 15 ? 1200000 : 400000;
      await localParticipant.publishTrack(videoTrack, {
        name: "screen_share_video",
        source: Track.Source.ScreenShare,
        videoCodec: "vp8",
        simulcast: true,
        videoEncoding: { maxBitrate, maxFramerate: fps },
      });
      const audioTrack = stream.getAudioTracks()[0];
      if (withAudio && audioTrack) {
        await localParticipant.publishTrack(audioTrack, {
          name: "screen_share_audio",
          source: Track.Source.ScreenShareAudio,
          disableDtx: false,
        });
        videoTrack.onended = () => {
          localParticipant.unpublishTrack(videoTrack);
          if (audioTrack) {
            audioTrack.stop();
            localParticipant.unpublishTrack(audioTrack);
          }
        };
      } else {
        videoTrack.onended = () => {
          localParticipant.unpublishTrack(videoTrack);
        };
      }
      setActiveStreamId(localParticipant.identity);
    } catch (e) {
      console.error("Screen share error:", e);
      alert("Ekran paylaşımı başlatılamadı: " + e.message);
    }
  };

  const stopScreenShare = async () => {
    const tracks = localParticipant.getTrackPublications();
    for (const trackPub of tracks) {
      if (
        trackPub.source === Track.Source.ScreenShare ||
        trackPub.source === Track.Source.ScreenShareAudio
      ) {
        if (trackPub.track) trackPub.track.stop();
        await localParticipant.unpublishTrack(trackPub.track);
      }
    }
  };
  useEffect(() => {
    const handleHotkey = (action) => {
      if (action === "toggle-mute") toggleMute();
      if (action === "toggle-deafen") toggleDeaf();
    };
    if (window.netrex) window.netrex.onHotkeyTriggered(handleHotkey);
    return () => {
      if (window.netrex) window.netrex.removeListener("hotkey-triggered");
    };
  }, [playSound]);

  return (
    <>
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onStart={startScreenShare}
      />
      <div className="h-[60px] bg-[#1e1f22] flex items-center px-4 justify-between shrink-0 select-none border-t border-[#1a1b1e]">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#23a559] flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#23a559] animate-pulse"></div>
              Ses Bağlı
            </span>
            <span className="text-[10px] text-gray-500">
              {localParticipant?.identity}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ControlButton
            isActive={!isMuted}
            activeIcon={<Mic size={20} />}
            inactiveIcon={<MicOff size={20} />}
            onClick={toggleMute}
            tooltip="Sustur"
            danger={isMuted}
            disabled={isDeafened}
          />
          <ControlButton
            isActive={!isDeafened}
            activeIcon={<Headphones size={20} />}
            inactiveIcon={<VolumeX size={20} />}
            onClick={toggleDeaf}
            tooltip="Sağırlaştır"
            danger={isDeafened}
          />
          <button
            onClick={toggleCamera}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition relative group ${
              isCameraOn
                ? "bg-white text-black hover:bg-gray-200"
                : "hover:bg-[#35373c] text-gray-200"
            }`}
            title={isCameraOn ? "Kamerayı Kapat" : "Kamerayı Aç"}
          >
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button
            onClick={
              isScreenSharing
                ? stopScreenShare
                : () => setShowScreenShareModal(true)
            }
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition relative group ${
              isScreenSharing
                ? "bg-green-600 text-white hover:bg-green-700"
                : "hover:bg-[#35373c] text-gray-200"
            }`}
            title={isScreenSharing ? "Paylaşımı Durdur" : "Ekran Paylaş"}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>
          <div className="w-[1px] h-6 bg-[#3f4147] mx-1"></div>
          <button
            onClick={onLeave}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:text-red-600 hover:bg-red-500/10 text-red-500 transition border border-transparent hover:border-red-500/20"
            title="Bağlantıyı Kes"
          >
            <PhoneOff size={20} />
          </button>
        </div>
        <div></div>
      </div>
    </>
  );
}

function ControlButton({
  isActive,
  activeIcon,
  inactiveIcon,
  onClick,
  tooltip,
  danger,
  disabled,
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition relative ${
        disabled
          ? "opacity-50 cursor-not-allowed text-red-500 bg-[#3f4147]"
          : danger
          ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
          : "hover:bg-[#35373c] text-gray-200"
      }`}
    >
      {isActive ? activeIcon : inactiveIcon}
      {disabled && (
        <div className="absolute w-full h-[2px] bg-red-500 rotate-45"></div>
      )}
    </button>
  );
}
