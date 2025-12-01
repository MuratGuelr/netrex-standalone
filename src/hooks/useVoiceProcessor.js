import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";

// --- GELİŞMİŞ GÜRÜLTÜ ENGELLEME AYARLARI ---
const CONFIG = {
  // İnsan sesi frekans aralığı (Bandpass)
  // Alt frekansı 150Hz'e çektik (Masa titreşimi ve "thud" seslerini keser)
  // Üst frekansı 6500Hz'e çektik (Mekanik klavye "tık" seslerini yumuşatır)
  FILTER_LOW: 150,
  FILTER_HIGH: 6500,

  // Analiz Hassasiyeti
  FFT_SIZE: 512,
  // Sesi ne kadar hızlı takip etsin?
  // 0.1 çok hızlı (pırpır eder), 0.8 çok yavaş (gecikmeli). 0.2 ideal.
  SMOOTHING: 0.2,

  // Tepki Süreleri
  ATTACK_TIME: 0, // Anında aç
  RELEASE_TIME: 250, // 800ms'den 250ms'e düşürdük. (Tıkırtı sonrası hemen kapansın)

  CHECK_INTERVAL: 40, // 40ms'de bir kontrol et
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

  // Durum Referansları
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

  // --- AKILLI EŞİK HESAPLAMA (HYSTERESIS) ---
  const calculateThresholds = useCallback((sliderValue) => {
    // Slider 0-100 arasını logaritmik RMS değerine çevir
    // Min (Sessiz): 0.002, Max (Bağırma): 0.08
    const normalized = Math.pow(sliderValue / 100, 1.5); // Üstel eğri

    // 1. OPEN THRESHOLD (Tetikleme): Mikrofonu açmak için gereken ses
    // Slider değerine göre artar.
    const openThreshold = 0.004 + normalized * 0.08;

    // 2. CLOSE THRESHOLD (Sürdürme): Mikrofonu açık tutmak için gereken ses
    // Tetikleme eşiğinin %60'ı kadardır.
    // Yani konuşmaya başlamak için sesli konuşmalısın ama devam ederken fısıldayabilirsin.
    const closeThreshold = openThreshold * 0.6;

    return { openThreshold, closeThreshold };
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
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        if (ctx.state === "suspended") await ctx.resume();

        // Analiz için Stream Klonla
        const cloneStream = new MediaStream([originalStreamTrack.clone()]);
        cloneStreamRef.current = cloneStream;

        const source = ctx.createMediaStreamSource(cloneStream);

        // Highpass + Lowpass yerine Bandpass Filter
        // Bu filtre klavye seslerinin (tiz) ve masa darbelerinin (bas) gücünü kırar
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1000; // Merkez frekans (İnsan sesi ortalaması)
        filter.Q.value = 0.7; // Genişlik (Çok dar olmasın, robotlaşır)

        const analyser = ctx.createAnalyser();
        analyser.fftSize = CONFIG.FFT_SIZE;
        analyser.smoothingTimeConstant = CONFIG.SMOOTHING;

        // Bağlantı: Kaynak -> Filtre -> Analizci
        source.connect(filter);
        filter.connect(analyser);

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

          // RMS Hesaplama
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128.0;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);

          // Akıllı Eşikleri Al
          const { openThreshold, closeThreshold } =
            calculateThresholds(voiceThreshold);

          // HYSTERESIS MANTIĞI
          if (isSpeakingRef.current) {
            // Zaten konuşuyorsa: Kapanma eşiğini (daha düşük) kullan
            if (rms > closeThreshold) {
              lastSpeakingTimeRef.current = Date.now(); // Süreyi uzat
            }
          } else {
            // Konuşmuyorsa: Açılma eşiğini (daha yüksek) kullan
            // Bu sayede klavye "tık" sesi bu eşiği geçemez ama "Merhaba" sesi geçer.
            if (rms > openThreshold) {
              isSpeakingRef.current = true;
              lastSpeakingTimeRef.current = Date.now();
              if (!originalStreamTrack.enabled) {
                originalStreamTrack.enabled = true;
              }
            }
          }

          // Kapanma Kontrolü (Release Time)
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
        };

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(checkVolume, CONFIG.CHECK_INTERVAL);
      } catch (err) {
        console.error("Voice Processor Error:", err);
        if (originalStreamTrack) originalStreamTrack.enabled = true;
      }
    };

    const initTimer = setTimeout(setupProcessor, 1000);

    return () => {
      clearTimeout(initTimer);
      cleanup();
      if (originalStreamTrack) originalStreamTrack.enabled = true;
    };
  }, [localParticipant, voiceThreshold, cleanup, calculateThresholds]);
}
