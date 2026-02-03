
import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";

// Mikrofon ve kamera ayarları değiştiğinde track'leri yeniden oluştur
export default function SettingsUpdater({ isMuted, serverMuted, isDeafened, serverDeafened }) {
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

              // Mute durumunu kontrol et - Eğer susturulmuşsa mute et, değilse unmute et
              const shouldBeMuted = isMuted || serverMuted || isDeafened || serverDeafened;
              
              if (shouldBeMuted) {
                if (!newPublication.isMuted) {
                  await newPublication.setMuted(true);
                  if (newPublication.track) newPublication.track.enabled = false;
                }
              } else {
                if (newPublication.isMuted) {
                  await newPublication.setMuted(false);
                }
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
