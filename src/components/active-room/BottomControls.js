
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  ChevronUp,
  ChevronDown,
  Music
} from "lucide-react";
import { createPortal } from "react-dom";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useChatStore } from "@/src/store/chatStore";
import { useWatchPartyStore } from "@/src/store/watchPartyStore";
import { useWatchPartyPermission } from "@/src/hooks/useWatchPartyPermission";
import { useAuthStore } from "@/src/store/authStore";
import { startWatchParty, endWatchParty } from "@/src/services/watchPartyService";
import { toastOnce } from "@/src/utils/toast";
import ScreenShareModal from "../ScreenShareModal";

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

export default function BottomControls({
  username,
  serverId,
  channelId,
  onLeave,
  onOpenSettings,
  isDeafened,
  playSound,
  setPinnedStreamIds,
  pinnedStreamIds,
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
  const profileColor = useSettingsStore(state => state.profileColor);
  const enableCamera = useSettingsStore(state => state.enableCamera);
  const videoId = useSettingsStore(state => state.videoId);
  const videoResolution = useSettingsStore(state => state.videoResolution);
  const videoFrameRate = useSettingsStore(state => state.videoFrameRate);
  const videoCodec = useSettingsStore(state => state.videoCodec);
  const controlBarHidden = useSettingsStore(state => state.controlBarHidden);
  const toggleControlBarHidden = useSettingsStore(state => state.toggleControlBarHidden);
  const watchPartyEnabled = useSettingsStore(state => state.watchPartyEnabled);
  const { showChatPanel } = useChatStore();
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showScreenShareMenu, setShowScreenShareMenu] = useState(false);
  const screenShareMenuRef = useRef(null);
  const screenShareButtonRef = useRef(null);
  
  const [showWatchPartyMenu, setShowWatchPartyMenu] = useState(false);
  const watchPartyMenuRef = useRef(null);
  const watchPartyButtonRef = useRef(null);

  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const hasSentInitialMetadataRef = useRef(false); // İlk metadata gönderildi mi?
  
  const quickStatus = useSettingsStore(state => state.quickStatus);
  const toggleLastQuickStatus = useSettingsStore(state => state.toggleLastQuickStatus);

  // Watch Party
  const wpActive = useWatchPartyStore((state) => state.isActive);
  const currentUser = useAuthStore((s) => s.user);
  const wpPermissions = useWatchPartyPermission(serverId);

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
    quickStatus,
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
      quickStatus,
    };
  }, [isMuted, isDeafened, localParticipant, profileColor, isCameraOn, serverMuted, serverDeafened, mutedBy, deafenedBy, mutedAt, deafenedAt, quickStatus]);

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
      quickStatus,
      watchingStreamId: pinnedStreamIds?.[0] || null, // Geri uyumluluk için ilkini tut
      watchingStreamIds: pinnedStreamIds || [], // Yeni: Birden fazla yayın izliyor olabilir
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
    deafenedAt,
    quickStatus,
    pinnedStreamIds
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
        const constraints = {
          audio: audioConstraints || false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
              maxWidth: width,
              maxHeight: height,
              maxFrameRate: fps,
            },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Track'i aldıktan sonra resolution ve frame rate ayarlarını ekstra olarak uygula
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.applyConstraints) {
          try {
            await videoTrack.applyConstraints({
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: fps },
            });
          } catch (e) {
            // Constraint uygulanamazsa devam et
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
      
      // Çözünürlüğe ve FPS'ye göre bitrate ayarla (yüksek kalite için)
      const maxBitrate =
        resolution === 1440
          ? 8000000
          : resolution === 1080
          ? (fps > 30 ? 6000000 : 5000000)
          : resolution === 720
          ? (fps >= 60 ? 4000000 : 2500000)
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
          // 🔥 FIX: Track'i DURDUR - yoksa MediaStreamTrack capture etmeye devam eder (CPU leak)
          videoTrack.stop();
          localParticipant.unpublishTrack(videoTrack).catch(() => {});
          if (audioTrack) {
            audioTrack.stop();
            localParticipant.unpublishTrack(audioTrack).catch(() => {});
          }
          // Stream'deki tüm track'leri de durdur (garbage collection için)
          stream.getTracks().forEach(t => { try { t.stop(); } catch(e) {} });
          // PinnedStreamIds'den kaldır ki StageManager video element'i render etmesin
          setPinnedStreamIds(prev => prev.filter(id => id !== `${localParticipant.identity}:screen` && id !== localParticipant.identity));
        };
      } else {
        // Audio yoksa sadece video ve kullanılmayan audio'ları durdur
        if (audioTrack) audioTrack.stop(); // Kullanılmayan audio track'i hemen durdur
        
        videoTrack.onended = () => {
          // 🔥 FIX: Track'i DURDUR
          videoTrack.stop();
          localParticipant.unpublishTrack(videoTrack).catch(() => {});
          // Stream'deki tüm track'leri de durdur
          stream.getTracks().forEach(t => { try { t.stop(); } catch(e) {} });
          // PinnedStreamIds'den kaldır
          setPinnedStreamIds(prev => prev.filter(id => id !== `${localParticipant.identity}:screen` && id !== localParticipant.identity));
        };
      }

      setPinnedStreamIds(prev => Array.from(new Set([...(prev || []), `${localParticipant.identity}:screen`])));
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
      if (action === "toggle-quick-status") toggleLastQuickStatus();
    };
    
    // ✅ Modern pattern: onHotkeyTriggered returns cleanup function
    let cleanup;
    if (window.netrex) {
      cleanup = window.netrex.onHotkeyTriggered(handleHotkey);
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [toggleMute, toggleDeaf, toggleCamera, toggleLastQuickStatus]);

  // Ekran paylaşımı ve Watch Party menüleri için dışarı tıklama kontrolü
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
      
      if (
        showWatchPartyMenu &&
        watchPartyMenuRef.current &&
        watchPartyButtonRef.current &&
        !watchPartyMenuRef.current.contains(e.target) &&
        !watchPartyButtonRef.current.contains(e.target)
      ) {
        setShowWatchPartyMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showScreenShareMenu, showWatchPartyMenu]);

  return (
    <>
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onStart={startScreenShare}
      />
      
      {/* Show Toggle Button when control bar is hidden - Ultra Bright Indigo Neon - Rendered via Portal to escape stacking contexts */}
      {controlBarHidden && createPortal(
        <button
          onClick={toggleControlBarHidden}
          className="fixed bottom-6 right-6 z-[50000] pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl backdrop-blur-md bg-gradient-to-br from-indigo-600/90 to-indigo-500/80 border border-indigo-400/50 shadow-[0_8px_32px_rgba(79,70,229,0.4),0_0_20px_rgba(99,102,241,0.3)] hover:bg-indigo-500 hover:border-indigo-300 hover:shadow-[0_0_60px_rgba(99,102,241,0.8),0_0_30px_rgba(129,140,248,0.6),inset_0_0_20px_rgba(255,255,255,0.2)] hover:scale-110 active:scale-95 transition-all duration-300 animate-fadeScaleIn group overflow-hidden"
          title="Kontrolleri Göster"
        >
          {/* Glass Specular Highlight - Stronger */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/5 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity"></div>
          
          {/* Inner Glow animation */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Icon */}
          <ChevronUp size={22} className="text-white drop-shadow-md relative z-10 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all" strokeWidth={2.5} />
        </button>,
        document.body
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
              tooltip={serverMuted ? `Sunucu tarafından susturuldu (${mutedBy || "Yetkili"})` : isMuted ? "Susturmayı Kaldır" : "Sustur"}
              danger={isMuted}
              disabled={isDeafened || serverMuted}
            />
            <ControlButton
              isActive={!isDeafened}
              activeIcon={<Headphones size={20} className="sm:w-5 sm:h-5" />}
              inactiveIcon={<VolumeX size={20} className="sm:w-5 sm:h-5" />}
              onClick={toggleDeaf}
              tooltip={serverDeafened ? `Sunucu tarafından sağırlaştırıldı (${deafenedBy || "Yetkili"})` : isDeafened ? "Sağırlaştırmayı Kaldır" : "Sağırlaştır"}
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
          
          {/* Watch Party Butonu */}
          {serverId && watchPartyEnabled && (
            <div className="relative flex items-center" ref={watchPartyButtonRef}>
              <div className="w-px h-8 bg-white/10 mx-1"></div>
              <button
                onClick={() => {
                  if (!wpActive) {
                    if (wpPermissions.canStartParty) {
                      startWatchParty(serverId, channelId, currentUser?.uid);
                    } else {
                      toastOnce("Bu kanalda Watch Party başlatma yetkin yok.", "error");
                    }
                  } else {
                    setShowWatchPartyMenu(!showWatchPartyMenu);
                  }
                }}
                className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition-all duration-300 relative group ${
                  wpActive 
                    ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
                    : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
                }`}
                title={wpActive ? "Watch Party Seçenekleri" : "Watch Party Başlat"}
              >
                <div className="relative z-10">
                  <Music size={20} className="sm:w-5 sm:h-5" />
                </div>
              </button>

              {/* Watch Party Menüsü */}
              {showWatchPartyMenu && wpActive && (
                <div
                  ref={watchPartyMenuRef}
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
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-xs font-bold text-white/90">Watch Party Aktif</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowWatchPartyMenu(false);
                        useWatchPartyStore.getState().setLocalPref('showPlayer', true);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-[#b5bac1] hover:text-white hover:bg-white/5 transition-all flex items-center gap-3"
                    >
                      <Music size={16} />
                      Oynatıcıyı Göster
                    </button>

                    {wpPermissions.canControl && (
                      <button
                        onClick={() => {
                          setShowWatchPartyMenu(false);
                          endWatchParty(serverId, channelId);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-3"
                      >
                        <PhoneOff size={16} />
                        Watch Party'yi Kapat
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
