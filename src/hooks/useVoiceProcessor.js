import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";

// --- AYARLAR ---
const CONFIG = {
  // Gürültü Engelleme Ayarı (Bandpass)
  // 1000Hz yerine 800Hz yaptık. Bu, "D/B/P" gibi harfleri daha iyi yakalar
  // ama klavye sesi (tiz olduğu için) hala filtrelenir.
  FILTER_FREQ: 800,
  FILTER_Q: 0.6, // Filtre genişliği (Değişmedi, ideal)

  // Tepki Ayarları
  RELEASE_TIME: 600, // Konuşma bitince bekleme süresi
  CHECK_INTERVAL: 20, // Kontrol hızı (ms)

  // Analiz Ayarları
  FFT_SIZE: 512,

  // 🔥 KRİTİK DÜZELTME: Smoothing
  // 0.4 çok yavaştı (kelime başı gidiyordu).
  // 0.1 çok hızlıydı (gürültü giriyordu).
  // 0.2 tam kararında. Ani sesleri yakalar ama gürültüyü eler.
  SMOOTHING: 0.2,

  // Eşik Değerleri
  // Başlangıç hassasiyetini milim aşağı çektik
  MIN_RMS: 0.0015,
  MAX_RMS: 0.08,

  INIT_DELAY: 800,
};

export function useVoiceProcessor() {
  const { localParticipant } = useLocalParticipant();
  const { voiceThreshold } = useSettingsStore();

  // Referanslar
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const sourceRef = useRef(null);
  const filterRef = useRef(null);
  const analyserRef = useRef(null);
  const cloneStreamRef = useRef(null);

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

    [sourceRef, filterRef, analyserRef].forEach((ref) => {
      if (ref.current) {
        try {
          ref.current.disconnect();
        } catch (e) {}
        ref.current = null;
      }
    });
  }, []);

  // --- EŞİK HESAPLAMA ---
  const calculateThreshold = useCallback((sliderValue) => {
    const normalized = sliderValue / 100;
    return CONFIG.MIN_RMS + normalized * (CONFIG.MAX_RMS - CONFIG.MIN_RMS);
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
        // 1. AudioContext
        if (!audioContextRef.current) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;

        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        // 2. Stream Klonlama
        const cloneStream = originalStreamTrack.clone();
        cloneStreamRef.current = new MediaStream([cloneStream]);

        // 3. Audio Zinciri
        const source = ctx.createMediaStreamSource(cloneStreamRef.current);

        // BANDPASS FILTER
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = CONFIG.FILTER_FREQ;
        filter.Q.value = CONFIG.FILTER_Q;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = CONFIG.FFT_SIZE;
        analyser.smoothingTimeConstant = CONFIG.SMOOTHING;

        // Bağlantı: Kaynak -> Bandpass -> Analizci
        source.connect(filter);
        filter.connect(analyser);

        sourceRef.current = source;
        filterRef.current = filter;
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

          const threshold = calculateThreshold(voiceThreshold);
          const isSpeaking = rms > threshold;

          if (isSpeaking) {
            lastSpeakingTimeRef.current = Date.now();
            // Ses algılandığı AN aç
            if (!originalStreamTrack.enabled) {
              originalStreamTrack.enabled = true;
            }
          } else {
            // Ses kesildiğinde bekle (Release Time)
            const timeSinceLastSpeak = Date.now() - lastSpeakingTimeRef.current;

            if (timeSinceLastSpeak > CONFIG.RELEASE_TIME) {
              if (originalStreamTrack.enabled) {
                originalStreamTrack.enabled = false;
              }
            } else {
              if (!originalStreamTrack.enabled) {
                originalStreamTrack.enabled = true;
              }
            }
          }
        };

        // Döngüyü başlat
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(checkVolume, CONFIG.CHECK_INTERVAL);
      } catch (err) {
        console.error("Voice Processor Hatası:", err);
        if (originalStreamTrack) {
          originalStreamTrack.enabled = true;
        }
      }
    };

    const initTimer = setTimeout(setupProcessor, CONFIG.INIT_DELAY);

    return () => {
      clearTimeout(initTimer);
      cleanup();
      if (originalStreamTrack) {
        originalStreamTrack.enabled = true;
      }
    };
  }, [localParticipant, voiceThreshold, cleanup, calculateThreshold]);
}
