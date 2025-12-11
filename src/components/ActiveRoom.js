import { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
import {
  Track,
  RoomEvent,
  VideoPresets,
  ConnectionState,
  ConnectionQuality,
} from "livekit-client";
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
import { toastOnce, chatToast, systemToast } from "@/src/utils/toast";
import { useAuthStore } from "@/src/store/authStore";
import { db } from "@/src/lib/firebase";
import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { generateLiveKitIdentity } from "@/src/utils/deviceId";

// --- STYLES ---
const styleInjection = `
  @keyframes pulse-ring { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
  .speaking-avatar { animation: pulse-ring 2s infinite; }
  .volume-slider { -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; }
  .volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; cursor: pointer; }
  
  /* Bottom Controls Animations */
  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }
  @keyframes pulse-border {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
    }
  }
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  @keyframes camera-active {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
    }
    50% {
      box-shadow: 0 0 20px 5px rgba(255, 255, 255, 0.2);
    }
  }
  @keyframes screen-share-active {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
    }
    50% {
      box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.3);
    }
  }
  @keyframes pulse-slow {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
  }
  .animate-ripple {
    animation: ripple 0.6s ease-out;
  }
  .animate-pulse-border {
    animation: pulse-border 2s ease-in-out infinite;
  }
  .animate-shimmer {
    animation: shimmer 3s linear infinite;
  }
  .animate-camera-active {
    animation: camera-active 2s ease-in-out infinite;
  }
  .animate-screen-share-active {
    animation: screen-share-active 2s ease-in-out infinite;
  }
  .animate-pulse-slow {
    animation: pulse-slow 4s ease-in-out infinite;
  }
  
  /* User Card Animations */
  @keyframes user-card-active {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.01);
    }
  }
  @keyframes pulse-border-video {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes avatar-pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
  @keyframes pulse-glow-slow {
    0%, 100% {
      opacity: 0.1;
      transform: scale(1);
    }
    50% {
      opacity: 0.2;
      transform: scale(1.02);
    }
  }
  .animate-user-card-active {
    animation: user-card-active 3s ease-in-out infinite;
  }
  .animate-pulse-border-video {
    animation: pulse-border-video 2s ease-in-out infinite;
  }
  .animate-avatar-pulse {
    animation: avatar-pulse 2s ease-in-out infinite;
  }
  .animate-pulse-glow-slow {
    animation: pulse-glow-slow 3s ease-in-out infinite;
  }
  
  /* Speaking Background Animations */
  @keyframes speaking-glow {
    0%, 100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
  }
  @keyframes speaking-pulse-ring {
    0% {
      opacity: 0.4;
      transform: scale(0.95);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
    100% {
      opacity: 0.4;
      transform: scale(0.95);
    }
  }
  @keyframes speaking-corner-glow {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    25% {
      opacity: 0.6;
      transform: scale(1.1);
    }
    50% {
      opacity: 0.4;
      transform: scale(1.05);
    }
    75% {
      opacity: 0.7;
      transform: scale(1.15);
    }
  }
  .animate-speaking-glow {
    animation: speaking-glow 2s ease-in-out infinite;
  }
  .animate-speaking-pulse-ring {
    animation: speaking-pulse-ring 3s ease-in-out infinite;
  }
  .animate-speaking-corner-glow {
    animation: speaking-corner-glow 4s ease-in-out infinite;
  }
`;

// --- MIKROFON YÖNETİCİSİ ---
function MicrophoneManager() {
  const audioTracks = useTracks([Track.Source.Microphone]);
  const { userVolumes } = useSettingsStore();
  return (
    <>
      {audioTracks.map((trackRef) => {
        // Volume sadece remote track'lere ayarlanabilir (local track'e ayarlanamaz)
        const isRemote = !trackRef.participant.isLocal;
        // userVolumes 0-200 arasında olabilir, ama AudioTrack 0-1 aralığı bekliyor
        // Ses algısı logaritmik olduğu için exponential mapping kullanıyoruz
        const volumePercent = isRemote
          ? userVolumes[trackRef.participant.identity] ?? 100
          : undefined;

        // Logaritmik (exponential) mapping: ses algısı logaritmik olduğu için
        // Linear mapping yerine exponential kullanıyoruz
        // Formül:
        // - 0-100%: volume = (percent/100)^2.5 (daha hassas düşük ses kontrolü)
        // - 100-200%: volume = 1.0 - (200-percent)/100 * 0.2 (100%'den 200%'e yumuşak artış, max 1.0)
        // NOT: HTMLMediaElement volume 0-1 aralığında olmalı, bu yüzden 1.0 ile sınırlıyoruz
        // %100-200 arası için daha hassas kontrol sağlamak için exponential mapping kullanıyoruz
        // 100% = 1.0, 150% = 0.9, 200% = 0.8 (daha yumuşak eğri)
        const volume =
          volumePercent !== undefined
            ? volumePercent === 0
              ? 0 // 0% = 0 (sessiz)
              : volumePercent <= 100
              ? Math.pow(volumePercent / 100, 2.5) // 0-100% arası için exponential
              : Math.min(1.0 - ((200 - volumePercent) / 100) * 0.2, 1.0) // 100-200% arası için yumuşak artış, ama max 1.0 (HTMLMediaElement limiti)
            : undefined;

        return (
          <AudioTrack
            key={trackRef.publication.trackSid}
            trackRef={trackRef}
            {...(isRemote && { volume })} // Sadece remote track'lere volume prop'u ekle
          />
        );
      })}
    </>
  );
}

// --- GLOBAL CHAT & EVENTS ---
function GlobalChatListener({ showChatPanel, setShowChatPanel }) {
  const room = useRoomContext();
  const { incrementUnread, currentChannel, textChannels, loadChannelMessages } =
    useChatStore();
  const { user } = useAuthStore();
  const { playSound } = useSoundEffects();
  const { desktopNotifications, notifyOnMessage } = useSettingsStore();

  useEffect(() => {
    if (!room) return;
    const handleData = (payload, participant, kind, topic) => {
      if (topic !== "chat") return;
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "chat" && data.message.userId !== user?.uid) {
          const message = data.message;
          const channelId = data.channelId;
          // Mesajın geldiği kanalın adını bul
          const messageChannel = textChannels.find((ch) => ch.id === channelId);
          const channelName = messageChannel?.name || "sohbet";

          // Toast bildirim göster (uygulama içindeyse VE sohbet paneli kapalıysa)
          if (
            typeof document !== "undefined" &&
            !document.hidden &&
            document.hasFocus() &&
            !showChatPanel // Sohbet paneli açıksa toast gösterme
          ) {
            chatToast({
              username: message.username || "Bir kullanıcı",
              message: message.text,
              channelName: channelName,
              avatarColor: message.profileColor,
              onClick: () => {
                // Tıklanınca sohbet panelini aç ve mesajın geldiği kanala git
                if (setShowChatPanel) {
                  setShowChatPanel(true);
                }
                // Mesajın geldiği kanala geç
                if (channelId && channelId !== currentChannel?.id) {
                  loadChannelMessages(channelId);
                }
              },
            });
          }

          // Masaüstü bildirim göster (ayarlardan açtıysa)
          if (desktopNotifications && notifyOnMessage) {
            if (typeof window !== "undefined" && "Notification" in window) {
              if (Notification.permission === "granted") {
                // Pencere arka plandaysa VEYA sohbet paneli kapalıysa masaüstü bildirim göster
                const isAppInBackground =
                  typeof document !== "undefined" &&
                  (document.hidden || !document.hasFocus());
                const shouldNotify = isAppInBackground || !showChatPanel;

                if (shouldNotify) {
                  const body = message.text
                    ? message.text.length > 120
                      ? message.text.slice(0, 120) + "..."
                      : message.text
                    : "Yeni mesaj";

                  try {
                    const notification = new Notification(
                      `${
                        message.username || "Bir kullanıcı"
                      } - #${channelName}`,
                      {
                        body: body,
                        icon: "/favicon.ico",
                        badge: "/favicon.ico",
                        tag: `message-${channelId}-${Date.now()}`,
                        silent: false,
                      }
                    );

                    // Bildirime tıklanınca pencereyi focus et ve sohbeti aç
                    notification.onclick = () => {
                      if (window.netrex?.focusWindow) {
                        window.netrex.focusWindow();
                      } else {
                        window.focus();
                      }
                      // Sohbet panelini aç
                      if (setShowChatPanel) {
                        setShowChatPanel(true);
                      }
                      // Mesajın geldiği kanala geç
                      if (channelId && channelId !== currentChannel?.id) {
                        loadChannelMessages(channelId);
                      }
                      notification.close();
                    };

                    // 5 saniye sonra otomatik kapat
                    setTimeout(() => notification.close(), 5000);
                  } catch (error) {
                    console.error("Masaüstü bildirim hatası:", error);
                  }
                }
              }
            }
          }

          if (
            !currentChannel ||
            currentChannel.id !== channelId ||
            !showChatPanel
          ) {
            incrementUnread(channelId);
            playSound("message");
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => room.off(RoomEvent.DataReceived, handleData);
  }, [
    room,
    currentChannel,
    incrementUnread,
    user,
    showChatPanel,
    setShowChatPanel,
    playSound,
    desktopNotifications,
    notifyOnMessage,
    textChannels,
    loadChannelMessages,
  ]);
  return null;
}

function VoiceProcessorHandler() {
  const { rawAudioMode } = useSettingsStore();
  if (!rawAudioMode) useVoiceProcessor();
  return null;
}

// Mikrofon ve kamera ayarları değiştiğinde track'leri yeniden oluştur
function SettingsUpdater() {
  const { localParticipant } = useLocalParticipant();
  const {
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode, // EKLENDI
  } = useSettingsStore();

  const prevSettingsRef = useRef({
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode, // EKLENDI
  });
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // localParticipant yoksa bekle
    if (!localParticipant) {
      return;
    }

    // İlk render'da sadece ref'i güncelle
    if (!prevSettingsRef.current.audioInputId) {
      prevSettingsRef.current = {
        audioInputId,
        videoId,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        noiseSuppressionMode,
      };
      return;
    }

    // Ayarlar değişmediyse hiçbir şey yapma
    const audioSettingsChanged =
      prevSettingsRef.current.audioInputId !== audioInputId ||
      prevSettingsRef.current.noiseSuppression !== noiseSuppression ||
      prevSettingsRef.current.echoCancellation !== echoCancellation ||
      prevSettingsRef.current.autoGainControl !== autoGainControl ||
      prevSettingsRef.current.noiseSuppressionMode !== noiseSuppressionMode;

    const videoSettingsChanged = prevSettingsRef.current.videoId !== videoId;

    if (
      (!audioSettingsChanged && !videoSettingsChanged) ||
      isUpdatingRef.current
    ) {
      prevSettingsRef.current = {
        audioInputId,
        videoId,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        noiseSuppressionMode,
      };
      return;
    }

    // Ayarlar değişti, track'leri yeniden oluştur
    const updateTracks = async () => {
      isUpdatingRef.current = true;
      try {
        // Mikrofon ayarları değiştiyse mikrofon track'ini güncelle
        if (audioSettingsChanged) {
          const micPublication = localParticipant.getTrackPublication(
            Track.Source.Microphone
          );

          if (micPublication?.track) {
            const oldTrack = micPublication.track;

            // ÖNEMLİ: Eğer yapay zeka (krisp) veya standart gürültü engelleme açıksa,
            // tarayıcının kendi native gürültü engellemesini KAPAT.
            // İkisi birden çalışırsa ses kesilir ("alo" -> "lo" sorunu).
            const shouldUseNativeNoiseSuppression = 
              noiseSuppression && (noiseSuppressionMode === "none" || !noiseSuppressionMode);

            // Yeni constraint'lerle mikrofon stream'i al
            const constraints = {
              audio: {
                deviceId:
                  audioInputId !== "default"
                    ? { exact: audioInputId }
                    : undefined,
                echoCancellation,
                noiseSuppression: shouldUseNativeNoiseSuppression,
                autoGainControl,
              },
            };

            const newStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const newTrack = newStream.getAudioTracks()[0];

            if (newTrack) {
              // Eski track'i unpublish et
              await localParticipant.unpublishTrack(oldTrack);

              // Eski track'i durdur
              oldTrack.stop();

              // Yeni track'i publish et
              await localParticipant.publishTrack(newTrack, {
                source: Track.Source.Microphone,
              });

              // Stream'deki diğer track'leri durdur
              newStream.getTracks().forEach((track) => {
                if (track !== newTrack) track.stop();
              });

              if (process.env.NODE_ENV === "development") {
                console.log("✅ Mikrofon ayarları güncellendi");
              }
            }
          }
        }

        // Video ayarları değiştiyse ve kamera açıksa video track'ini güncelle
        if (videoSettingsChanged) {
          const videoPublication = localParticipant.getTrackPublication(
            Track.Source.Camera
          );

          if (videoPublication?.track) {
            const oldTrack = videoPublication.track;

            // Yeni constraint'lerle video stream'i al
            const constraints = {
              video: {
                deviceId:
                  videoId !== "default" ? { exact: videoId } : undefined,
                width: { ideal: 320, max: 320 },
                height: { ideal: 240, max: 240 },
                frameRate: { ideal: 18, max: 18 },
              },
            };

            const newStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const newTrack = newStream.getVideoTracks()[0];

            if (newTrack) {
              // Eski track'i unpublish et
              await localParticipant.unpublishTrack(oldTrack);

              // Eski track'i durdur
              oldTrack.stop();

              // Yeni track'i publish et - Minimum bandwidth kullanımı
              const newPublication = await localParticipant.publishTrack(
                newTrack,
                {
                  source: Track.Source.Camera,
                  videoEncoding: {
                    maxBitrate: 50000, // 50kbps (minimum bandwidth)
                    maxFramerate: 18, // 18 fps
                  },
                  videoCodec: "vp8",
                  simulcast: false,
                }
              );

              // Track'in enabled olduğundan ve muted olmadığından emin ol
              if (newPublication.track) {
                newPublication.track.enabled = true;
                if (newPublication.track.mediaStreamTrack) {
                  newPublication.track.mediaStreamTrack.enabled = true;
                }
              }
              if (newPublication.isMuted) {
                await newPublication.setMuted(false);
              }

              // Stream'deki diğer track'leri durdur
              newStream.getTracks().forEach((track) => {
                if (track !== newTrack) track.stop();
              });

              if (process.env.NODE_ENV === "development") {
                console.log("✅ Kamera ayarları güncellendi");
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ Ayarlar güncellenirken hata:", error);
      } finally {
        isUpdatingRef.current = false;
        prevSettingsRef.current = {
          audioInputId,
          videoId,
          noiseSuppression,
          echoCancellation,
          autoGainControl,
        };
      }
    };

    updateTracks();
  }, [
    localParticipant,
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
  ]);

  return null;
}

// Bağlantı Durumu Göstergesi (Kalite)
function ConnectionStatusIndicator() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.Unknown
  );

  // Connection quality güncellemeleri
  useEffect(() => {
    if (!room || !localParticipant) return;

    const quality =
      localParticipant.connectionQuality || ConnectionQuality.Unknown;
    setConnectionQuality(quality);

    // Connection quality değişikliklerini dinle
    const handleConnectionQualityChanged = (quality, participant) => {
      if (participant.isLocal) {
        setConnectionQuality(quality);
      }
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);

    return () => {
      room.off(
        RoomEvent.ConnectionQualityChanged,
        handleConnectionQualityChanged
      );
    };
  }, [room, localParticipant]);

  // Kalite rengi ve metni
  const getQualityInfo = (quality) => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return { color: "#23a559", label: "Mükemmel", bars: 4 };
      case ConnectionQuality.Good:
        return { color: "#23a559", label: "İyi", bars: 3 };
      case ConnectionQuality.Poor:
        return { color: "#f0b232", label: "Zayıf", bars: 2 };
      case ConnectionQuality.Lost:
        return { color: "#da373c", label: "Kesildi", bars: 1 };
      default:
        return { color: "#80848e", label: "Bilinmiyor", bars: 0 };
    }
  };

  const qualityInfo = getQualityInfo(connectionQuality);

  // Room veya localParticipant yoksa hiçbir şey gösterme
  if (!room || !localParticipant) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 cursor-help group relative">
      {/* Bağlantı durumu container */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 group-hover:border-white/10 transition-all duration-300">
        {/* Bağlantı Kalitesi Çubukları */}
        <div className="flex items-end gap-[2px] h-3">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={`w-[3px] rounded-sm transition-all duration-300 ${
                bar <= qualityInfo.bars ? "" : "bg-[#2b2d31]"
              }`}
              style={{
                height: `${bar * 3}px`,
                backgroundColor:
                  bar <= qualityInfo.bars ? qualityInfo.color : undefined,
                boxShadow:
                  bar <= qualityInfo.bars
                    ? `0 0 4px ${qualityInfo.color}50`
                    : undefined,
              }}
            />
          ))}
        </div>

        {/* Kalite Metni */}
        <span
          className="text-[11px] font-semibold tracking-wide"
          style={{ color: qualityInfo.color }}
        >
          {qualityInfo.label}
        </span>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2.5 bg-[#0d0e10] border border-white/10 rounded-xl shadow-2xl text-xs text-[#dbdee1] opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 whitespace-nowrap z-50 backdrop-blur-xl">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-6">
            <span className="text-[#949ba4] font-medium">
              Bağlantı Kalitesi
            </span>
            <span className="font-bold" style={{ color: qualityInfo.color }}>
              {qualityInfo.label}
            </span>
          </div>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
          <div className="w-2 h-2 bg-[#0d0e10] border-r border-b border-white/10 rotate-45"></div>
        </div>
      </div>
    </div>
  );
}

function RoomEventsHandler({
  onConnected,
  onDisconnected,
  onError,
  roomName,
  userId,
  username,
}) {
  const room = useRoomContext();
  const { playSound } = useSoundEffects();
  const {
    desktopNotifications,
    notifyOnJoin,
    notifyOnLeave,
    notificationSound,
  } = useSettingsStore();
  const { user } = useAuthStore();

  // Bildirim izni kontrolü ve isteği
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default" && desktopNotifications) {
      // İzin henüz istenmemişse ve bildirimler açıksa, izin iste
      Notification.requestPermission().catch((error) => {
        console.error("Bildirim izni hatası:", error);
      });
    }
  }, [desktopNotifications]);

  // Bildirim gösterme fonksiyonu
  const showNotification = useCallback(
    (title, body, silent = false) => {
      if (!desktopNotifications) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") {
        // İzin yoksa sessizce devam et (kullanıcı reddetmiş olabilir)
        return;
      }

      // Eğer pencere aktifse bildirim gösterme
      if (document && !document.hidden && document.hasFocus()) return;

      try {
        const notification = new Notification(title, {
          body,
          icon: "/logo.ico",
          badge: "/logo.ico",
          tag: `netrex-${Date.now()}`, // Her bildirimi benzersiz yap
          silent: silent || !notificationSound,
        });

        // Bildirime tıklanınca pencereyi focus et
        notification.onclick = () => {
          if (window.netrex?.focusWindow) {
            window.netrex.focusWindow();
          } else {
            window.focus();
          }
          notification.close();
        };

        // 5 saniye sonra otomatik kapat
        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        console.error("Bildirim hatası:", error);
      }
    },
    [desktopNotifications, notificationSound]
  );

  useEffect(() => {
    if (!room) return;

    const onJoin = (participant) => {
      playSound("join");

      // Bildirim göster (sadece remote participant'lar için)
      if (
        notifyOnJoin &&
        participant &&
        !participant.isLocal &&
        participant.name !== user?.displayName
      ) {
        showNotification(
          "Kullanıcı Katıldı",
          `${participant.name || "Bir kullanıcı"} ${
            roomName ? `"${roomName}"` : ""
          } odasına katıldı`,
          false
        );
      }
    };

    const onLeave = (participant) => {
      playSound("someone-left");

      // Bildirim göster (sadece remote participant'lar için)
      if (
        notifyOnLeave &&
        participant &&
        !participant.isLocal &&
        participant.name !== user?.displayName
      ) {
        showNotification(
          "Kullanıcı Ayrıldı",
          `${participant.name || "Bir kullanıcı"} ${
            roomName ? `"${roomName}"` : ""
          } odasından ayrıldı`,
          false
        );
      }
    };

    // Bağlantı event'leri
    const onRoomConnected = () => {
      // Sadece development'ta log göster (spam'i önlemek için)
      if (process.env.NODE_ENV === "development") {
        console.log("Room connected");
      }
      if (onConnected) onConnected();
    };

    const onRoomDisconnected = (reason) => {
      // Her zaman log göster (önemli bir event)
      console.log("Room disconnected:", reason);
      if (onDisconnected) onDisconnected(reason);
    };

    const onRoomError = (error) => {
      console.error("Room error:", error);
      if (onError) onError(error);
    };

    // Video track publish/unpublish event'lerini dinle (debug için)
    const onTrackPublished = (pub) => {
      if (pub?.source === Track.Source.Camera && pub?.participant?.isLocal) {
        // Sadece development'ta log göster
        if (process.env.NODE_ENV === "development") {
          console.log("📹 Camera track published:", pub.trackSid);
        }
      }
    };

    const onTrackUnpublished = (pub) => {
      if (pub?.source === Track.Source.Camera && pub?.participant?.isLocal) {
        if (process.env.NODE_ENV === "development") {
          console.log("📹 Camera track unpublished");
        }
      }
    };

    // Remote participant'ların track'i subscribe ettiğinde
    const onTrackSubscribed = (track, publication, participant) => {
      if (publication?.source === Track.Source.Camera && participant) {
        if (process.env.NODE_ENV === "development") {
          if (participant.isLocal) {
            console.log(
              "📹 Local participant'ın camera track'i remote tarafından subscribe edildi:",
              {
                trackSid: publication.trackSid,
                subscriber: "remote participant",
              }
            );
          } else {
            console.log(
              "📹 Remote participant'ın camera track'i subscribe edildi:",
              {
                participant: participant.identity,
                trackSid: publication.trackSid,
              }
            );
          }
        }
      }
    };

    // Room state değişikliklerini izle (güvenli yöntem)
    let lastState = room?.state;
    const checkConnectionState = () => {
      if (!room) return;
      const currentState = room.state;
      // Sadece state gerçekten değiştiğinde işlem yap
      if (currentState !== lastState) {
        lastState = currentState;
        if (currentState === ConnectionState.Connected) {
          onRoomConnected();
        } else if (currentState === ConnectionState.Disconnected) {
          onRoomDisconnected("Connection state changed");
        }
      }
    };

    // İlk kontrol
    checkConnectionState();

    // Reconnecting ve Reconnected handler'larını sakla (cleanup için)
    const onReconnecting = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Room reconnecting...");
      }
    };
    const onReconnected = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Room reconnected");
      }
      if (onConnected) onConnected();
    };

    // Event'leri dinle
    room.on(RoomEvent.Connected, onRoomConnected);
    room.on(RoomEvent.Disconnected, onRoomDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.ConnectionStateChanged, checkConnectionState);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

    // Error event'leri
    if (room.on) {
      // LiveKit room error handling
      room.on("error", onRoomError);
    }

    return () => {
      room.off(RoomEvent.Connected, onRoomConnected);
      room.off(RoomEvent.Disconnected, onRoomDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.ConnectionStateChanged, checkConnectionState);
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      if (room.off) {
        room.off("error", onRoomError);
      }
    };
  }, [
    room,
    playSound,
    onConnected,
    onDisconnected,
    onError,
    roomName,
    desktopNotifications,
    notifyOnJoin,
    notifyOnLeave,
    notificationSound,
    showNotification,
    user,
  ]);

  // Uygulama kapatıldığında cleanup (beforeunload event + Electron IPC)
  useEffect(() => {
    const cleanup = async () => {
      // LiveKit room'u disconnect et
      if (room && room.state !== ConnectionState.Disconnected) {
        try {
          await room.disconnect();
          console.log("✅ LiveKit room disconnect edildi (app close)");
        } catch (error) {
          console.error("❌ LiveKit disconnect hatası:", error);
        }
      }

      // Firebase'den kullanıcıyı çıkar (keepalive ile gönder - async işlemler tamamlanabilir)
      if (userId && roomName && username) {
        try {
          const presenceRef = doc(db, "room_presence", roomName);
          // beforeunload'da async işlemler tamamlanmayabilir, bu yüzden fetch ile keepalive kullan
          const userData = { userId, username };
          // Firestore REST API ile cleanup (daha güvenilir)
          await updateDoc(presenceRef, {
            users: arrayRemove(userData),
          });
          console.log("✅ Firestore presence temizlendi (app close)");
        } catch (error) {
          // Document yoksa veya zaten silinmişse sessizce devam et
          if (error.code !== "not-found") {
            console.error("❌ Firestore cleanup hatası:", error);
          }
        }
      }
    };

    const handleBeforeUnload = async (e) => {
      // Cleanup'ı yap ve tamamlandığında main process'e bildir
      try {
        await cleanup();
        // Electron context'inde isek cleanup tamamlandı mesajı gönder
        if (
          typeof window !== "undefined" &&
          window.netrex?.notifyCleanupComplete
        ) {
          window.netrex.notifyCleanupComplete();
          console.log(
            "✅ Cleanup tamamlandı (beforeunload), main process'e bildirildi"
          );
        }
      } catch (error) {
        console.error("Cleanup hatası:", error);
        // Hata olsa bile main process'e bildir (eğer Electron context'inde isek)
        if (
          typeof window !== "undefined" &&
          window.netrex?.notifyCleanupComplete
        ) {
          window.netrex.notifyCleanupComplete();
        }
      }
    };

    // Electron IPC event listener
    let electronCleanupHandler = null;
    if (typeof window !== "undefined" && window.netrex?.onAppWillQuit) {
      electronCleanupHandler = async () => {
        console.log("🛑 App closing cleanup started...");
        try {
          // Parallelize cleanup tasks
          const cleanupPromise = (async () => {
            const tasks = [];
            
            // 1. LiveKit Disconnect
            if (room && room.state !== ConnectionState.Disconnected) {
              tasks.push(
                room.disconnect()
                  .then(() => console.log("✅ LiveKit room disconnect edildi (app close)"))
                  .catch((err) => console.error("❌ LiveKit disconnect hatası:", err))
              );
            }

            // 2. Firestore Cleanup
            if (userId && roomName && username) {
              const presenceRef = doc(db, "room_presence", roomName);
              const userData = { userId, username };
              tasks.push(
                updateDoc(presenceRef, { users: arrayRemove(userData) })
                  .then(() => console.log("✅ Firestore presence temizlendi (app close)"))
                  .catch((err) => {
                    if (err.code !== "not-found") {
                      console.error("❌ Firestore cleanup hatası:", err);
                    }
                  })
              );
            }

            if (tasks.length > 0) {
              await Promise.allSettled(tasks);
            }
          })();

          // Race with 2 second timeout
          await Promise.race([
            cleanupPromise,
            new Promise((resolve) => setTimeout(resolve, 2000))
          ]);
          
        } catch (error) {
          console.error("Electron cleanup hatası:", error);
        } finally {
          // Her durumda main process'e bildir
          console.log("🏁 Cleanup finished (or timed out), notifying main process");
          if (window.netrex?.notifyCleanupComplete) {
             window.netrex.notifyCleanupComplete();
          }
        }
      };
      window.netrex.onAppWillQuit(electronCleanupHandler);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (electronCleanupHandler && window.netrex?.removeListener) {
        window.netrex.removeListener("app-will-quit");
      }
    };
  }, [room, roomName, userId, username]);

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
    let currentTrack = null;
    let trackPublishedHandler = null;
    let retryCount = 0;
    const MAX_RETRIES = 15;

    const cleanup = () => {
      if (raf) {
        clearInterval(raf); // cancelAnimationFrame -> clearInterval
        raf = null;
      }
      if (ctx && ctx.state !== "closed") {
        try {
          ctx.close();
        } catch (e) {
          // Context zaten kapatılmış olabilir
        }
        ctx = null;
      }
      analyser = null;
      currentTrack = null;
    };

    const setup = (track) => {
      // Önceki setup'ı temizle
      cleanup();

      // Track kontrolü: track var mı, mediaStreamTrack var mı, audio track mi?
      if (!track?.mediaStreamTrack) return;
      if (track.mediaStreamTrack.kind !== "audio") return;

      // Track'in enabled olduğundan emin ol
      if (!track.mediaStreamTrack.enabled) return;

      // Track'in readyState'ini kontrol et
      if (track.mediaStreamTrack.readyState === "ended") return;

      currentTrack = track;

      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        // MediaStream oluştur ve audio track'i kontrol et
        const mediaStream = new MediaStream([track.mediaStreamTrack]);

        // MediaStream'in audio track'i olup olmadığını kontrol et
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
          cleanup();
          return;
        }

        // Audio track'in enabled olduğundan emin ol
        if (!audioTracks[0].enabled || audioTracks[0].readyState === "ended") {
          cleanup();
          return;
        }

        const src = ctx.createMediaStreamSource(mediaStream);
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        // CPU OPTİMİZASYONU: requestAnimationFrame yerine setInterval (200ms)
        const checkActivity = () => {
          // Track hala geçerli mi kontrol et
          if (
            !currentTrack ||
            !track.mediaStreamTrack ||
            track.mediaStreamTrack.readyState === "ended"
          ) {
            cleanup();
            setIsActive(false);
            return;
          }

          // MediaStream'in hala audio track'i var mı kontrol et
          if (mediaStream.getAudioTracks().length === 0) {
            cleanup();
            setIsActive(false);
            return;
          }

          try {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            // Eşik 5 -> 8 (daha hızlı kapanma), aralık 100ms -> 75ms (daha hızlı tepki)
            setIsActive(sum / data.length > 8);
          } catch (e) {
            // Analyser hatası - cleanup yap
            cleanup();
            setIsActive(false);
          }
        };
        
        // İlk kontrol
        checkActivity();
        // 75ms aralıklarla kontrol (CPU ve tepki dengesi)
        raf = setInterval(checkActivity, 75);
      } catch (e) {
        // Audio analiz hatası - sessizce yoksay (non-critical)
        cleanup();
        if (process.env.NODE_ENV === "development") {
          console.warn("Audio activity detection error:", e);
        }
      }
    };

    // Track subscription event handler
    const handleTrackSubscribed = (track, publication) => {
      if (publication?.source === Track.Source.Microphone && track) {
        // Kısa bir gecikme ile setup yap (track tam hazır olsun)
        setTimeout(() => {
          if (
            track.mediaStreamTrack &&
            track.mediaStreamTrack.readyState !== "ended"
          ) {
            setup(track);
          }
        }, 100);
      }
    };

    // Track published event handler
    const handleTrackPublished = (publication) => {
      if (
        publication?.source === Track.Source.Microphone &&
        publication.track
      ) {
        setTimeout(() => {
          if (
            publication.track?.mediaStreamTrack &&
            publication.track.mediaStreamTrack.readyState !== "ended"
          ) {
            setup(publication.track);
          }
        }, 200);
      }
    };

    // Track unpublished event handler
    const handleTrackUnpublished = (publication) => {
      if (publication?.source === Track.Source.Microphone) {
        cleanup();
        setIsActive(false);
      }
    };

    // Track'i bul ve setup yap
    const trySetup = () => {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) {
        setTimeout(() => {
          if (
            pub.track?.mediaStreamTrack &&
            pub.track.mediaStreamTrack.readyState !== "ended"
          ) {
            setup(pub.track);
          } else if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(trySetup, 300);
          }
        }, 100);
      } else if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(trySetup, 300);
      }
    };

    // İlk deneme
    trySetup();

    // Event listener'ları ekle
    if (trackPublishedHandler) {
      participant.off(RoomEvent.TrackPublished, trackPublishedHandler);
    }
    trackPublishedHandler = handleTrackPublished;
    participant.on(RoomEvent.TrackPublished, trackPublishedHandler);

    if (!participant.isLocal) {
      participant.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      participant.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    }

    return () => {
      cleanup();
      if (trackPublishedHandler) {
        participant.off(RoomEvent.TrackPublished, trackPublishedHandler);
      }
      if (!participant.isLocal) {
        participant.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        participant.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      }
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
  const {
    showChatPanel,
    setShowChatPanel,
    currentChannel,
    clearCurrentChannel,
  } = useChatStore();
  const [chatPosition, setChatPosition] = useState("right");
  const [chatWidth, setChatWidth] = useState(400); // Chat genişliği (pixel)
  const [contextMenu, setContextMenu] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false); // Bağlantı başarılı oldu mu?
  const connectionTimeoutRef = useRef(null); // Bağlantı timeout'u
  const hasConnectedOnceRef = useRef(false); // Ref ile takip (timeout için)

  const { noiseSuppression, echoCancellation, autoGainControl } =
    useSettingsStore();
  const { playSound } = useSoundEffects();

  // currentTextChannel null olduğunda paneli kapat
  useEffect(() => {
    if (!currentTextChannel && showChatPanel) {
      setShowChatPanel(false);
    }
  }, [currentTextChannel, showChatPanel, setShowChatPanel]);

  // currentTextChannel ile currentChannel senkronizasyonu
  useEffect(() => {
    if (currentTextChannel && currentChannel?.id !== currentTextChannel) {
      // currentTextChannel set edilmiş ama currentChannel farklıysa, currentChannel'ı güncelle
      // Bu durumda loadChannelMessages zaten çağrılmış olmalı, sadece kontrol ediyoruz
    } else if (!currentTextChannel && currentChannel) {
      // currentTextChannel null ama currentChannel set edilmişse, temizle
      clearCurrentChannel();
    }
  }, [currentTextChannel, currentChannel, clearCurrentChannel]);

  // Not: Metin kanalına tıklama artık RoomList'te handle ediliyor (toggle mantığı ile)
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    // Room değiştiğinde state'leri sıfırla (eski room'dan temiz çıkış için)
    setToken(""); // Token'ı sıfırla ki eski room'dan disconnect olsun
    setConnectionError(null);
    setIsReconnecting(false);
    setHasConnectedOnce(false);
    hasConnectedOnceRef.current = false;
    setActiveStreamId(null); // Aktif stream'i sıfırla
    setIsCameraOn(false); // Kamera durumunu sıfırla

    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    (async () => {
      try {
        if (window.netrex) {
          // Generate persistent identity using userId
          // This prevents ghost participants when users reconnect
          const identity = generateLiveKitIdentity(userId);
          
          // Get token with persistent identity and display name
          const t = await window.netrex.getLiveKitToken(roomName, identity, username);
          setToken(t);

          // 20 saniye içinde bağlantı kurulamazsa hata göster
          connectionTimeoutRef.current = setTimeout(() => {
            // Eğer hala bağlanmadıysa hata göster
            if (!hasConnectedOnceRef.current) {
              setConnectionError("Odaya bağlanılamadı. Lütfen tekrar deneyin.");
            }
          }, 20000); // 20 saniye
        }
      } catch (e) {
        console.error("Token alma hatası:", e);
        // Token alınamazsa hemen hata göster (bu farklı bir durum)
        setConnectionError("Token alınamadı. Lütfen tekrar deneyin.");
      }
    })();

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [roomName, username, userId]);

  // Component unmount veya room değiştiğinde cleanup
  useEffect(() => {
    return () => {
      // Component unmount olduğunda Firebase'den temizle - Optimize: cleanup
      if (userId && roomName) {
        const presenceRef = doc(db, "room_presence", roomName);
        updateDoc(presenceRef, {
          users: arrayRemove({ userId, username }),
        }).catch((error) => {
          // Document yoksa veya zaten silinmişse sessizce devam et
          if (error.code !== "not-found") {
            console.error("Room presence cleanup hatası (unmount):", error);
          }
        });
      }
    };
  }, [roomName, username, userId]);

  const handleManualLeave = async () => {
    playSound("left");

    // Firebase'den kullanıcıyı çıkar (room presence) - Optimize: timestamp yok
    if (userId && roomName) {
      try {
        const presenceRef = doc(db, "room_presence", roomName);
        await updateDoc(presenceRef, {
          users: arrayRemove({ userId, username }),
        });
      } catch (error) {
        console.error("Room presence çıkarma hatası:", error);
      }
    }

    onLeave();
  };

  // Bağlantı başarılı olduğunda
  const handleConnected = async () => {
    hasConnectedOnceRef.current = true;
    setHasConnectedOnce(true);
    setIsReconnecting(false);
    setConnectionError(null);
    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    console.log("LiveKit bağlantısı başarılı");

    // Firebase'e kullanıcıyı ekle (room presence) - Optimize: sadece userId ve username
    if (userId && roomName) {
      try {
        const presenceRef = doc(db, "room_presence", roomName);
        const userData = { userId, username };
        await updateDoc(presenceRef, {
          users: arrayUnion(userData),
        }).catch(async (error) => {
          // Document yoksa oluştur
          if (error.code === "not-found") {
            await setDoc(presenceRef, {
              users: [userData],
            });
          }
        });
      } catch (error) {
        console.error("Room presence ekleme hatası:", error);
      }
    }
  };

  // Bağlantı koptuğunda (sadece başarılı bağlantıdan sonra)
  const handleDisconnect = async (reason) => {
    console.log("LiveKit bağlantısı koptu:", reason);
    // Sadece başarılı bağlantıdan sonra koparsa "Bağlantı Koptu" göster
    if (hasConnectedOnce) {
      setIsReconnecting(true);
    }

    // Firebase'den kullanıcıyı çıkar (cleanup) - Optimize: bağlantı koptuğunda da temizle
    if (userId && roomName) {
      try {
        const presenceRef = doc(db, "room_presence", roomName);
        await updateDoc(presenceRef, {
          users: arrayRemove({ userId, username }),
        });
      } catch (error) {
        // Document yoksa veya zaten silinmişse sessizce devam et
        if (error.code !== "not-found") {
          console.error("Room presence cleanup hatası:", error);
        }
      }
    }
    // İlk bağlantı başarısız olduysa zaten timeout'ta hata gösterilecek
  };

  // Bağlantı hatası (sadece kritik hatalar için)
  const handleError = (error) => {
    console.error("LiveKit bağlantı hatası:", error);
    // Sadece başarılı bağlantıdan sonra hata olursa göster
    if (hasConnectedOnce) {
      setConnectionError(error?.message || "Bağlantı hatası oluştu.");
    }
    // İlk bağlantı hatasında sadece timeout'ta hata göster
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

  // Token yoksa loading göster
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0c] relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Spinner with glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
          
          {/* Text */}
          <div className="text-center">
            <p className="text-white font-semibold text-sm sm:text-base mb-1">Kanala Bağlanılıyor</p>
            <p className="text-[#5c5e66] text-xs sm:text-sm">Lütfen bekleyin...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      // KEY: roomName değiştiğinde component'i tamamen yeniden mount et (eski room'dan disconnect için)
      key={roomName}
      // DÜZELTME: video={false} yapıyoruz ki otomatik yönetim manuel fonksiyonumuzla çakışmasın.
      video={false}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      className="flex-1 flex flex-col bg-gradient-to-b from-[#1a1b1f] to-[#0e0f12]"
      // Quota-Efficient Connection Options
      connectOptions={{ 
        autoSubscribe: true, 
        // Adaptive streaming for lower bandwidth usage
        dynacast: true,
        // Faster participant timeout (seconds) - helps clear ghost participants quicker
        // Note: This affects server-side participant timeout
        peerConnectionTimeout: 10000, // 10 seconds to establish WebRTC connection
      }}
      // Room options for robust reconnection handling
      options={{
        audioCaptureDefaults: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
        // Enable automatic reconnection
        reconnect: true,
        // Disconnect cleanly when window closes
        disconnectOnPageLeave: true,
        // Stop tracks when disconnecting (prevents lingering audio)
        stopLocalTrackOnUnpublish: true,
        // Adaptive stream for bandwidth efficiency
        adaptiveStream: true,
      }}
      // Handle disconnect event immediately
      onDisconnected={(reason) => {
        console.log("🔌 LiveKitRoom disconnected:", reason);
      }}
    >
      <GlobalChatListener
        showChatPanel={showChatPanel}
        setShowChatPanel={setShowChatPanel}
      />
      <VoiceProcessorHandler />
      <SettingsUpdater />
      <RoomEventsHandler
        onConnected={handleConnected}
        onDisconnected={handleDisconnect}
        onError={handleError}
        roomName={roomName}
        userId={userId}
        username={username}
      />
      <MicrophoneManager />

      {/* LiveKit bağlantısı kurulana kadar loading overlay */}
      {!hasConnectedOnce && !connectionError && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md">
          {/* Animated background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Spinner with glow */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-14 h-14 border-[3px] border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
            
            {/* Text */}
            <h3 className="text-white font-semibold text-base sm:text-lg mb-2">Bağlantı Kuruluyor</h3>
            <p className="text-[#5c5e66] text-sm">Lütfen bekleyin...</p>
          </div>
        </div>
      )}

      {/* İlk bağlantı hatası (sadece timeout veya token hatası varsa) */}
      {connectionError && !hasConnectedOnce && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md p-4">
          {/* Animated background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[120px] animate-pulse" />
          </div>
          
          {/* Error Card */}
          <div className="relative z-10 w-full max-w-md">
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-xl opacity-60" />
            
            {/* Card */}
            <div className="relative bg-gradient-to-br from-[#1a1b1e]/95 to-[#111214]/95 backdrop-blur-xl rounded-2xl border border-red-500/20 p-6 sm:p-8 text-center">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/20">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h2 className="text-xl font-bold mb-2 text-white">Bağlantı Hatası</h2>
              <p className="text-[#949ba4] mb-6 text-sm">{connectionError}</p>
              
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => {
                    setConnectionError(null);
                    setHasConnectedOnce(false);
                    hasConnectedOnceRef.current = false;
                    if (window.netrex) {
                      const identity = generateLiveKitIdentity(userId);
                      window.netrex
                        .getLiveKitToken(roomName, identity, username)
                        .then((t) => {
                          setToken(t);
                          if (connectionTimeoutRef.current) {
                            clearTimeout(connectionTimeoutRef.current);
                          }
                          connectionTimeoutRef.current = setTimeout(() => {
                            if (!hasConnectedOnceRef.current) {
                              setConnectionError("Odaya bağlanılamadı. Lütfen tekrar deneyin.");
                            }
                          }, 20000);
                        })
                        .catch((e) => {
                          console.error("Token hatası:", e);
                          setConnectionError("Token alınamadı. Lütfen tekrar deneyin.");
                        });
                    }
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-medium text-white text-sm hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Tekrar Dene
                </button>
                <button
                  onClick={handleManualLeave}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl font-medium text-[#949ba4] text-sm hover:bg-white/10 hover:text-white transition-all duration-200"
                >
                  Çık
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bağlantı koptu (başarılı bağlantıdan sonra) */}
      {isReconnecting && hasConnectedOnce && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md p-4">
          {/* Animated background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Pulsing icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 flex items-center justify-center border border-amber-500/20 animate-pulse">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Bağlantı Koptu</h2>
            <p className="text-[#949ba4] mb-6 text-sm">Yeniden bağlanmaya çalışılıyor...</p>
            
            <button
              onClick={handleManualLeave}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 rounded-xl font-medium text-white text-sm hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Vazgeç ve Çık
            </button>
          </div>
        </div>
      )}

      <style>{styleInjection}</style>
      <RoomAudioRenderer />
      <DeafenManager isDeafened={isDeafened} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* ÜST BAR - Premium Glassmorphism Tasarım */}
      <div className="h-14 sm:h-16 relative flex items-center px-4 sm:px-6 justify-between shrink-0 z-20 select-none overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1b1f]/95 via-[#141518]/95 to-[#0e0f12]/95 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
        
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[200px] h-[80px] bg-indigo-500/[0.06] blur-[60px]" />
          <div className="absolute top-0 right-1/4 w-[200px] h-[80px] bg-purple-500/[0.04] blur-[60px]" />
        </div>

        {/* Top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        
        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-pulse-slow" />
        </div>

        {/* Sol taraf - Kanal bilgisi */}
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden relative z-10 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 group">
            {/* Kanal icon container - Premium */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent flex items-center justify-center border border-indigo-500/20 shadow-lg backdrop-blur-sm group-hover:border-indigo-500/40 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)] group-hover:scale-105">
                <Volume2
                  size={18}
                  className="text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300"
                />
              </div>
              {/* Online pulse indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-[#1a1b1f] to-[#0e0f12] rounded-full flex items-center justify-center shadow-lg">
                <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              </div>
            </div>

            {/* Kanal adı */}
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-sm sm:text-base tracking-tight truncate group-hover:text-indigo-100 transition-colors duration-300">
                {roomName}
              </span>
              <span className="text-[10px] sm:text-xs text-white/50 font-medium tracking-wide">
                Ses Kanalı
              </span>
            </div>
          </div>

          {/* Ayırıcı */}
          <div className="w-px h-8 sm:h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-1 hidden md:block" />

          {/* Bağlantı durumu */}
          <div className="hidden md:block">
            <ConnectionStatusIndicator />
          </div>
        </div>

        {/* Sağ taraf - Kontrol butonları */}
        <div className="flex items-center gap-1 relative z-10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] rounded-2xl p-1 backdrop-blur-sm border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {/* Kullanıcılar butonu */}
          <button
            onClick={() => setShowVoicePanel(!showVoicePanel)}
            title="Kişiler"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
              showVoicePanel
                ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/10 text-white border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                : "text-white/60 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <Users size={16} />
          </button>

          {/* Chat butonu */}
          {currentTextChannel && (
            <button
              onClick={() => setShowChatPanel(!showChatPanel)}
              title="Sohbet"
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                showChatPanel
                  ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/10 text-white border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <MessageSquare size={16} />
            </button>
          )}

          {/* Chat pozisyon değiştirme */}
          {showVoicePanel && showChatPanel && currentTextChannel && (
            <button
              onClick={() =>
                setChatPosition(chatPosition === "right" ? "left" : "right")
              }
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white/90 hover:bg-white/[0.05] transition-all duration-200 hover:scale-110 active:scale-95"
              title="Chat pozisyonunu değiştir"
            >
              {chatPosition === "right" ? (
                <ChevronLeft size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}
        </div>
      </div>

      <ScreenShareManager
        setActiveStreamId={setActiveStreamId}
        renderStageManager={(stopScreenShare) => (
          <StageManager
            showVoicePanel={showVoicePanel}
            showChatPanel={showChatPanel}
            currentTextChannel={currentTextChannel}
            chatPosition={chatPosition}
            chatWidth={chatWidth}
            setChatWidth={setChatWidth}
            username={username}
            userId={userId}
            onUserContextMenu={handleUserContextMenu}
            activeStreamId={activeStreamId}
            setActiveStreamId={setActiveStreamId}
            hideIncomingVideo={hideIncomingVideo}
            stopScreenShare={stopScreenShare}
          />
        )}
        renderBottomControls={(stopScreenShare) => (
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
            stopScreenShare={stopScreenShare}
          />
        )}
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

// ScreenShareManager: stopScreenShare fonksiyonunu LiveKitRoom içinde tanımlar
function ScreenShareManager({
  setActiveStreamId,
  renderStageManager,
  renderBottomControls,
}) {
  const { localParticipant } = useLocalParticipant();

  const stopScreenShare = useCallback(async () => {
    try {
      if (!localParticipant) {
        console.warn("Local participant bulunamadı");
        return;
      }

      const tracks = localParticipant.getTrackPublications();
      const screenShareTracks = tracks.filter(
        (trackPub) =>
          trackPub.source === Track.Source.ScreenShare ||
          trackPub.source === Track.Source.ScreenShareAudio
      );

      if (screenShareTracks.length === 0) {
        // Track yoksa, activeStreamId'yi sıfırla
        setActiveStreamId(null);
        return;
      }

      // Tüm screen share track'lerini durdur
      const unpublishPromises = [];

      for (const trackPub of screenShareTracks) {
        try {
          // Önce track'i al
          const track = trackPub.track;

          if (track) {
            // Track'in mediaStreamTrack'ini durdur (eğer varsa)
            if (track.mediaStreamTrack) {
              track.mediaStreamTrack.stop();
            }

            // Track'i durdur
            track.stop();

            // Unpublish et (track ile)
            unpublishPromises.push(
              localParticipant.unpublishTrack(track).catch((error) => {
                // Publication zaten yoksa veya başka bir hata varsa sessizce devam et
                if (process.env.NODE_ENV === "development") {
                  console.warn(
                    "Track unpublish hatası (normal olabilir):",
                    error
                  );
                }
              })
            );
          } else {
            // Track yoksa, publication'ı unpublish et
            try {
              unpublishPromises.push(
                localParticipant.unpublishTrack(trackPub).catch((error) => {
                  if (process.env.NODE_ENV === "development") {
                    console.warn(
                      "TrackPub unpublish hatası (normal olabilir):",
                      error
                    );
                  }
                })
              );
            } catch (error) {
              if (process.env.NODE_ENV === "development") {
                console.warn("TrackPub unpublish hatası:", error);
              }
            }
          }
        } catch (error) {
          console.warn("Track durdurma hatası:", error);
        }
      }

      // Tüm unpublish işlemlerini bekle
      await Promise.all(unpublishPromises);

      // activeStreamId'yi sıfırla
      setActiveStreamId(null);

      if (process.env.NODE_ENV === "development") {
        console.log("✅ Screen share durduruldu");
      }
    } catch (error) {
      console.error("Screen share durdurma hatası:", error);
      // Hata olsa bile activeStreamId'yi sıfırla
      setActiveStreamId(null);
    }
  }, [localParticipant, setActiveStreamId]);

  return (
    <>
      {renderStageManager(stopScreenShare)}
      {renderBottomControls(stopScreenShare)}
    </>
  );
}

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
  const activeTrack = activeStreamId
    ? screenTracks.find((t) => t.participant.identity === activeStreamId)
    : null;
  const { localParticipant } = useLocalParticipant();
  const amISharing = localParticipant.isScreenShareEnabled;
  const { desktopNotifications, notifyOnJoin } = useSettingsStore();

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
    if (
      activeStreamId &&
      !screenTracks.find((t) => t.participant.identity === activeStreamId)
    ) {
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
  }, [screenTracks, activeStreamId, setActiveStreamId]);

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
      {/* Animated background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs - daha güçlü */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-500/[0.08] rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/[0.06] rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/[0.05] rounded-full blur-[180px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
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
      </div>
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
  const audioTrackRef = audioTracks.find(
    (t) => t.participant.sid === participant?.sid
  );
  const isAudioDisabled = amISharing && !isLocalSharing;

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
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = () => {
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

      // 0.8 saniye hareketsizlikten sonra overlay'i gizle (daha hızlı kapanma)
      mouseMoveTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 200);

      // 2 saniye hareketsizlikten sonra cursor'u gizle
      cursorTimeoutRef.current = setTimeout(() => {
        setShowCursor(false);
      }, 800);
    };

    const handleMouseEnter = () => {
      setShowOverlay(true);
      setShowCursor(true);
    };

    container.addEventListener("mousemove", handleMouseMove);
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
      {/* Ambient background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

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
        />
        {!isLocalSharing && <audio ref={audioRef} autoPlay />}

        {/* Premium Glassmorphism Overlay - Mouse movement ile kontrol ediliyor */}
        {/* Overlay arka planı - görünür değilken pointer-events-none */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/50 transition-all duration-500 ${
            showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Top Bar - Premium Design */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 sm:p-6 z-50 pointer-events-none">
          <div
            className={`flex items-center gap-2 sm:gap-3 backdrop-blur-xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-500 pointer-events-auto hover:scale-105 ${
              showOverlay ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* LIVE Badge - More vibrant */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-xl blur-md opacity-75 animate-pulse" />
              <div className="relative bg-gradient-to-r from-red-500 to-red-600 px-2.5 sm:px-3 py-1 rounded-xl text-[10px] sm:text-xs font-extrabold text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] uppercase tracking-wider flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Canlı
              </div>
            </div>
            <span className="text-white font-bold drop-shadow-lg text-sm sm:text-base tracking-tight">
              {isLocalSharing
                ? "Senin Yayının"
                : `${participant?.identity} yayını`}
            </span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            {isLocalSharing && (
              <button
                onClick={onHideLocal}
                className={`backdrop-blur-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] hover:border-white/20 text-white/70 hover:text-white p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 group/btn ${
                  showOverlay ? "opacity-100" : "opacity-0"
                }`}
                title="Önizlemeyi Gizle"
              >
                <EyeOff
                  size={18}
                  className="sm:w-5 sm:h-5 group-hover/btn:scale-110 transition-transform"
                />
              </button>
            )}
            {/* İzlemeyi Durdur butonu - Always visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log("🛑 İzlemeyi Durdur butonuna tıklandı");
                if (onStopWatching) {
                  console.log("✅ onStopWatching fonksiyonu çağrılıyor");
                  onStopWatching();
                } else {
                  console.error("❌ onStopWatching fonksiyonu tanımlı değil!");
                }
              }}
              className="backdrop-blur-xl bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.12] hover:border-red-500/40 text-white/70 hover:text-red-400 p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 group/btn z-[100]"
              title="İzlemeyi Durdur"
            >
              <Minimize
                size={18}
                className="sm:w-5 sm:h-5 group-hover/btn:scale-110 transition-transform"
              />
            </button>
          </div>
        </div>

        {/* Overlay içeriği - Bottom controls */}
        <div
          className={`absolute inset-0 flex flex-col justify-end p-6 transition-all duration-500 pointer-events-none ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-auto">
            {/* Bottom Controls - Profesyonel Tasarım */}
            <div className="flex justify-between items-end animate-in fade-in slide-in-from-bottom-2 duration-300 gap-4">
              {/* İzleyici Sayısı - Kompakt Badge */}
              <div className="flex items-center gap-2 glass-strong px-3 py-1.5 rounded-lg border border-white/10 shadow-soft backdrop-blur-xl bg-gradient-to-br from-[#2b2d31]/90 to-[#1e1f22]/90 hover:border-indigo-500/30 transition-all duration-300 group/viewers">
                <div className="relative">
                  <Users
                    size={14}
                    className="text-indigo-400 group-hover/viewers:text-indigo-300 transition-colors"
                  />
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-[#1e1f22] animate-pulse"></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#949ba4] font-medium leading-tight">
                    Canlı İzleyici
                  </span>
                  <span className="text-xs font-bold text-white leading-tight">
                    {viewerCount}
                  </span>
                </div>
              </div>

              {/* Kontrol Butonları - Premium Tasarım */}
              <div className="flex items-center gap-3">
                {/* Ses Kısma Butonu - Yayın yapıldığında da görünür, tam ekran butonunun solunda */}
                {!isLocalSharing && (
                  <div className="flex items-center gap-3 group/vol">
                    {isAudioDisabled ? (
                      <div
                        className="flex items-center gap-2 text-yellow-400 text-xs font-bold px-3 py-1.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20"
                        title="Ses döngüsünü önlemek için ses kapatıldı."
                      >
                        <AlertTriangle size={18} />
                        <span className="hidden group-hover/vol:inline whitespace-nowrap">
                          Ses Kapalı
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={toggleMuteStream}
                          className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-110 group/btn ${
                            volume === 0
                              ? "text-red-400 hover:text-red-300 hover:bg-red-500/20 hover:border-red-500/30"
                              : "text-white hover:text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/30"
                          } border border-white/10 hover:border-current hover:shadow-glow backdrop-blur-sm`}
                          title={volume === 0 ? "Sesi Aç" : "Sesi Kapat"}
                        >
                          {volume === 0 ? (
                            <VolumeX
                              size={20}
                              className="group-hover/btn:scale-110 transition-transform"
                            />
                          ) : volume < 50 ? (
                            <Volume1
                              size={20}
                              className="group-hover/btn:scale-110 transition-transform"
                            />
                          ) : (
                            <Volume2
                              size={20}
                              className="group-hover/btn:scale-110 transition-transform"
                            />
                          )}
                        </button>
                        <div className="w-0 group-hover/vol:w-36 overflow-hidden transition-all duration-300 flex items-center">
                          <div className="relative w-32 h-7 flex items-center">
                            {/* Progress Bar Background */}
                            <div className="absolute w-full h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                              {/* Progress Fill */}
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-500 rounded-full transition-all duration-150 shadow-glow"
                                style={{ width: `${volume}%` }}
                              ></div>
                            </div>

                            {/* Slider Input */}
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={volume}
                              onChange={(e) =>
                                setVolume(Number(e.target.value))
                              }
                              className="absolute w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
                              style={{
                                WebkitAppearance: "none",
                                appearance: "none",
                              }}
                            />

                            {/* Visual Thumb */}
                            <div
                              className="absolute h-5 w-5 bg-white rounded-full shadow-lg border-2 border-indigo-400 pointer-events-none z-20 transition-all duration-150 hover:scale-125"
                              style={{
                                left: `${volume}%`,
                                transform: "translateX(-50%)",
                                boxShadow: "0 2px 12px rgba(99, 102, 241, 0.6)",
                              }}
                            ></div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {/* Ayırıcı - Sadece ses kısma butonu görünürken */}
                {!isLocalSharing && !isAudioDisabled && (
                  <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                )}
                {/* Tam Ekran Butonu - Her zaman görünür (yayın yapıldığında da) */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2.5 rounded-xl border border-white/10 text-white hover:text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all duration-200 hover:scale-110 hover:shadow-glow backdrop-blur-sm group/fs"
                  title="Tam Ekran"
                >
                  {isFullscreen ? (
                    <Minimize
                      size={20}
                      className="group-hover/fs:scale-110 transition-transform"
                    />
                  ) : (
                    <Maximize
                      size={20}
                      className="group-hover/fs:scale-110 transition-transform"
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
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

// --- KATILIMCI LİSTESİ ---
function ParticipantList({
  onUserContextMenu,
  compact,
  hideIncomingVideo,
  setActiveStreamId,
  activeStreamId,
}) {
  const participants = useParticipants();
  const count = participants.length;
  if (count === 0) return null;
  if (compact) {
    return (
      <div
        className="flex items-center gap-3 h-full px-2"
        style={{ overflow: "visible" }}
      >
        {participants.map((p) => (
          <div
            key={p.sid}
            className="min-w-[140px] h-full"
            style={{ overflow: "visible", padding: "2px" }}
          >
            <UserCard
              participant={p}
              totalCount={count}
              onContextMenu={(e) => onUserContextMenu(e, p)}
              compact={true}
              hideIncomingVideo={hideIncomingVideo}
              setActiveStreamId={setActiveStreamId}
              activeStreamId={activeStreamId}
            />
          </div>
        ))}
      </div>
    );
  }
  let gridClass = "";
  if (count === 1)
    gridClass = "grid-cols-1 w-full max-w-[800px] aspect-video max-h-[600px]";
  else if (count === 2)
    gridClass = "grid-cols-1 md:grid-cols-2 w-full max-w-[1000px] gap-5";
  else if (count <= 4) gridClass = "grid-cols-2 w-full max-w-[900px] gap-5";
  else if (count <= 6)
    gridClass = "grid-cols-2 md:grid-cols-3 w-full max-w-[1100px] gap-4";
  else gridClass = "grid-cols-3 md:grid-cols-4 w-full max-w-[1200px] gap-4";
  return (
    <div
      className={`grid ${gridClass} items-center justify-center content-center w-full p-4`}
      style={{ overflow: "visible" }} // Glow efektlerinin kesilmemesi için
    >
      {participants.map((p) => (
        <div
          key={p.sid}
          className="w-full h-full aspect-[16/9] min-h-[180px]"
          style={{ overflow: "visible", padding: "4px" }}
        >
          <UserCard
            participant={p}
            totalCount={count}
            onContextMenu={(e) => onUserContextMenu(e, p)}
            hideIncomingVideo={hideIncomingVideo}
            setActiveStreamId={setActiveStreamId}
            activeStreamId={activeStreamId}
          />
        </div>
      ))}
    </div>
  );
}

// Screen Share Önizleme - İlk 1 saniye canlı, sonra donmuş frame
function ScreenSharePreviewComponent({ trackRef }) {
  const [previewImage, setPreviewImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hasCapturedRef = useRef(false);
  const captureTimeoutRef = useRef(null);
  const trackSidRef = useRef(null);

  // Track değiştiğinde reset - trackSid'i stabilize et
  const currentTrackSid = trackRef?.participant?.sid ?? null;

  useEffect(() => {
    if (currentTrackSid !== trackSidRef.current) {
      hasCapturedRef.current = false;
      setPreviewImage(null);
      trackSidRef.current = currentTrackSid;
    }
  }, [currentTrackSid]);

  // Video element'ini track'e bağla - trackSid ve publication'ı stabilize et
  const trackPublicationSid = trackRef?.publication?.trackSid ?? null;

  useEffect(() => {
    if (!trackRef?.publication?.track || hasCapturedRef.current) return;

    const trackPublication = trackRef.publication;

    const track = trackPublication.track;
    const video = videoRef.current;

    if (!video) return;

    track.attach(video);

    // Video yüklendiğinde 1 saniye sonra frame yakala
    const handleLoadedMetadata = () => {
      if (hasCapturedRef.current) return;

      captureTimeoutRef.current = setTimeout(() => {
        if (video && canvasRef.current && !hasCapturedRef.current) {
          try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL("image/jpeg", 0.8);
            setPreviewImage(imageData);
            hasCapturedRef.current = true;

            // Video track'i detach et (artık gerek yok, bandwidth tasarrufu)
            track.detach(video);
          } catch (error) {
            console.warn("Preview capture error:", error);
          }
        }
      }, 1000); // 1 saniye sonra yakala
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }
      if (track && video) {
        track.detach(video);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackSid, trackPublicationSid]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
      {!hasCapturedRef.current && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{
              filter: "blur(2px) brightness(0.7)",
            }}
          />
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
      {previewImage && (
        <img
          src={previewImage}
          alt="Screen share preview"
          className="w-full h-full object-cover"
          style={{
            filter: "blur(2px) brightness(0.7)",
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/30"></div>
    </div>
  );
}

function UserCard({
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
  const { identity, name, metadata } = useParticipantInfo({ participant });
  
  // Use name for display, fallback to identity if name is not set
  const displayName = name || identity;
  const audioActive = useAudioActivity(participant);

  // Screen share track kontrolü
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks.find(
    (t) => t.participant.sid === participant.sid
  );
  const hasScreenShare = !!screenShareTrack;
  const isCurrentlyWatching = activeStreamId === participant.identity;
  const { profileColor: localProfileColor, cameraMirrorEffect } =
    useSettingsStore(); // Local kullanıcı için ayarlardan renk al
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
  const isSpeaking = audioActive && !isMuted && !isDeafened;
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

  return (
    <div
      onContextMenu={onContextMenu}
      className="relative w-full h-full rounded-2xl flex flex-col items-center justify-center group cursor-context-menu backdrop-blur-md hover:shadow-soft-lg hover:scale-[1.02]"
      style={{
        background: isSpeaking
          ? userColor.includes("gradient")
            ? `linear-gradient(135deg, ${getBorderColor(userColor)}15 0%, rgba(10,10,12,0.7) 50%, rgba(10,10,12,0.85) 100%)`
            : `linear-gradient(135deg, ${userColor}15 0%, rgba(10,10,12,0.7) 50%, rgba(10,10,12,0.85) 100%)`
          : isMuted || isDeafened
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(10,10,12,0.7) 50%, rgba(10,10,12,0.85) 100%)'
          : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(10,10,12,0.6) 50%, rgba(10,10,12,0.8) 100%)',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: isSpeaking
          ? getBorderColor(userColor)
          : isMuted || isDeafened
          ? "rgba(239, 68, 68, 0.4)"
          : "rgba(255, 255, 255, 0.1)",
        boxShadow: isSpeaking
          ? userColor.includes("gradient")
            ? `0 0 40px ${getBorderColor(userColor)}60, 0 8px 30px rgba(0,0,0,0.4), inset 0 0 20px ${getBorderColor(userColor)}20`
            : `0 0 40px ${userColor}60, 0 8px 30px rgba(0,0,0,0.4), inset 0 0 20px ${userColor}20`
          : isMuted || isDeafened
          ? `inset 0 0 0 3px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.3)`
          : '0 4px 24px rgba(0,0,0,0.3)',
        overflow: "visible",
        transition: 'border-color 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), background 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Animated background glow for speaking - Smooth fade in/out */}
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
              // Eğer screen share varsa ve izlenmiyorsa, kameraya tıklandığında yayına katıl
              if (
                hasScreenShare &&
                screenShareTrack &&
                !isCurrentlyWatching &&
                setActiveStreamId &&
                participant.identity
              ) {
                e.stopPropagation();
                setActiveStreamId(participant.identity);
              }
            }}
            style={{
              cursor:
                hasScreenShare && screenShareTrack && !isCurrentlyWatching
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
            {isSpeaking && (
              <>
                {/* Ana glow layer - Radial gradient - Container içinde, padding ile */}
                <div
                  className="absolute rounded-2xl pointer-events-none animate-speaking-glow overflow-hidden"
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
                  className="absolute rounded-2xl pointer-events-none animate-speaking-pulse-ring overflow-hidden"
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
                  className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse-border-video overflow-hidden"
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
                  className="absolute rounded-2xl pointer-events-none animate-speaking-corner-glow overflow-hidden"
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
                  className="absolute rounded-2xl pointer-events-none animate-speaking-corner-glow overflow-hidden"
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

            {/* Letter - use displayName for proper initials */}
            <span className="relative z-10 drop-shadow-lg">
              {displayName?.charAt(0).toUpperCase()}
            </span>

            {/* Speaking pulse rings */}
            {isSpeaking && (
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
      {!shouldShowVideo && isSpeaking && (
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
  stopScreenShare,
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMuted, setMuted] = useState(false);
  const { profileColor, enableCamera, videoId, videoResolution, videoFrameRate } = useSettingsStore();
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showScreenShareMenu, setShowScreenShareMenu] = useState(false);
  const screenShareMenuRef = useRef(null);
  const screenShareButtonRef = useRef(null);
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

  // Metadata update'i debounce et (timeout önlemek için)
  const metadataUpdateRef = useRef(null);
  const lastMetadataRef = useRef("");
  const isUpdatingMetadataRef = useRef(false);
  const hasSentInitialMetadataRef = useRef(false); // İlk metadata gönderildi mi?

  // Room bağlantı durumunu kontrol et
  const isRoomConnected = room?.state === ConnectionState.Connected;

  useEffect(() => {
    // Room bağlantısı tamamlanmadan önce metadata güncelleme yapma
    if (!isRoomConnected) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "⏳ Room bağlantısı tamamlanmadı, metadata güncellemesi bekleniyor"
        );
      }
      return;
    }

    if (!localParticipant) {
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Local participant yok, metadata güncellenemedi");
      }
      return;
    }

    const newMetadata = JSON.stringify({
      isDeafened,
      isMuted,
      profileColor,
      isCameraOn,
    });

    // Aynı metadata ise güncelleme yapma
    if (lastMetadataRef.current === newMetadata) {
      if (process.env.NODE_ENV === "development") {
        console.log("⏭️ Metadata değişmedi, güncelleme atlandı");
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("🔄 Metadata güncelleniyor:", JSON.parse(newMetadata));
    }

    // Önceki timeout'u iptal et
    if (metadataUpdateRef.current) {
      clearTimeout(metadataUpdateRef.current);
    }

    // Yeni timeout başlat (300ms debounce)
    metadataUpdateRef.current = setTimeout(async () => {
      // Bağlantı durumunu tekrar kontrol et
      if (!isRoomConnected || room?.state !== ConnectionState.Connected) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "⏳ Room bağlantısı kesildi, metadata güncellemesi iptal edildi"
          );
        }
        isUpdatingMetadataRef.current = false;
        return;
      }

      // Eğer zaten güncelleme yapılıyorsa bekle
      if (isUpdatingMetadataRef.current) return;

      // Metadata değişmiş mi kontrol et
      if (lastMetadataRef.current === newMetadata) return;

      // Participant kontrolü
      if (!localParticipant) {
        isUpdatingMetadataRef.current = false;
        return;
      }

      isUpdatingMetadataRef.current = true;
      try {
        // setMetadata çağrısı yapılmadan önce room bağlantısının tamamlandığından emin ol
        await localParticipant.setMetadata(newMetadata);
        lastMetadataRef.current = newMetadata;
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Metadata güncellendi:", JSON.parse(newMetadata));
        }
      } catch (error) {
        // Bağlantı hatalarını ve timeout hatalarını sessizce yoksay
        const errorMessage = error?.message || "";
        const shouldIgnore =
          errorMessage.includes("timeout") ||
          errorMessage.includes("Request to update") ||
          errorMessage.includes(
            "cannot send signal request before connected"
          ) ||
          errorMessage.includes("not connected") ||
          errorMessage.includes("before connected");

        if (!shouldIgnore) {
          console.warn("❌ Metadata update error:", error);
        } else {
          // Bağlantı hatası varsa, metadata'yı güncelleme (retry için)
          // lastMetadataRef.current'i güncelleme, böylece tekrar denenecek
          if (process.env.NODE_ENV === "development") {
            console.log(
              "⏳ Bağlantı hatası, metadata güncellemesi ertelendi:",
              errorMessage
            );
          }
        }
      } finally {
        isUpdatingMetadataRef.current = false;
      }
    }, 300); // 300ms debounce

    return () => {
      if (metadataUpdateRef.current) {
        clearTimeout(metadataUpdateRef.current);
      }
    };
  }, [
    isDeafened,
    isMuted,
    localParticipant,
    profileColor,
    isCameraOn,
    isRoomConnected,
    room,
  ]);

  // Video track durumunu senkronize et (sadece event'lerde, sürekli kontrol yok)
  const isTogglingCameraRef = useRef(false); // Toggle sırasında event listener'ları devre dışı bırak
  const lastCameraStateRef = useRef(isCameraOn); // Son state'i takip et

  useEffect(() => {
    if (!localParticipant) return;

    // Track publish/unpublish event'lerini dinle
    const handleTrackPublished = (pub) => {
      if (pub.source === Track.Source.Camera && pub.participant.isLocal) {
        // Toggle sırasında event listener'ı devre dışı bırak
        if (isTogglingCameraRef.current) return;
        // Sadece state değiştiyse güncelle (sonsuz döngüyü önle)
        if (!lastCameraStateRef.current) {
          setIsCameraOn(true);
          lastCameraStateRef.current = true;
        }
      }
    };

    const handleTrackUnpublished = (pub) => {
      if (pub.source === Track.Source.Camera && pub.participant.isLocal) {
        // Toggle sırasında event listener'ı devre dışı bırak
        if (isTogglingCameraRef.current) return;
        // Sadece state değiştiyse güncelle (sonsuz döngüyü önle)
        if (lastCameraStateRef.current) {
          setIsCameraOn(false);
          lastCameraStateRef.current = false;
        }
      }
    };

    localParticipant.on(RoomEvent.TrackPublished, handleTrackPublished);
    localParticipant.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);

    return () => {
      localParticipant.off(RoomEvent.TrackPublished, handleTrackPublished);
      localParticipant.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    };
  }, [localParticipant]);

  // isCameraOn değiştiğinde ref'i güncelle
  useEffect(() => {
    lastCameraStateRef.current = isCameraOn;
  }, [isCameraOn]);

  const toggleMute = useCallback(() => {
    const { isMuted, isDeafened, localParticipant } = stateRef.current;
    if (isDeafened) return;
    const newState = !isMuted;
    setMuted(newState);
    if (localParticipant) localParticipant.setMicrophoneEnabled(!newState);
    playSound(newState ? "mute" : "unmute");
  }, [playSound]);

  const toggleDeaf = useCallback(() => {
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
  }, [playSound]);

  const toggleCamera = useCallback(async () => {
    if (!enableCamera) {
      toastOnce("Kamera erişimi Ayarlar'dan kapatılmış.", "error");
      return;
    }

    // Local participant'ı direkt hook'tan al (daha güvenli)
    if (!localParticipant) {
      console.error("❌ Local participant bulunamadı - kamera açılamadı");
      toastOnce("Kamera açılamadı: Bağlantı hatası", "error");
      return;
    }

    // Toggle başladığını işaretle (event listener'ları devre dışı bırak)
    isTogglingCameraRef.current = true;

    // State'i hemen güncelle (optimistic update) - 2 kere basma sorununu çözer
    const currentState = isCameraOn;
    const newState = !currentState;
    setIsCameraOn(newState);

    try {
      if (newState) {
        // Çözünürlük ayarlarını belirle
        const resolutionMap = {
          "720p": { width: 1280, height: 720, bitrate: 1500000 },
          "1080p": { width: 1920, height: 1080, bitrate: 3000000 },
          "2k": { width: 2560, height: 1440, bitrate: 5000000 },
        };
        const selectedResolution = resolutionMap[videoResolution] || resolutionMap["1080p"];
        const selectedFps = videoFrameRate || 30;

        // Önce eski video track'i kaldır (eğer varsa)
        const existingVideoTracks = localParticipant
          .getTrackPublications()
          .filter((pub) => pub.source === Track.Source.Camera);
        for (const trackPub of existingVideoTracks) {
          try {
            // Önce track'i durdur
            const existingTrack = trackPub.track;
            if (existingTrack) {
              existingTrack.stop();
              // Sonra unpublish et - publication'dan track'i al
              await localParticipant.unpublishTrack(existingTrack);
            }
          } catch (err) {
            console.warn("Eski video track kaldırılırken hata:", err);
          }
        }

        // Kamera stream'i al - Kullanıcı ayarlarına göre
        const constraints = {
          video: {
            deviceId: videoId !== "default" ? { exact: videoId } : undefined,
            width: { ideal: selectedResolution.width, max: selectedResolution.width },
            height: { ideal: selectedResolution.height, max: selectedResolution.height },
            frameRate: { ideal: selectedFps, max: selectedFps },
            facingMode: "user",
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoTrack = stream.getVideoTracks()[0];

        if (!videoTrack) {
          throw new Error("Video track alınamadı");
        }

        // Video track'i kullanıcı ayarlarına göre optimize et
        if (videoTrack.getCapabilities) {
          const capabilities = videoTrack.getCapabilities();
          if (videoTrack.applyConstraints) {
            try {
              await videoTrack.applyConstraints({
                width: { ideal: selectedResolution.width, max: selectedResolution.width },
                height: { ideal: selectedResolution.height, max: selectedResolution.height },
                frameRate: { ideal: selectedFps, max: selectedFps },
              });
            } catch (err) {
              console.warn("Video track constraint uygulanamadı:", err);
            }
          }
        }

        const settings = videoTrack.getSettings();
        // Sadece development'ta log göster
        if (process.env.NODE_ENV === "development") {
          console.log("📹 Video track ayarları:", {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            deviceId: settings.deviceId,
            requestedResolution: videoResolution,
            requestedFps: selectedFps,
          });
        }

        // Video track'i LiveKit'e publish et - Kullanıcı ayarlarına göre
        let publication;
        try {
          publication = await localParticipant.publishTrack(videoTrack, {
            source: Track.Source.Camera,
            videoEncoding: {
              maxBitrate: selectedResolution.bitrate,
              maxFramerate: selectedFps,
            },
            videoCodec: "vp8",
            simulcast: false,
          });
        } catch (publishError) {
          console.error("❌ Track publish hatası:", publishError);
          videoTrack.stop();
          throw new Error(
            `Kamera yayınlanamadı: ${publishError.message || "Bilinmeyen hata"}`
          );
        }

        // KRİTİK KONTROLLER: Track'in doğru publish edildiğinden emin ol
        if (!publication) {
          videoTrack.stop();
          throw new Error("Publication oluşturulamadı!");
        }

        // Track'in enabled olduğundan ve muted olmadığından emin ol
        if (!publication.track) {
          console.error("❌ Publication'da track yok!");
          videoTrack.stop();
          throw new Error("Publication'da track bulunamadı!");
        }

        // Track'i enabled yap (hem LiveKit track hem de mediaStreamTrack)
        publication.track.enabled = true;
        if (publication.track.mediaStreamTrack) {
          publication.track.mediaStreamTrack.enabled = true;
        }

        // Publication'ın muted olmadığından emin ol
        if (publication.isMuted) {
          try {
            await publication.setMuted(false);
          } catch (muteError) {
            console.warn("⚠️ setMuted(false) hatası:", muteError);
          }
        }

        // Publication durumunu kontrol et ve retry mekanizması
        const isPublished = publication.trackSid && !publication.isMuted;
        if (!isPublished) {
          console.warn(
            "⚠️ Video track düzgün publish edilmedi, tekrar deneniyor...",
            {
              trackSid: publication.trackSid,
              isMuted: publication.isMuted,
              enabled: publication.track?.enabled,
            }
          );

          // Track'i durdur ve tekrar dene (max 2 retry)
          videoTrack.stop();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Tekrar dene
          try {
            const retryStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const retryVideoTrack = retryStream.getVideoTracks()[0];
            if (retryVideoTrack) {
              const retryPublication = await localParticipant.publishTrack(
                retryVideoTrack,
                {
                  source: Track.Source.Camera,
                  videoEncoding: {
                    maxBitrate: selectedResolution.bitrate,
                    maxFramerate: selectedFps,
                  },
                  videoCodec: "vp8",
                  simulcast: false,
                }
              );

              if (
                retryPublication &&
                retryPublication.trackSid &&
                !retryPublication.isMuted
              ) {
                retryPublication.track.enabled = true;
                if (retryPublication.track.mediaStreamTrack) {
                  retryPublication.track.mediaStreamTrack.enabled = true;
                }
                if (retryPublication.isMuted) {
                  await retryPublication.setMuted(false);
                }
                publication = retryPublication;
                retryStream.getAudioTracks().forEach((track) => track.stop());
              } else {
                throw new Error("Retry başarısız");
              }
            }
          } catch (retryError) {
            console.error("❌ Retry başarısız:", retryError);
            throw new Error("Kamera yayınlanamadı: Tekrar deneme başarısız");
          }
        }

        // Remote participant'ların track'i görebilmesi için bir kısa gecikme ekle
        // (LiveKit'in track'i diğer participant'lara iletmesi için)
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Track kontrolü: LiveKit track'i internal olarak yönetir,
        // track geçici olarak undefined olabilir ama trackSid varsa publish başarılıdır
        if (publication.trackSid) {
          // Track başarıyla publish edildi
          if (publication.track) {
            // Track mevcut, durumunu kontrol et
            if (publication.track.mediaStreamTrack?.readyState === "ended") {
              console.warn(
                "⚠️ Track ended durumuna geçti, yeniden publish gerekebilir"
              );
            }
          }
          // Track undefined olsa bile trackSid varsa publish başarılıdır
          // LiveKit track'i gerektiğinde yeniden oluşturabilir
        } else {
          console.error("❌ Track publish başarısız - trackSid yok!");
        }

        // State'i güncelle (track publish edildi) - ref'i de güncelle
        setIsCameraOn(true);
        lastCameraStateRef.current = true;

        // Sadece development'ta detaylı log göster
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Video track publish edildi:", {
            trackSid: publication.trackSid,
            isMuted: publication.isMuted,
            enabled: publication.track?.enabled,
            hasTrack: !!publication.track,
            hasMediaStreamTrack: !!publication.track?.mediaStreamTrack,
          });

          // Local participant'ın publication durumunu kontrol et
          setTimeout(() => {
            try {
              const localPub = localParticipant.getTrackPublication(
                Track.Source.Camera
              );
              if (localPub) {
                console.log("📹 Local camera track durumu (1 saniye sonra):", {
                  trackSid: localPub.trackSid,
                  isMuted: localPub.isMuted,
                  hasTrack: !!localPub.track,
                  enabled: localPub.track?.enabled,
                });

                // Remote participant'ları kontrol et (room varsa)
                // Not: localParticipant.room bazen undefined olabilir, bu normal
                const room = localParticipant.room;
                if (room && room.remoteParticipants) {
                  const remoteParticipants = Array.from(
                    room.remoteParticipants.values()
                  );
                  console.log(
                    "📊 Remote participant sayısı:",
                    remoteParticipants.length
                  );

                  if (remoteParticipants.length === 0) {
                    console.log(
                      "ℹ️ Remote participant yok. Başka bir cihazdan odaya girdiğinizde track görünecektir."
                    );
                  } else {
                    remoteParticipants.forEach((remoteParticipant) => {
                      // Remote participant'ın local participant'ın track'ini görebilmesi için
                      // local participant'ın publication'ını kontrol et
                      const localPubForRemote =
                        localParticipant.getTrackPublication(
                          Track.Source.Camera
                        );
                      console.log(
                        `📹 Remote participant "${remoteParticipant.identity}" için local track durumu:`,
                        {
                          localTrackSid: localPubForRemote?.trackSid,
                          localTrackMuted: localPubForRemote?.isMuted,
                          localHasTrack: !!localPubForRemote?.track,
                        }
                      );

                      // Remote participant'ın kendi track'ini kontrol et (eğer varsa)
                      const remotePub = remoteParticipant.getTrackPublication(
                        Track.Source.Camera
                      );
                      if (remotePub) {
                        console.log(
                          `📹 Remote participant "${remoteParticipant.identity}" kendi camera track durumu:`,
                          {
                            trackSid: remotePub.trackSid,
                            isMuted: remotePub.isMuted,
                            hasTrack: !!remotePub.track,
                          }
                        );
                      }
                    });
                  }
                }
                // Room undefined ise bu normal, çünkü room bağlantısı henüz tam kurulmamış olabilir
              } else {
                console.warn("⚠️ Local camera publication bulunamadı!");
              }
            } catch (error) {
              console.error("❌ Track durumu kontrolü hatası:", error);
            }
          }, 1000);
        }

        // Stream'deki diğer track'leri durdur (sadece video kullanıyoruz)
        stream.getAudioTracks().forEach((track) => track.stop());
      } else {
        // Kamera kapatıldığında tüm video track'leri kaldır
        const videoTracks = localParticipant
          .getTrackPublications()
          .filter((pub) => pub.source === Track.Source.Camera);

        for (const trackPub of videoTracks) {
          try {
            // Publication'dan track'i al
            const trackToUnpublish = trackPub.track;
            if (trackToUnpublish) {
              // Önce track'i durdur
              trackToUnpublish.stop();
              // Sonra unpublish et
              await localParticipant.unpublishTrack(trackToUnpublish);
            }
          } catch (err) {
            console.warn("Video track kaldırılırken hata:", err);
            // Hata olsa bile track'i durdurmaya çalış
            if (trackPub.track) {
              trackPub.track.stop();
            }
          }
        }

        // State'i güncelle - ref'i de güncelle
        setIsCameraOn(false);
        lastCameraStateRef.current = false;
      }
    } catch (error) {
      console.error("❌ Kamera hatası:", error);
      setIsCameraOn(currentState); // Hata durumunda state'i geri al
      lastCameraStateRef.current = currentState;
      const errorMessage =
        error?.message || error?.toString() || "Bilinmeyen hata";
      toastOnce(`Kamera açılamadı: ${errorMessage}`, "error");
    } finally {
      // Toggle bittiğini işaretle (event listener'ları tekrar aktif et)
      isTogglingCameraRef.current = false;
    }
  }, [enableCamera, videoId, videoResolution, videoFrameRate, localParticipant, setIsCameraOn, isCameraOn]);

  const startScreenShare = async ({
    resolution,
    fps,
    sourceId,
    withAudio,
    audioMode,
  }) => {
    try {
      // Eğer zaten bir ekran paylaşımı varsa, önce onu durdur
      if (localParticipant?.isScreenShareEnabled) {
        const tracks = localParticipant.getTrackPublications();
        const existingScreenShareTracks = tracks.filter(
          (trackPub) =>
            trackPub.source === Track.Source.ScreenShare ||
            trackPub.source === Track.Source.ScreenShareAudio
        );

        if (existingScreenShareTracks.length > 0) {
          // Mevcut ekran paylaşımını durdur
          for (const trackPub of existingScreenShareTracks) {
            try {
              const track = trackPub.track;
              if (track) {
                if (track.mediaStreamTrack) {
                  track.mediaStreamTrack.stop();
                }
                track.stop();
                await localParticipant.unpublishTrack(track).catch(() => {});
              } else {
                await localParticipant.unpublishTrack(trackPub).catch(() => {});
              }
            } catch (error) {
              console.warn("Mevcut ekran paylaşımı durdurulurken hata:", error);
            }
          }
          // Kısa bir bekleme (track'lerin tamamen temizlenmesi için)
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const { width, height } =
        resolution === 1440
          ? { width: 2560, height: 1440 }
          : resolution === 1080
          ? { width: 1920, height: 1080 }
          : resolution === 720
          ? { width: 1280, height: 720 }
          : { width: 854, height: 480 };

      const isScreen = sourceId?.startsWith("screen");

      // Audio constraint'leri kaynak tipine göre ayarla
      let audioConstraints = false;
      if (withAudio) {
        if (audioMode === "app" || !isScreen) {
          // Uygulama paylaşımı: Sadece o uygulamanın sesi
          audioConstraints = {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId, // Sadece bu uygulama
            },
          };
        } else {
          // Ekran paylaşımı: Sistem sesi (tüm sesler)
          audioConstraints = {
            mandatory: {
              chromeMediaSource: "desktop",
              // Sistem sesi için sourceId belirtme (tüm sesler)
            },
          };
        }
      }

      // Electron'da getUserMedia kullan (chromeMediaSource constraint'leri sadece getUserMedia ile çalışır)
      let stream;
      if (window.netrex && sourceId) {
        // Electron: getUserMedia ile chromeMediaSource kullan
        // Sadece mandatory kullan, diğer constraint'leri sonra applyConstraints ile uygula
        const constraints = {
          audio: audioConstraints || false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
            },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Track'i aldıktan sonra resolution ve frame rate ayarlarını uygula
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.applyConstraints) {
          try {
            await videoTrack.applyConstraints({
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: fps },
            });
          } catch (e) {
            // Constraint uygulanamazsa devam et (bazı constraint'ler desteklenmeyebilir)
            console.warn("Could not apply video constraints:", e);
          }
        }
      } else {
        // Browser: Standart getDisplayMedia (exact constraint'ler yok, sadece ideal)
        const constraints = {
          audio: audioConstraints || false,
          video: {
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: fps },
          },
        };
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      }
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.contentHint = fps > 15 ? "motion" : "detail";
      
      // Çözünürlüğe göre bitrate ayarla (yüksek kalite için)
      // 2K: 8Mbps, 1080p: 5Mbps, 720p: 2.5Mbps
      const maxBitrate =
        resolution === 1440
          ? 8000000
          : resolution === 1080
          ? 5000000
          : resolution === 720
          ? 2500000
          : 1500000;

      await localParticipant.publishTrack(videoTrack, {
        name: "screen_share_video",
        source: Track.Source.ScreenShare,
        videoCodec: "vp8",
        simulcast: false,
        videoEncoding: { maxBitrate, maxFramerate: fps },
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (withAudio && audioTrack) {
        // Ekran paylaşımı için Netrex seslerini filtrele
        if (isScreen && audioMode === "system") {
          // Audio track'i filtrele: LiveKit audio track'lerini exclude et
          // Bu Electron API'sine bağlı, şimdilik direkt publish ediyoruz
          // İleride audio context ile filtreleme eklenebilir
        }

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
      toastOnce("Ekran paylaşımı başlatılamadı: " + e.message, "error");
    }
  };

  useEffect(() => {
    const handleHotkey = (action) => {
      if (action === "toggle-mute") toggleMute();
      if (action === "toggle-deafen") toggleDeaf();
      if (action === "toggle-camera") toggleCamera();
    };
    if (window.netrex) window.netrex.onHotkeyTriggered(handleHotkey);
    return () => {
      if (window.netrex) window.netrex.removeListener("hotkey-triggered");
    };
  }, [toggleMute, toggleDeaf, toggleCamera]);

  // Ekran paylaşımı menüsü için dışarı tıklama kontrolü
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showScreenShareMenu &&
        screenShareMenuRef.current &&
        screenShareButtonRef.current &&
        !screenShareMenuRef.current.contains(e.target) &&
        !screenShareButtonRef.current.contains(e.target)
      ) {
        setShowScreenShareMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showScreenShareMenu]);

  return (
    <>
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onStart={startScreenShare}
      />
      <div className="h-controls bg-gradient-to-t from-[#0e0f12] via-[#12131a] to-transparent flex items-center justify-center shrink-0 select-none relative overflow-visible py-3">
        {/* Animated top border glow */}
        <div className="absolute top-0 left-0 right-0 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-pulse-slow" />
        </div>
        
        {/* Background ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[150px] bg-gradient-to-t from-indigo-500/[0.08] via-purple-500/[0.04] to-transparent blur-[80px]" />
          <div className="absolute bottom-0 left-1/3 w-[300px] h-[100px] bg-cyan-500/[0.05] blur-[60px]" />
          <div className="absolute bottom-0 right-1/3 w-[300px] h-[100px] bg-pink-500/[0.04] blur-[60px]" />
        </div>
        
        {/* Kontrol Butonları Container */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 relative z-10 rounded-2xl sm:rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
          
          {/* Ses Kontrolleri Grubu */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-white/[0.03]">
            <ControlButton
              isActive={!isMuted}
              activeIcon={<Mic size={18} className="sm:w-5 sm:h-5" />}
              inactiveIcon={<MicOff size={18} className="sm:w-5 sm:h-5" />}
              onClick={toggleMute}
              tooltip={isMuted ? "Susturmayı Kaldır" : "Sustur"}
              danger={isMuted}
              disabled={isDeafened}
            />
            <ControlButton
              isActive={!isDeafened}
              activeIcon={<Headphones size={18} className="sm:w-5 sm:h-5" />}
              inactiveIcon={<VolumeX size={18} className="sm:w-5 sm:h-5" />}
              onClick={toggleDeaf}
              tooltip={isDeafened ? "Sağırlaştırmayı Kaldır" : "Sağırlaştır"}
              danger={isDeafened}
            />
          </div>
          
          {/* Ayırıcı */}
          <div className="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent mx-0.5 sm:mx-1" />
          
          {/* Video Kontrolleri Grubu */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-white/[0.03]">
            {/* Kamera Butonu */}
            <button
              onClick={toggleCamera}
              disabled={!enableCamera}
              className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                !enableCamera
                  ? "opacity-40 cursor-not-allowed bg-[#15151a] border border-red-500/20 text-red-400/60"
                  : isCameraOn
                  ? "bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 text-white shadow-[0_0_24px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_32px_rgba(99,102,241,0.5)] active:scale-95"
                  : "bg-[#15151a] border border-white/10 text-[#8b8d93] hover:bg-[#1e1f24] hover:text-white hover:border-white/20 active:scale-95"
              }`}
              title={
                !enableCamera
                  ? "Kamera Devre Dışı"
                  : isCameraOn
                  ? "Kamerayı Kapat"
                  : "Kamerayı Aç"
              }
            >
              {/* Shine effect on active */}
              {isCameraOn && enableCamera && (
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              )}
              <div className="relative z-10">
                {isCameraOn ? <Video size={18} className="sm:w-5 sm:h-5" /> : <VideoOff size={18} className="sm:w-5 sm:h-5" />}
              </div>
            </button>
            
            {/* Ekran Paylaşımı Butonu */}
            <div className="relative" ref={screenShareButtonRef}>
              <button
                onClick={() => {
                  if (isScreenSharing) {
                    setShowScreenShareMenu(!showScreenShareMenu);
                  } else {
                    setShowScreenShareModal(true);
                  }
                }}
                className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                  isScreenSharing
                    ? "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white shadow-[0_0_24px_rgba(34,197,94,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_32px_rgba(34,197,94,0.5)] active:scale-95"
                    : "bg-[#15151a] border border-white/10 text-[#8b8d93] hover:bg-[#1e1f24] hover:text-white hover:border-white/20 active:scale-95"
                }`}
                title={
                  isScreenSharing ? "Ekran Paylaşımı Seçenekleri" : "Ekran Paylaş"
                }
              >
                {/* Pulse ring when active */}
                {isScreenSharing && (
                  <>
                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-green-400/20 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  </>
                )}
                <div className="relative z-10">
                  {isScreenSharing ? (
                    <Monitor size={18} className="sm:w-5 sm:h-5" />
                  ) : (
                    <Monitor size={18} className="sm:w-5 sm:h-5" />
                  )}
                </div>
              </button>

              {/* Ekran Paylaşımı Menüsü */}
              {showScreenShareMenu && isScreenSharing && (
                <div
                  ref={screenShareMenuRef}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99999] w-60 animate-scaleIn origin-bottom backdrop-blur-2xl bg-gradient-to-br from-[#1a1b1f]/95 via-[#141518]/95 to-[#0e0f12]/95 overflow-hidden border border-white/10"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {/* Top glow line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-medium text-white/70">Yayın Aktif</span>
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowScreenShareMenu(false);
                        setShowScreenShareModal(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-sm font-medium text-white/90 hover:bg-gradient-to-r hover:from-indigo-500/15 hover:to-purple-500/15 transition-all duration-200 flex items-center gap-3 group/item"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                        <Monitor size={16} className="text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <span className="block">Ekranı Değiştir</span>
                        <span className="text-xs text-white/40">Farklı bir pencere seç</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-white/30 group-hover/item:text-white/70 group-hover/item:translate-x-1 transition-all duration-200"
                      />
                    </button>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1.5" />

                    <button
                      onClick={() => {
                        setShowScreenShareMenu(false);
                        stopScreenShare();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all duration-200 flex items-center gap-3 group/item"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <MonitorOff size={16} className="text-red-400" />
                      </div>
                      <div className="flex-1">
                        <span className="block">Paylaşımı Durdur</span>
                        <span className="text-xs text-red-400/50">Yayını sonlandır</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Ayırıcı */}
          <div className="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent mx-0.5 sm:mx-1" />
          
          {/* Çıkış butonu */}
          <button
            onClick={onLeave}
            className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/15 to-red-600/10 border border-red-500/30 text-red-400 hover:from-red-500/25 hover:to-red-600/20 hover:border-red-500/50 hover:text-red-300 hover:shadow-[0_0_24px_rgba(239,68,68,0.3)] transition-all duration-300 active:scale-95 group relative overflow-hidden"
            title="Bağlantıyı Kes"
          >
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-red-500/0 via-red-400/10 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <PhoneOff size={18} className="sm:w-5 sm:h-5 relative z-10" />
          </button>
        </div>
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
  const handleClick = (e) => {
    if (disabled) return;
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      title={tooltip}
      disabled={disabled}
      className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-300 relative group overflow-hidden ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-[#15151a] border border-red-500/20 text-red-400/60"
          : danger
          ? "bg-gradient-to-br from-red-500/15 to-red-600/10 border border-red-500/30 text-red-400 hover:from-red-500/25 hover:to-red-600/20 hover:border-red-500/50 hover:text-red-300 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] active:scale-95"
          : isActive
          ? "bg-[#15151a] border border-white/10 text-white hover:bg-[#1e1f24] hover:border-white/20 active:scale-95"
          : "bg-[#15151a] border border-white/10 text-[#8b8d93] hover:bg-[#1e1f24] hover:text-white hover:border-white/20 active:scale-95"
      }`}
    >
      {/* Hover shine effect */}
      {!disabled && !danger && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 pointer-events-none" />
      )}
      
      {/* Icon Container */}
      <div className="relative z-10">
        {isActive ? activeIcon : inactiveIcon}
      </div>

      {/* Disabled Overlay - Çizgi */}
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[70%] h-[2px] bg-red-400/50 rotate-45 rounded-full" />
        </div>
      )}
      
      {/* Danger glow on hover */}
      {danger && !disabled && (
        <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/0 to-red-500/0 group-hover:from-red-500/10 group-hover:to-red-600/5 transition-all duration-300 pointer-events-none" />
      )}
    </button>
  );
}
