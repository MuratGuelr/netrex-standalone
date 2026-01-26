import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
  X,
  Maximize2,
  ChevronUp,
  ChevronDown,
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
import { useServerStore } from "@/src/store/serverStore";
import { db } from "@/src/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { generateLiveKitIdentity } from "@/src/utils/deviceId";
import { styleInjection } from "./active-room/ActiveRoomStyles";
import ParticipantList from "./active-room/ParticipantList";
import PipGrid from "./active-room/PipGrid";

// --- STYLES ---
// Styles moved to active-room/ActiveRoomStyles.js

// 1. Statik Arka Plan (Sürekli render olmasın diye memoize edildi)
const MemoizedBackground = React.memo(({ disableEffects }) => {
  if (disableEffects) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Animasyonları azalttık, static render */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[80px]" />
    </div>
  );
});

// 2. İzole Edilmiş Mikrofon Yöneticisi
const MemoizedMicrophoneManager = React.memo(() => {
  const audioTracks = useTracks([Track.Source.Microphone]);
  const { userVolumes } = useSettingsStore();

  return (
    <>
      {audioTracks.map((trackRef) => {
        const isRemote = !trackRef.participant.isLocal;
        const volumePercent = isRemote ? userVolumes[trackRef.participant.identity] ?? 100 : undefined;
        
        // Hesaplamayı render içinde yap, component dışında değil
        const volume = volumePercent !== undefined
            ? volumePercent === 0
              ? 0
              : volumePercent <= 100
              ? Math.pow(volumePercent / 100, 2.5)
              : Math.min(1.0 - ((200 - volumePercent) / 100) * 0.2, 1.0)
            : undefined;

        return (
          <AudioTrack
            key={trackRef.publication.trackSid}
            trackRef={trackRef}
            volume={isRemote ? volume : undefined}
          />
        );
      })}
    </>
  );
});

// --- MIKROFON YÖNETİCİSİ (ESKİ - ARTIK MEMOIZED KULLANILIYOR) ---
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
  const room = useRoomContext();
  const {
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode,
    videoResolution, // Kamera çözünürlüğü
    videoFrameRate, // Kamera FPS
    videoCodec, // Video codec
  } = useSettingsStore();

  const prevSettingsRef = useRef({
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode,
    videoResolution,
    videoFrameRate,
  });
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // localParticipant yoksa veya oda bağlı değilse bekle
    if (!localParticipant || !room || room.state !== ConnectionState.Connected) {
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
        videoResolution,
        videoFrameRate,
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

    // Video ayarları değişikliği - cihaz, çözünürlük veya FPS değişirse
    const videoSettingsChanged = 
      prevSettingsRef.current.videoId !== videoId ||
      prevSettingsRef.current.videoResolution !== videoResolution ||
      prevSettingsRef.current.videoFrameRate !== videoFrameRate;

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
        videoResolution,
        videoFrameRate,
      };
      return;
    }

    // Ayarlar değişti, track'leri yeniden oluştur
    const updateTracks = async () => {
      // Çifte kontrol: Oda hala bağlı mı?
      if (room.state !== ConnectionState.Connected) return;

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
              try {
                  await localParticipant.unpublishTrack(oldTrack);
                  oldTrack.stop();
              } catch (err) {
                  console.warn("Eski track durdurulurken hata:", err);
              }

              // Odanın hala bağlı olduğunu kontrol et
              if (room.state !== ConnectionState.Connected) {
                  newTrack.stop();
                  return;
              }

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

            // Çözünürlük ayarlarını belirle (kullanıcı ayarlarına göre)
            const resolutionMap = {
              "240p": { width: 426, height: 240, bitrate: 150000 },
              "360p": { width: 640, height: 360, bitrate: 300000 },
              "480p": { width: 854, height: 480, bitrate: 500000 },
            };
            const selectedResolution = resolutionMap[videoResolution] || resolutionMap["240p"];
            const selectedFps = videoFrameRate || 18;

            // Yeni constraint'lerle video stream'i al
            const constraints = {
              video: {
                deviceId:
                  videoId !== "default" ? { exact: videoId } : undefined,
                width: { ideal: selectedResolution.width, max: selectedResolution.width },
                height: { ideal: selectedResolution.height, max: selectedResolution.height },
                frameRate: { ideal: selectedFps, max: selectedFps },
              },
            };

            const newStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const newTrack = newStream.getVideoTracks()[0];

            if (newTrack) {
              // Eski track'i unpublish et
              try {
                  await localParticipant.unpublishTrack(oldTrack);
                  oldTrack.stop();
              } catch (err) {
                  console.warn("Eski video track durdurulurken hata:", err);
              }

              // Odanın hala bağlı olduğunu kontrol et
              if (room.state !== ConnectionState.Connected) {
                   newTrack.stop();
                   return;
              }

              // Yeni track'i publish et - Kullanıcı ayarlarına göre
              const newPublication = await localParticipant.publishTrack(
                newTrack,
                {
                  source: Track.Source.Camera,
                  videoEncoding: {
                    maxBitrate: selectedResolution.bitrate,
                    maxFramerate: selectedFps,
                  },
                  videoCodec: videoCodec || "vp8",
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
                console.log("✅ Kamera ayarları güncellendi:", {
                  resolution: videoResolution,
                  fps: selectedFps,
                  bitrate: selectedResolution.bitrate,
                });
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
          noiseSuppressionMode,
          videoResolution,
          videoFrameRate,
        };
      }
    };

    updateTracks();
  }, [
    localParticipant,
    room,
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode,
    videoResolution,
    videoFrameRate,
    videoCodec,
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
  roomDisplayName,
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
    setInVoiceRoom,
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
            roomDisplayName || roomName ? `"${roomDisplayName || roomName}"` : ""
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
            roomDisplayName || roomName ? `"${roomDisplayName || roomName}"` : ""
          } odasından ayrıldı`,
          false
        );
      }
    };

    // Bağlantı event'leri
    const onRoomConnected = () => {
      // 🚀 v5.2: Ses odasına bağlandı - idle detection'a bildir
      setInVoiceRoom(true);
      
      // Sadece development'ta log göster (spam'i önlemek için)
      if (process.env.NODE_ENV === "development") {
        console.log("Room connected - idle detection disabled");
      }
      if (onConnected) onConnected();
    };

    const onRoomDisconnected = (reason) => {
      // 🚀 v5.2: Ses odasından ayrıldı - idle detection'a bildir
      setInVoiceRoom(false);
      
      // Her zaman log göster (önemli bir event)
      console.log("Room disconnected - idle detection enabled:", reason);
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
          const userData = { 
            userId, 
            username,
            photoURL: user?.photoURL || null
          };
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

    // Handle standard browser unload (refresh/close tab)
    const handleBeforeUnload = (e) => {
      // Synchronous/Fast cleanup for browser close
      cleanup().catch(console.error);
    };

    // Electron IPC event listener: Register cleanup task
    let unregisterCleanup = null;
    if (typeof window !== "undefined" && window.netrex) {
      const { registerCleanupTask } = require("@/src/utils/cleanup");
      unregisterCleanup = registerCleanupTask(async () => {
         console.log("🛑 ActiveRoom App closing cleanup started...");
         await cleanup();
      });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (unregisterCleanup) unregisterCleanup();
      
      // Critical: Explicitly disconnect room on unmount to prevent ghost participants
      if (room && room.state !== ConnectionState.Disconnected) {
          room.disconnect();
      }
    };
  }, [room, roomName, userId, username]);

  return null;
}
function DeafenManager({ isDeafened, serverDeafened }) {
  useEffect(() => {
    const muteAll = () => {
      document.querySelectorAll("audio").forEach((el) => {
        el.muted = isDeafened || serverDeafened;
      });
    };
    muteAll();
    const obs = new MutationObserver(muteAll);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isDeafened, serverDeafened]);
  return null;
}
// useAudioActivity moved to active-room/hooks/useAudioActivity.js

// Moderasyon Komutlarını Dinleyen ve Mikrofon Senkronizasyonu Yapan Bileşen
function ModerationHandler({ 
  setServerMuted, 
  setServerDeafened, 
  setMutedBy,
  setDeafenedBy,
  setMutedAt,
  setDeafenedAt,
  serverMuted, 
  serverDeafened, 
  isDeafened, 
  setIsDeafened, 
  isMuted, 
  setIsMuted, 
  playSound 
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Mikrofon ve Hoparlör durumunu hem manuel hem de sunucu kısıtlamalarına göre senkronize et
  useEffect(() => {
    if (localParticipant) {
      // Mikrofon açık olmalı mı? (Manuel mute kapalı VE sunucu susturması kapalı VE sağırlaştırma kapalı)
      const shouldEnableMic = !(isMuted || serverMuted || isDeafened || serverDeafened);
      localParticipant.setMicrophoneEnabled(shouldEnableMic);
    }
  }, [isMuted, serverMuted, isDeafened, serverDeafened, localParticipant]);

  // İlk bağlantıda metadata'dan durumu oku
  useEffect(() => {
    if (localParticipant && localParticipant.metadata) {
       try {
         const meta = JSON.parse(localParticipant.metadata);
         if (meta.serverMuted !== undefined) setServerMuted(meta.serverMuted);
         if (meta.serverDeafened !== undefined) setServerDeafened(meta.serverDeafened);
         if (meta.mutedBy) setMutedBy(meta.mutedBy);
         if (meta.deafenedBy) setDeafenedBy(meta.deafenedBy);
         if (meta.mutedAt) setMutedAt(meta.mutedAt);
         if (meta.deafenedAt) setDeafenedAt(meta.deafenedAt);
       } catch (e) {
         console.error("Metadata parse error:", e);
       }
    }
  }, [localParticipant, setServerMuted, setServerDeafened, setMutedBy, setDeafenedBy, setMutedAt, setDeafenedAt]);

  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleDataReceived = (payload, participant) => {
      // Sadece debugging için log ekleyelim
      if (process.env.NODE_ENV === "development") {
        console.log("📨 Veri alındı:", participant?.identity);
      }
      const str = new TextDecoder().decode(payload);
      try {
        const data = JSON.parse(str);
        if (data.type === "MODERATION_COMMAND") {
          if (process.env.NODE_ENV === "development") {
            console.log("🛠️ Moderasyon komutu:", data.action, "Hedef:", data.targetId, "Sen:", localParticipant.identity);
          }
          // Eğer hedef bensem
           if (data.targetId === localParticipant.identity) {
             if (data.action === "MUTE") {
               const modName = data.moderatorName || "Bir yetkili";
               setServerMuted(data.value);
               if (data.value) {
                 setMutedBy(modName);
                 setMutedAt(Date.now());
               } else {
                 setMutedBy(null);
                 setMutedAt(null);
               }
               
               // Metadata güncellemesi artık ActiveRoom'un ana useEffect'i tarafından yapılacak

               // Sadece bildirim ve ses
               if (data.value) {
                 playSound("mute");
                 toast.error(`${modName} tarafından susturuldunuz.`, {
                   icon: <MicOff className="text-red-500" size={18} />
                 });
               } else {
                 playSound("unmute");
                 toast.success(`${modName} susturmanızı kaldırdı.`, {
                   icon: <Mic className="text-green-500" size={18} />
                 });
               }
             } else if (data.action === "DEAFEN") {
                const modName = data.moderatorName || "Bir yetkili";
                const newValue = data.value;
                setServerDeafened(newValue);
                if (newValue) {
                  setDeafenedBy(modName);
                  setDeafenedAt(Date.now());
                } else {
                  setDeafenedBy(null);
                  setDeafenedAt(null);
                }

                if (newValue) {
                  playSound("deafen");
                  toast.error(`${modName} tarafından sağırlaştırıldınız.`, {
                    icon: <VolumeX className="text-red-500" size={18} />
                  });
                } else {
                  playSound("undeafen");
                  toast.success(`${modName} sağırlaştırmanızı kaldırdı.`, {
                    icon: <Headphones className="text-green-500" size={18} />
                  });
                }
             }
          }
        }
      } catch (e) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => room.off(RoomEvent.DataReceived, handleDataReceived);
  }, [room, localParticipant, setServerMuted, setServerDeafened, isDeafened, setIsDeafened, setIsMuted, playSound, setMutedBy, setDeafenedBy, setMutedAt, setDeafenedAt]);

  return null;
}

// --- ANA BİLEŞEN ---
export default function ActiveRoom({
  roomName,
  displayName,
  username,
  onLeave,
  currentTextChannel,
  userId,
}) {
  const { user } = useAuthStore();
  const [token, setToken] = useState("");
  const [showSettingsLocal, setShowSettingsLocal] = useState(false);
  
  // Voice State and Settings Modal - Global Store'dan al
  const { isMuted, isDeafened, toggleMute, toggleDeaf, showSettingsModal, setSettingsOpen } = useSettingsStore();
  
  // Settings modal: hem lokal state hem de store'dan açılabilir
  const showSettings = showSettingsLocal || showSettingsModal;
  const setShowSettings = (value) => {
    setShowSettingsLocal(value);
    if (!value) setSettingsOpen(false); // Kapatırken store'u da sıfırla
  };

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hideIncomingVideo, setHideIncomingVideo] = useState(false);
  const [serverMuted, setServerMuted] = useState(false);
  const [serverDeafened, setServerDeafened] = useState(false);
  // New States for enhanced moderation feedback
  const [mutedBy, setMutedBy] = useState(null);
  const [deafenedBy, setDeafenedBy] = useState(null);
  const [mutedAt, setMutedAt] = useState(null);
  const [deafenedAt, setDeafenedAt] = useState(null);

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
  
  // 🚀 v5.2: LiveKit Server Pool
  const [serverUrl, setServerUrl] = useState(process.env.NEXT_PUBLIC_LIVEKIT_URL || '');
  const [serverIndex, setServerIndex] = useState(0);
  const [serverPoolMode, setServerPoolMode] = useState(false);
  const [serverCount, setServerCount] = useState(1);
  const rotationCountRef = useRef(0); // Sonsuz döngüyü önlemek için sayaç
  const MAX_ROTATIONS = 3; // Maksimum rotation sayısı
  const poolDocRef = useRef(null); // Firebase pool document reference
  const serverIndexRef = useRef(serverIndex); // Ref ile takip (callback'lerde güncel değer için)
  
  // serverIndex değiştiğinde ref'i güncelle
  useEffect(() => {
    serverIndexRef.current = serverIndex;
  }, [serverIndex]);

  // 🚀 v5.2: Firebase'den aktif sunucu indeksini dinle (tüm kullanıcılar senkronize olsun)
  useEffect(() => {
    if (!serverPoolMode) return;
    
    poolDocRef.current = doc(db, "system", "livekitPool");
    
    // Real-time listener
    const unsubscribe = onSnapshot(poolDocRef.current, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const firebaseIndex = data.activeServerIndex || 0;
        
        // Eğer Firebase'deki index farklıysa, değiştir (ref kullan - güncel değer için)
        if (firebaseIndex !== serverIndexRef.current) {
          console.log(`🔄 Firebase'den sunucu değişikliği algılandı: ${serverIndexRef.current} → ${firebaseIndex}`);
          
          try {
            const serverInfo = await window.netrex.getLiveKitServerInfo(firebaseIndex);
            if (serverInfo && serverInfo.url) {
              setServerIndex(firebaseIndex);
              setServerUrl(serverInfo.url);
              // NOT: Token useEffect tarafından otomatik yenilenecek
            }
          } catch (e) {
            console.error("Firebase sunucu değişikliği uygulanamadı:", e);
          }
        }
      }
    }, (error) => {
      console.error("Firebase pool listener hatası:", error);
    });
    
    return () => unsubscribe();
  }, [serverPoolMode]); // serverIndex dependency'den kaldırıldı - ref kullanıyoruz

  // Firebase'de pool document'ı oluştur/güncelle (ilk bağlantıda)
  useEffect(() => {
    if (!serverPoolMode || serverCount <= 1) return;
    
    const initializePoolDoc = async () => {
      try {
        const poolRef = doc(db, "system", "livekitPool");
        const poolDoc = await getDoc(poolRef);
        
        if (!poolDoc.exists()) {
          // İlk kez oluştur
          await setDoc(poolRef, {
            activeServerIndex: 0,
            serverCount: serverCount,
            lastRotation: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          console.log("✅ Firebase LiveKit pool oluşturuldu");
        }
      } catch (e) {
        console.error("Firebase pool init hatası:", e);
      }
    };
    
    initializePoolDoc();
  }, [serverPoolMode, serverCount]);


  const { 
    noiseSuppression, 
    echoCancellation, 
    autoGainControl, 
    disableAnimations,
    disableBackgroundEffects,
    videoCodec,
    videoResolution,
    videoFrameRate,
    enableCamera,
    videoId
  } = useSettingsStore();

  // Inject Global Animation Disable Config
  useEffect(() => {
    if (disableAnimations) {
      const styleId = 'disable-animations-global';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          *, *::before, *::after {
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            scroll-behavior: auto !important;
          }
        `;
        document.head.appendChild(style);
      }
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [disableAnimations]);
  const { playSound } = useSoundEffects();
  const { channels } = useServerStore();

  // NOT: useLocalParticipant hook'u sadece LiveKitRoom içinde çalışır.
  // Mikrofon senkronizasyonu MicrophoneSyncHandler bileşeninde yapılır (LiveKitRoom içinde).

  const roomDisplayName = useMemo(() => {
    if (displayName) return displayName;
    const channel = channels?.find(c => c.id === roomName);
    return channel?.name || roomName;
  }, [displayName, channels, roomName]);

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

  // settingsStore'dan mute/deafen durumlarını sıfırlamak için set fonksiyonunu al
  const settingsStore = useSettingsStore;
  
  useEffect(() => {
    // Room değiştiğinde state'leri sıfırla (eski room'dan temiz çıkış için)
    setToken(""); // Token'ı sıfırla ki eski room'dan disconnect olsun
    setConnectionError(null);
    setIsReconnecting(false);
    setHasConnectedOnce(false);
    hasConnectedOnceRef.current = false;
    setActiveStreamId(null); // Aktif stream'i sıfırla
    setIsCameraOn(false); // Kamera durumunu sıfırla
    
    // ÖNEMLİ: Odaya her bağlanıldığında mute/deafen durumlarını sıfırla
    // Bu, önceki oturumdan kalan görsel durumun gerçek durumla senkronize olmasını sağlar
    settingsStore.setState({ isMuted: false, isDeafened: false });

    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    (async () => {
      try {
        if (window.netrex) {
          // 🚀 v5.2: Server pool - önce sunucu bilgisini al
          let currentServerIndex = serverIndex;
          let currentServerUrl = serverUrl;
          
          try {
            // Önce electron'dan pool bilgisini al
            const serverInfo = await window.netrex.getLiveKitServerInfo(currentServerIndex);
            
            if (serverInfo && serverInfo.poolMode) {
              // Pool modu aktif - Firebase'den aktif sunucu indeksini oku
              try {
                const poolRef = doc(db, "system", "livekitPool");
                const poolDoc = await getDoc(poolRef);
                
                if (poolDoc.exists()) {
                  const firebaseIndex = poolDoc.data().activeServerIndex || 0;
                  console.log(`📡 Firebase'den aktif sunucu okundu: ${firebaseIndex}`);
                  
                  // Firebase'deki indekse göre sunucu bilgisini al
                  const activeServerInfo = await window.netrex.getLiveKitServerInfo(firebaseIndex);
                  if (activeServerInfo && activeServerInfo.url) {
                    currentServerUrl = activeServerInfo.url;
                    currentServerIndex = activeServerInfo.serverIndex;
                  }
                }
              } catch (firebaseError) {
                console.warn("Firebase pool okunamadı, varsayılan sunucu kullanılıyor:", firebaseError);
              }
              
              setServerPoolMode(true);
              setServerCount(serverInfo.serverCount || 1);
            } else if (serverInfo) {
              // Tek sunucu modu - serverInfo'dan URL al
              currentServerUrl = serverInfo.url || currentServerUrl;
              currentServerIndex = serverInfo.serverIndex || 0;
            }
            
            setServerUrl(currentServerUrl);
            setServerIndex(currentServerIndex);
            rotationCountRef.current = 0; // Başarılı bağlantıda sayacı sıfırla
            console.log(`🔌 LiveKit server: ${currentServerUrl} (index: ${currentServerIndex}, pool: ${serverInfo?.poolMode}, count: ${serverInfo?.serverCount})`);
          } catch (serverInfoError) {
            console.warn('⚠️ Server info alınamadı, default kullanılıyor:', serverInfoError);
          }
          
          // Use userId directly as identity to prevent ghost participants
          // generateLiveKitIdentity adds device suffix which causes duplicates on refresh
          const identity = userId;
          
          // Get token with stable identity, display name, and server index
          const t = await window.netrex.getLiveKitToken(roomName, identity, username, currentServerIndex);
          setToken(t);

          // 20 saniye içinde bağlantı kurulamazsa hata göster
          connectionTimeoutRef.current = setTimeout(() => {
            // Eğer hala bağlanmadıysa hata göster
            if (!hasConnectedOnceRef.current) {
              setConnectionError(`Odaya bağlanılamadı (Timeout). URL: ${currentServerUrl}`);
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
  }, [roomName, username, userId, serverIndex]);

  // Component unmount veya room değiştiğinde cleanup
  useEffect(() => {
    return () => {
      // Component unmount olduğunda Firebase'den temizle - Optimize: cleanup
      if (userId && roomName) {
        const presenceRef = doc(db, "room_presence", roomName);
        updateDoc(presenceRef, {
          users: arrayRemove({ 
            userId, 
            username,
            photoURL: user?.photoURL || null
          }),
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
          users: arrayRemove({ 
            userId, 
            username,
            photoURL: user?.photoURL || null
          }),
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
        // photoURL'i de ekle
        const userData = { 
          userId, 
          username,
          photoURL: user?.photoURL || null
        };
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
          users: arrayRemove({ 
            userId, 
            username,
            photoURL: user?.photoURL || null
          }),
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
  // 🚀 v5.2: Server pool - hata durumunda sonraki sunucuya geç
  const handleError = async (error) => {
    console.error("LiveKit bağlantı hatası:", error);
    
    const errorMessage = error?.message || '';
    
    // Quota/limit hataları - server pool ile çözülebilir
    const quotaErrors = [
      'quota exceeded',
      'rate limit',
      'limit reached',
      'connection limit',
      'participant limit',
      'minutes exceeded',
      'free tier',
      '429',
      '503',
    ];
    
    const isQuotaError = quotaErrors.some(q => 
      errorMessage.toLowerCase().includes(q.toLowerCase())
    );
    
    // Server pool modunda ve quota hatası aldıysak
    if (serverPoolMode && isQuotaError) {
      // Sonsuz döngü koruması
      if (rotationCountRef.current >= MAX_ROTATIONS) {
        console.error(`❌ Maksimum rotation sayısına ulaşıldı (${MAX_ROTATIONS}). Tüm sunucular dolu olabilir.`);
        setConnectionError(`Tüm LiveKit sunucuları dolu. Lütfen daha sonra tekrar deneyin.`);
        return;
      }
      
      rotationCountRef.current++;
      console.warn(`⚠️ LiveKit quota hatası algılandı, sunucu değiştiriliyor... (rotation ${rotationCountRef.current}/${MAX_ROTATIONS})`);
      
      try {
        // Sonraki sunucuyu al (modulo ile döngüsel)
        // serverCount en az 2 olmalı rotation için
        if (serverCount < 2) {
          console.warn('⚠️ Sadece 1 sunucu var, rotation yapılamaz');
          // Tek sunucu modunda hata göster
          if (hasConnectedOnce) {
            setConnectionError(`Bağlantı hatası: ${errorMessage || "Sunucu kotası dolmuş olabilir."}`);
          }
          return;
        }
        const nextIndex = (serverIndex + 1) % serverCount;
        const serverInfo = await window.netrex.getLiveKitServerInfo(nextIndex);
        
        if (serverInfo && serverInfo.url) {
          // 🚀 v5.2: Firebase'i güncelle - TÜM kullanıcılar bu sunucuya geçecek
          try {
            const poolRef = doc(db, "system", "livekitPool");
            // setDoc with merge: true - doküman yoksa oluşturur, varsa günceller
            await setDoc(poolRef, {
              activeServerIndex: serverInfo.serverIndex,
              lastRotation: serverTimestamp(),
              lastError: errorMessage,
              lastErrorTime: serverTimestamp(),
            }, { merge: true });
            console.log(`📡 Firebase güncellendi: activeServerIndex = ${serverInfo.serverIndex}`);
          } catch (firebaseError) {
            console.error("Firebase güncelleme hatası:", firebaseError);
          }
          
          // Yeni sunucuya geç (bu useEffect'i tetikleyecek ve yeni token alınacak)
          setServerIndex(serverInfo.serverIndex);
          setServerUrl(serverInfo.url);
          setConnectionError(null); // Hatayı temizle
          console.log(`🔄 LiveKit server rotated: ${serverIndex} → ${serverInfo.serverIndex}`);
          return; // Hata gösterme, yeniden dene
        }
      } catch (rotationError) {
        console.error('Server rotation hatası:', rotationError);
      }
    }
    
    // Sadece başarılı bağlantıdan sonra hata olursa göster
    if (hasConnectedOnce) {
      setConnectionError(`${errorMessage || "Bağlantı hatası oluştu."} (URL: ${serverUrl})`);
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
      roomName: roomName,
    });
  };

  // Token yoksa loading göster
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0c] relative overflow-hidden">
        {/* Animated background */}
        {/* Animated background - Conditional Rendering */}
        {!disableBackgroundEffects && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        )}
        
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
      // KEY: roomName + serverIndex değiştiğinde component'i tamamen yeniden mount et
      key={`${roomName}-${serverIndex}`}
      // DÜZELTME: video={false} yapıyoruz ki otomatik yönetim manuel fonksiyonumuzla çakışmasın.
      video={false}
      audio={true}
      token={token}
      // 🚀 v5.2: Server pool - dinamik URL
      serverUrl={serverUrl}
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
      <MemoizedBackground disableEffects={disableBackgroundEffects} />
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
        roomDisplayName={roomDisplayName}
        userId={userId}
        username={username}
      />
      <MemoizedMicrophoneManager />
      <ModerationHandler 
        setServerMuted={setServerMuted} 
        setServerDeafened={setServerDeafened}
        setMutedBy={setMutedBy}
        setDeafenedBy={setDeafenedBy}
        setMutedAt={setMutedAt}
        setDeafenedAt={setDeafenedAt}
        serverMuted={serverMuted}
        serverDeafened={serverDeafened}
        isDeafened={isDeafened}
        isMuted={isMuted}
        playSound={playSound}
      />

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
                      const identity = userId;
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

      <style dangerouslySetInnerHTML={{ __html: styleInjection }} />
      <RoomAudioRenderer />
      <DeafenManager isDeafened={isDeafened} serverDeafened={serverDeafened} />
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
                {roomDisplayName}
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
            onDeafenToggle={toggleDeaf}
            isMuted={isMuted}
            onMuteToggle={toggleMute}
            serverMuted={serverMuted}
            serverDeafened={serverDeafened}
            playSound={playSound}
            setActiveStreamId={setActiveStreamId}
            isCameraOn={isCameraOn}
            setIsCameraOn={setIsCameraOn}
            stopScreenShare={stopScreenShare}
            chatPosition={chatPosition}
            mutedBy={mutedBy}
            deafenedBy={deafenedBy}
            mutedAt={mutedAt}
            deafenedAt={deafenedAt}
          />
        )}
      />
      {contextMenu && (
        <UserContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          participant={contextMenu.participant}
          isLocal={contextMenu.isLocal}
          roomName={contextMenu.roomName}
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

// DraggablePip removed in favor of Native Picture-in-Picture

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
      // 🚀 THROTTLE: 100ms aralıklarla işle
      const now = Date.now();
      if (now - lastOverlayMouseMoveRef.current < 100) return;
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
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
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

        {/* Native PiP Grid Component */}
        <PipGrid 
            ref={pipGridRef} 
            tracks={validCameraTracks} 
            isSelfSharing={isLocalSharing} 
        />

        {/* Overlay Gradients - Top and Bottom only (Center remains clear) */}
        {/* Top Gradient */}
        <div
          className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-500 pointer-events-none ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Bottom Gradient */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-500 pointer-events-none ${
            showOverlay ? "opacity-100" : "opacity-0"
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
                : trackRef.source === Track.Source.ScreenShare
                ? `${participant?.name || participant?.identity || "Kullanıcı"} yayını`
                : `${participant?.name || participant?.identity || "Kullanıcı"} kamerası`}
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
            {/* PiP Toggle Button - Native Window Mode */}
            {trackRef.source !== Track.Source.Camera && cameraTracks.some(t => t.participant.identity === pipParticipant?.identity) && (
              <button
                onClick={togglePip}
                className={`backdrop-blur-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] hover:border-white/20 text-white/70 hover:text-white p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 group/btn z-[100] ${
                  showOverlay ? "opacity-100" : "opacity-0"
                } ${showPip ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" : ""}`}
                title={showPip ? "Pencereyi Kapat" : "Pencere Moduna Al"}
              >
                {showPip ? <Layers size={18} className="sm:w-5 sm:h-5" /> : <Monitor size={18} className="sm:w-5 sm:h-5" />}
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

// ParticipantList, ScreenSharePreviewComponent, UserCard moved to separate files in active-room/

// --- ALT KONTROLLER ---
function BottomControls({
  username,
  onLeave,
  onOpenSettings,
  isDeafened,
  playSound,
  setActiveStreamId,
  isCameraOn,
  setIsCameraOn,
  stopScreenShare,
  chatPosition,
  serverMuted,
  serverDeafened,
  isMuted,
  onMuteToggle,
  onDeafenToggle,
  mutedBy,
  deafenedBy,
  mutedAt,
  deafenedAt,
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const { 
    profileColor, 
    enableCamera, 
    videoId, 
    videoResolution, 
    videoFrameRate, 
    videoCodec,
    controlBarHidden,
    toggleControlBarHidden,
  } = useSettingsStore();
  const { showChatPanel } = useChatStore();
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showScreenShareMenu, setShowScreenShareMenu] = useState(false);
  const screenShareMenuRef = useRef(null);
  const screenShareButtonRef = useRef(null);
  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const hasSentInitialMetadataRef = useRef(false); // İlk metadata gönderildi mi?
  
  const stateRef = useRef({
    isMuted,
    isDeafened,
    localParticipant,
    profileColor,
    isCameraOn,
    serverMuted,
    serverDeafened,
    mutedBy,
    deafenedBy,
    mutedAt,
    deafenedAt,
  });
  useEffect(() => {
    stateRef.current = {
      isMuted,
      isDeafened,
      localParticipant,
      profileColor,
      isCameraOn,
      serverMuted,
      serverDeafened,
      mutedBy,
      deafenedBy,
      mutedAt,
      deafenedAt,
    };
  }, [isMuted, isDeafened, localParticipant, profileColor, isCameraOn, serverMuted, serverDeafened, mutedBy, deafenedBy, mutedAt, deafenedAt]);

  // Metadata update'i debounce et (timeout önlemek için)
  const metadataUpdateRef = useRef(null);
  const lastMetadataRef = useRef("");
  const isUpdatingMetadataRef = useRef(false);

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
      serverMuted,
      serverDeafened,
      mutedBy: serverMuted ? mutedBy : null,
      deafenedBy: serverDeafened ? deafenedBy : null,
      mutedAt: serverMuted ? mutedAt : null,
      deafenedAt: serverDeafened ? deafenedAt : null,
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
    serverMuted,
    serverDeafened,
    mutedBy,
    deafenedBy,
    mutedAt,
    deafenedAt
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
    const { isMuted } = stateRef.current;
    onMuteToggle();
    playSound(!isMuted ? "mute" : "unmute");
  }, [playSound, onMuteToggle]);

  const toggleDeaf = useCallback(() => {
    const { isDeafened } = stateRef.current;
    onDeafenToggle();
    playSound(!isDeafened ? "deafen" : "undeafen");
  }, [playSound, onDeafenToggle]);

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
          "240p": { width: 426, height: 240, bitrate: 150000 },
          "360p": { width: 640, height: 360, bitrate: 300000 },
          "480p": { width: 854, height: 480, bitrate: 500000 },
        };
        const selectedResolution = resolutionMap[videoResolution] || resolutionMap["240p"];
        const selectedFps = videoFrameRate || 18;

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
            videoCodec: videoCodec || "vp8",
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
      
      {/* Show Toggle Button when control bar is hidden - Ultra Bright Indigo Neon */}
      {controlBarHidden && (
        <button
          onClick={toggleControlBarHidden}
          className="fixed bottom-6 right-6 z-[999] pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl backdrop-blur-md bg-gradient-to-br from-indigo-600/90 to-indigo-500/80 border border-indigo-400/50 shadow-[0_8px_32px_rgba(79,70,229,0.4),0_0_20px_rgba(99,102,241,0.3)] hover:bg-indigo-500 hover:border-indigo-300 hover:shadow-[0_0_60px_rgba(99,102,241,0.8),0_0_30px_rgba(129,140,248,0.6),inset_0_0_20px_rgba(255,255,255,0.2)] hover:scale-110 active:scale-95 transition-all duration-300 animate-fadeScaleIn group overflow-hidden"
          title="Kontrolleri Göster"
        >
          {/* Glass Specular Highlight - Stronger */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/5 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity"></div>
          
          {/* Inner Glow animation */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Icon */}
          <ChevronUp size={22} className="text-white drop-shadow-md relative z-10 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all" strokeWidth={2.5} />
        </button>
      )}
      
      {/* Floating Control Bar Container */}
      <div 
        className={`h-controls absolute bottom-0 pb-12 flex items-center justify-center shrink-0 select-none z-50 pointer-events-none transition-all duration-700 ease-in-out origin-bottom-right ${
          controlBarHidden 
            ? 'opacity-0 pointer-events-none translate-x-[calc(50vw-80px)] scale-[0.15]' 
            : 'opacity-100 translate-x-0 scale-100'
        } ${!showChatPanel || chatPosition !== "left" ? "left-0" : "left-[380px]"} ${!showChatPanel || chatPosition !== "right" ? "right-0" : "right-[380px]"}`}
      >
        {/* Kontrol Butonları - Floating Glass Style */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 relative z-10 rounded-2xl backdrop-blur-2xl bg-[#131418]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:bg-[#131418] hover:border-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          {/* Inner Glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

          {/* Ses Kontrolleri Grubu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <ControlButton
              isActive={!isMuted}
              activeIcon={<Mic size={20} className="sm:w-5 sm:h-5" />}
              inactiveIcon={<MicOff size={20} className="sm:w-5 sm:h-5" />}
              onClick={toggleMute}
              tooltip={isMuted ? "Susturmayı Kaldır" : "Sustur"}
              danger={isMuted}
              disabled={isDeafened}
            />
            <ControlButton
              isActive={!isDeafened}
              activeIcon={<Headphones size={20} className="sm:w-5 sm:h-5" />}
              inactiveIcon={<VolumeX size={20} className="sm:w-5 sm:h-5" />}
              onClick={toggleDeaf}
              tooltip={isDeafened ? "Sağırlaştırmayı Kaldır" : "Sağırlaştır"}
              danger={isDeafened}
            />
          </div>
          
          {/* Ayırıcı */}
          <div className="w-px h-8 bg-white/10 mx-1"></div>
          
          {/* Video Kontrolleri Grubu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Kamera Butonu */}
            <button
              onClick={toggleCamera}
              disabled={!enableCamera}
              className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition-all duration-300 relative group ${
                !enableCamera
                  ? "opacity-40 cursor-not-allowed bg-white/5 border border-white/5 text-white/40"
                  : isCameraOn
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]"
                  : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
              }`}
              title={
                !enableCamera
                  ? "Kamera Devre Dışı"
                  : isCameraOn
                  ? "Kamerayı Kapat"
                  : "Kamerayı Aç"
              }
            >
              <div className="relative z-10">
                {isCameraOn ? <Video size={20} className="sm:w-5 sm:h-5" /> : <VideoOff size={20} className="sm:w-5 sm:h-5" />}
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
                className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition-all duration-300 relative group ${
                  isScreenSharing
                    ? "bg-[#23a559] text-white shadow-[0_0_20px_rgba(35,165,89,0.3)] hover:bg-[#1b8746] hover:scale-105 hover:shadow-[0_0_25px_rgba(35,165,89,0.4)]"
                    : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
                }`}
                title={
                  isScreenSharing ? "Ekran Paylaşımı Seçenekleri" : "Ekran Paylaş"
                }
              >
                <div className="relative z-10">
                  <Monitor size={20} className="sm:w-5 sm:h-5" />
                </div>
              </button>

              {/* Ekran Paylaşımı Menüsü */}
              {showScreenShareMenu && isScreenSharing && (
                <div
                  ref={screenShareMenuRef}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-[99999] w-64 animate-scaleIn origin-bottom bg-[#111214] border border-white/10 overflow-hidden"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="p-1.5 space-y-1">
                    <div className="px-3 py-2 flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs font-bold text-white/90">Yayın Aktif</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowScreenShareMenu(false);
                        setShowScreenShareModal(true);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-[#b5bac1] hover:text-white hover:bg-white/5 transition-all flex items-center gap-3"
                    >
                      <Monitor size={16} />
                      Ekranı Değiştir
                    </button>

                    <button
                      onClick={() => {
                        setShowScreenShareMenu(false);
                        stopScreenShare();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-3"
                    >
                      <MonitorOff size={16} />
                      Paylaşımı Durdur
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Ayırıcı */}
          <div className="w-px h-8 bg-white/10 mx-1"></div>
          
          {/* Çıkış butonu */}
          <button
            onClick={onLeave}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300 active:scale-95 group relative overflow-hidden"
            title="Bağlantıyı Kes"
          >
            <PhoneOff size={20} className="sm:w-5 sm:h-5 relative z-10" />
          </button>
          
          {/* Ayırıcı */}
          <div className="w-px h-6 bg-white/10"></div>
          
          {/* Hide Button */}
          <button
            onClick={toggleControlBarHidden}
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-all duration-200 hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30"
            title="Kontrolleri Gizle"
          >
            <ChevronDown size={16} className="text-white/40 hover:text-indigo-400 transition-colors" />
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
      className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition-all duration-300 relative group ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-white/5 border border-white/5 text-white/40"
          : danger
          ? "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95"
          : isActive
          ? "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 active:scale-95"
          : "bg-[#1e1f22] border border-white/5 text-[#b5bac1] hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
      }`}
    >
      
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
    </button>
  );
}
