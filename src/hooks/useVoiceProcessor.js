import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";

// --- GELİŞMİŞ AYARLAR ---
const CONFIG = {
  // İnsan sesine odaklan (Bandpass Filter)
  // İnsan sesi genelde 85Hz - 255Hz (temel) ve 4000Hz'e kadar harmoniklerdir.
  // Alt frekansları (masa titremesi) ve çok üst frekansları (klavye tıkırtısı) filtreliyoruz.
  FILTER_LOW: 100,
  FILTER_HIGH: 8000, // Daha doğal ses için aralığı genişlettik

  // Analiz Ayarları
  FFT_SIZE: 512,
  SMOOTHING: 0.4, // 0.2'den 0.4'e çıkardık (Sesin titremesini engeller)

  // Tepki Süreleri (Discord Tarzı)
  ATTACK_TIME: 0, // Ses algılandığı AN aç (Gecikme yok)
  RELEASE_TIME: 800, // Konuşma bittikten sonra 0.8 saniye bekle (Kelime sonlarını yutmaması için artırdık)

  // Kontrol Sıklığı
  CHECK_INTERVAL: 50, // 20ms çok agresifti, 50ms daha stabil
};

export function useVoiceProcessor() {
  const { localParticipant } = useLocalParticipant();
  const { voiceThreshold } = useSettingsStore();

  // Referanslar
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const cloneStreamRef = useRef(null);

  // State Referansları
  const isSpeakingRef = useRef(false);
  const lastSpeakingTimeRef = useRef(0);
  const isCleaningUpRef = useRef(false);

  // --- TEMİZLİK ---
  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (cloneStreamRef.current) {
      cloneStreamRef.current.getTracks().forEach((track) => track.stop());
      cloneStreamRef.current = null;
    }

    if (audioContextRef.current?.state !== "closed") {
      try {
        sourceRef.current?.disconnect();
        audioContextRef.current?.close();
      } catch (e) {}
    }

    audioContextRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
  }, []);

  // --- EŞİK HESAPLAMA (LOGARİTMİK) ---
  // Slider'daki %15 ile %50 arasındaki farkı insan kulağına göre ayarlar
  const calculateThreshold = useCallback((sliderValue) => {
    // 0-100 arasını daha hassas bir RMS değerine dönüştür
    // Minimum gürültü (sessiz oda): 0.002
    // Maksimum gürültü (bağırma): 0.1
    const min = 0.002;
    const max = 0.1;
    const normalized = Math.pow(sliderValue / 100, 2); // Üstel artış (daha hassas ayar için)
    return min + normalized * (max - min);
  }, []);

  // --- ANA EFFECT ---
  useEffect(() => {
    if (!localParticipant) return;

    isCleaningUpRef.current = false;
    let originalStreamTrack = null;

    const setupProcessor = async () => {
      const trackPublication = localParticipant.getTrackPublication(
        Track.Source.Microphone
      );

      if (!trackPublication?.track) return;

      const track = trackPublication.track;
      originalStreamTrack = track.mediaStreamTrack;

      try {
        // 1. AudioContext Başlat
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        // 2. Analiz için Stream Klonla (Orijinal sesi bozmamak için)
        const cloneStream = new MediaStream([originalStreamTrack.clone()]);
        cloneStreamRef.current = cloneStream;

        // 3. Audio Zinciri
        const source = ctx.createMediaStreamSource(cloneStream);
        const analyser = ctx.createAnalyser();

        analyser.fftSize = CONFIG.FFT_SIZE;
        analyser.smoothingTimeConstant = CONFIG.SMOOTHING; // Sesi yumuşat

        // Bağlantı: Source -> Analyser (Hoparlöre vermiyoruz, sadece analiz)
        source.connect(analyser);

        sourceRef.current = source;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.fftSize);

        // --- SES KONTROL DÖNGÜSÜ ---
        const checkVolume = () => {
          if (
            isCleaningUpRef.current ||
            !analyserRef.current ||
            !originalStreamTrack
          )
            return;

          analyserRef.current.getByteTimeDomainData(dataArray);

          // RMS (Root Mean Square) Hesaplama - Sesin gücü
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128.0;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);

          const threshold = calculateThreshold(voiceThreshold);
          const currentRms = rms;

          // Eşiği geçti mi?
          if (currentRms > threshold) {
            lastSpeakingTimeRef.current = Date.now();

            // Eğer kapalıysa hemen aç (ATTACK)
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              if (!originalStreamTrack.enabled) {
                originalStreamTrack.enabled = true;
              }
            }
          } else {
            // Ses eşiğin altında
            // Konuşma bitti mi kontrol et (RELEASE)
            const timeSinceLastSpeak = Date.now() - lastSpeakingTimeRef.current;

            if (
              isSpeakingRef.current &&
              timeSinceLastSpeak > CONFIG.RELEASE_TIME
            ) {
              isSpeakingRef.current = false;
              if (originalStreamTrack.enabled) {
                originalStreamTrack.enabled = false;
              }
            }
            // Eğer süre dolmadıysa açık kalmaya devam etsin (Nefes alma araları vb.)
          }
        };

        // Döngüyü başlat
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(checkVolume, CONFIG.CHECK_INTERVAL);
      } catch (err) {
        console.error("Voice Processor Error:", err);
        // Hata olursa mikrofonu açık bırak, kullanıcı mağdur olmasın
        if (originalStreamTrack) originalStreamTrack.enabled = true;
      }
    };

    // İlk açılışta mikrofonun "ısınması" için kısa bir gecikme
    const initTimer = setTimeout(setupProcessor, 1000);

    return () => {
      clearTimeout(initTimer);
      cleanup();
      // Component unmount olduğunda mikrofonu açık bırak ki diğer sayfalarda çalışsın
      if (originalStreamTrack) originalStreamTrack.enabled = true;
    };
  }, [localParticipant, voiceThreshold, cleanup, calculateThreshold]);
}
