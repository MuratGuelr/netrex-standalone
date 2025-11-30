import { useEffect, useState, useRef, useMemo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useParticipantInfo,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Settings,
  PhoneOff,
  Signal,
  MessageSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  Volume2,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import ChatView from "./ChatView";
import UserContextMenu from "./UserContextMenu";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useVoiceProcessor } from "@/src/hooks/useVoiceProcessor";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";

// --- CSS Animasyonları ---
const styleInjection = `
  @keyframes pulse-ring {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
  }
  @keyframes card-glow {
    0% { border-color: rgba(74, 222, 128, 0.2); box-shadow: 0 0 10px rgba(74, 222, 128, 0.1); }
    50% { border-color: rgba(74, 222, 128, 0.8); box-shadow: 0 0 20px rgba(74, 222, 128, 0.2); }
    100% { border-color: rgba(74, 222, 128, 0.2); box-shadow: 0 0 10px rgba(74, 222, 128, 0.1); }
  }
  .speaking-avatar { animation: pulse-ring 2s infinite; }
  .speaking-card { background: linear-gradient(to bottom right, #2b2d31, #1e1f22); }
`;

// --- 1. GLOBAL CHAT LISTENER (Okunmamış Mesajlar & Ses) ---
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
          // Eğer o an o kanalda değilsek VEYA panel kapalıysa
          const isDifferentChannel =
            !currentChannel || currentChannel.id !== data.channelId;
          const isPanelClosed = !showChatPanel;

          if (isDifferentChannel || isPanelClosed) {
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

// --- 2. SES YÖNETİCİSİ (Volume Manager) ---
function VolumeManager() {
  const room = useRoomContext();
  const { userVolumes } = useSettingsStore();
  const tracks = useTracks([Track.Source.Microphone]);

  useEffect(() => {
    if (!room) return;
    tracks.forEach((trackRef) => {
      const { participant, publication } = trackRef;
      if (!participant.isLocal && publication.kind === Track.Kind.Audio) {
        const audioTrack = publication.track;
        if (audioTrack) {
          const volumeLevel = userVolumes[participant.identity] ?? 100;
          audioTrack.setVolume(volumeLevel / 100);
        }
      }
    });
  }, [tracks, userVolumes, room]);
  return null;
}

// --- 3. VOICE PROCESSOR HANDLER (PTT Çıkarıldı) ---
function VoiceProcessorHandler() {
  const { rawAudioMode } = useSettingsStore();
  // Sadece Ham Ses modu kapalıysa işlemciyi çalıştır
  if (!rawAudioMode) {
    useVoiceProcessor();
  }
  return null;
}

// --- 4. ROOM EVENTS (Giriş/Çıkış Sesleri) ---
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
    const muteAllAudio = () => {
      document.querySelectorAll("audio").forEach((el) => {
        el.muted = isDeafened;
      });
    };
    muteAllAudio();
    const obs = new MutationObserver(muteAllAudio);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isDeafened]);
  return null;
}

// Görsel Aktivite için (UserCard'da yeşil yanması için)
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
  const [showVoicePanel, setShowVoicePanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatPosition, setChatPosition] = useState("right");
  const [contextMenu, setContextMenu] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const { noiseSuppression, echoCancellation, autoGainControl } =
    useSettingsStore();
  const { playSound } = useSoundEffects();

  useEffect(() => {
    if (currentTextChannel) setShowChatPanel(true);
  }, [currentTextChannel]);
  useEffect(() => {
    const closeMenu = (e) => {
      setContextMenu(null);
    };
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

  const handleDisconnect = (reason) => {
    console.log("Bağlantı koptu:", reason);
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
      video={false}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      className="flex-1 flex flex-col bg-[#313338]"
      onDisconnected={handleDisconnect}
      options={{
        audioCaptureDefaults: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
        reconnect: true,
      }}
    >
      <GlobalChatListener showChatPanel={showChatPanel} />

      {/* PTT (MicControlManager) KALDIRILDI */}
      <VoiceProcessorHandler />
      <RoomEventsHandler />
      <VolumeManager />

      {isReconnecting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <h2 className="text-xl font-bold">Bağlantı Koptu</h2>
          <p className="text-gray-400">Tekrar bağlanılıyor...</p>
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

      {/* HEADER */}
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
            <span className="text-xs font-bold text-[#23a559] group-hover:underline">
              Bağlandı
            </span>
            <span className="text-[10px] text-[#949ba4] hidden group-hover:block ml-1">
              (RTC Bağlantısı)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          <div className="w-[1px] h-6 bg-[#3f4147] hidden md:block"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVoicePanel(!showVoicePanel)}
              className={`p-1.5 rounded transition-all relative group ${
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
                className={`p-1.5 rounded transition-all relative group ${
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

      {/* CONTENT */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative bg-black">
        {showVoicePanel && (
          <div
            className={`flex-1 overflow-y-auto custom-scrollbar min-w-0 ${
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
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <ParticipantList onUserContextMenu={handleUserContextMenu} />
            </div>
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
            <div className="w-16 h-16 bg-[#2b2d31] rounded-full flex items-center justify-center mb-4">
              <Users size={32} className="opacity-50" />
            </div>
            <p>Görünüm gizli.</p>
          </div>
        )}
      </div>

      <BottomControls
        username={username}
        onLeave={handleManualLeave}
        onOpenSettings={() => setShowSettings(true)}
        isDeafened={isDeafened}
        setIsDeafened={setIsDeafened}
        playSound={playSound}
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

function ParticipantList({ onUserContextMenu }) {
  const participants = useParticipants();
  const count = participants.length;
  if (count === 0) return null;
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
      className={`grid ${gridClass} items-center justify-center content-center`}
    >
      {participants.map((p) => (
        <div key={p.sid} className="w-full h-full aspect-[16/9] min-h-[180px]">
          <UserCard
            participant={p}
            totalCount={count}
            onContextMenu={(e) => onUserContextMenu(e, p)}
          />
        </div>
      ))}
    </div>
  );
}

function UserCard({ participant, totalCount, onContextMenu }) {
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
  const avatarSize =
    totalCount <= 2 ? "w-28 h-28 text-4xl" : "w-16 h-16 text-xl";

  return (
    <div
      onContextMenu={onContextMenu}
      className={`relative w-full h-full rounded-2xl flex flex-col items-center justify-center transition-all duration-300 overflow-hidden group cursor-context-menu ${
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
      <div className="relative mb-3">
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
        <div className="absolute -bottom-1 -right-1 z-20">
          {remoteState.isDeafened ? (
            <div className="w-8 h-8 bg-[#2b2d31] rounded-full flex items-center justify-center border-[3px] border-[#2b2d31]">
              <div className="w-full h-full bg-red-500 rounded-full flex items-center justify-center">
                <VolumeX size={14} className="text-white fill-white" />
              </div>
            </div>
          ) : isMuted ? (
            <div className="w-8 h-8 bg-[#2b2d31] rounded-full flex items-center justify-center border-[3px] border-[#2b2d31]">
              <div className="w-full h-full bg-red-500 rounded-full flex items-center justify-center">
                <MicOff size={14} className="text-white" />
              </div>
            </div>
          ) : isSpeaking ? (
            <div className="w-8 h-8 bg-[#2b2d31] rounded-full flex items-center justify-center border-[3px] border-[#2b2d31]">
              <div
                className="w-full h-full rounded-full flex items-center justify-center animate-pulse"
                style={{ background: userColor }}
              >
                <Mic size={14} className="text-white fill-white" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 z-10 max-w-[80%]">
        <span className="text-base font-bold text-white tracking-wide truncate w-full text-center drop-shadow-md">
          {identity}
        </span>
        {totalCount <= 6 && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-md text-gray-300"
            style={{
              background: isSpeaking
                ? userColor.includes("gradient")
                  ? "rgba(255,255,255,0.1)"
                  : `${userColor}30`
                : "rgba(0,0,0,0.2)",
            }}
          >
            {isSpeaking ? "Konuşuyor" : "Bağlı"}
          </span>
        )}
      </div>
      {isSpeaking && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{ background: userColor, opacity: 0.08 }}
        ></div>
      )}
    </div>
  );
}

function BottomControls({
  username,
  onLeave,
  onOpenSettings,
  isDeafened,
  setIsDeafened,
  playSound,
}) {
  const { localParticipant } = useLocalParticipant();
  const localMicActive = useAudioActivity(localParticipant);
  const [isMuted, setMuted] = useState(false);
  const { profileColor } = useSettingsStore();
  const stateRef = useRef({
    isMuted,
    isDeafened,
    localParticipant,
    profileColor,
  });

  useEffect(() => {
    stateRef.current = { isMuted, isDeafened, localParticipant, profileColor };
  }, [isMuted, isDeafened, localParticipant, profileColor]);

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
        if (localParticipant.connectionQuality === "unknown") {
          await new Promise((r) => setTimeout(r, 1000));
          if (!mounted) return;
        }
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
    <div className="h-[60px] bg-[#1e1f22] flex items-center px-4 justify-between shrink-0 select-none border-t border-[#1a1b1e]">
      <div></div>
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
