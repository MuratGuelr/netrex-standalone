
import { useEffect, useState } from "react";
import { useParticipantInfo } from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";

export function useAudioActivity(participant) {
  // 🚀 CPU OPTİMİZASYONU: Remote kullanıcılar için AudioContext OLUŞTURMA!
  // Uzaktaki kullanıcılar için zaten LiveKit sunucusundan gelen "isSpeaking" verisi var (UserCard.js içinde kullanılıyor).
  // Bu hook'u çağırmak her bir kullanıcı için ayrı bir ses motoru açıp işlemciyi boğuyordu.
  if (!participant?.isLocal) return false;

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
        // 🚀 OPTIMIZED: 256 -> 128 (Daha az veri işleme, yeterli hassasiyet)
        analyser.fftSize = 128;

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
        // 🚀 OPTIMIZED: 75ms -> 150ms (Her participant için ayrı çalıştığından toplam CPU etkisi yüksek)
        raf = setInterval(checkActivity, 150);
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
