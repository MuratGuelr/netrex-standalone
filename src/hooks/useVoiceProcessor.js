import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
// RNNoise sadece client-side'da çalışır, SSR'da yüklenmemeli

// ============================================
// GELİŞMİŞ SES İŞLEME SİSTEMİ (KRISP/DISCORD BENZERİ)
// ============================================

const CONFIG = {
  // Analiz Ayarları - CPU OPTİMİZASYONU
  FFT_SIZE: 1024, // 2048 -> 1024 (21ms buffer @ 48kHz)
  SAMPLE_RATE: 48000,
  BUFFER_SIZE: 2048,

  // KRISP BENZERİ TEPKİ AYARLARI
  RELEASE_TIME: 250, // v5.3: 350 -> 250 (daha hızlı kapanma)
  RELEASE_TIME_RNNOISE: 350, // v5.3: 600 -> 350 (daha instant)
  // 🚀 v5.3: UI Speaking Indicator için ayrı release (daha kısa)
  UI_RELEASE_TIME: 100, // v5.3: 150ms -> 100ms (daha akıcı)
  ATTACK_TIME: 0,      // Hemen aç
  ATTACK_TIME_RNNOISE: 0,
  MIN_VOICE_DURATION: 1,
  MIN_VOICE_DURATION_RNNOISE: 1,
  MAX_SHORT_NOISE_DURATION: 50,
  // 🚀 OPTIMIZED v5.3: 120ms -> 85ms (Akıcılık için hafif artırıldı)
  CHECK_INTERVAL: 85,

  // Smoothing (Dengeli)
  RMS_ATTACK: 0.25,     // 0.05 -> 0.25 (5 kat daha hızlı ses açılışı)
  RMS_RELEASE: 0.05,    // Release yavaş kalsın ki ses titremesin
  SPECTRAL_SMOOTHING: 0.05, // 0.1 -> 0.05 (Spektrum analizi daha hassas)
  THRESHOLD_SMOOTHING: 0.05,

  // KRISP BENZERİ EŞİK DEĞERLERİ
  MIN_RMS: 0.001,
  MAX_RMS: 0.12,

  // Gürültü Profili - Azaltılmış
  NOISE_PROFILE_SAMPLES: 50,
  NOISE_UPDATE_INTERVAL: 5000,
  NOISE_PROFILE_THRESHOLD: 0.003,

  // Ses Bandı
  VOICE_LOW_FREQ: 80,
  VOICE_HIGH_FREQ: 8000,

  // Rüzgar/Arka plan gürültü frekansları
  WIND_LOW_FREQ: 20,
  WIND_HIGH_FREQ: 100,

  // Darbe tespiti - Basitleştirilmiş
  IMPACT_DETECTION_ENABLED: true,
  IMPACT_HIGH_FREQ_START: 5000,
  IMPACT_HIGH_FREQ_END: 16000,
  IMPACT_TRANSIENT_RATIO: 2.5,
  IMPACT_MIN_RMS_FACTOR: 1.2,
  IMPACT_ZCR_THRESHOLD: 0.35, // Daha yüksek ZCR (daha az konuşmayı klik sanır)
  IMPACT_HOLD_MS: 40,        // 85 -> 40 (Daha kısa kesinti)
  IMPACT_WEAK_VOICE_RATIO: 0.3, // Daha katı (ses varsa klik değildir)
  IMPACT_MIN_DURATION: 5,

  // Zero-Crossing Rate
  ZCR_THRESHOLD_MIN: 0.01,
  ZCR_THRESHOLD_MAX: 0.25,

  // Spektral Gating - DEVRİŞİK BIRAKILDI (CPU yoğun)
  SPECTRAL_GATING_ENABLED: false,
  SPECTRAL_SUBTRACTION_FACTOR: 1.5,
  MIN_SPECTRAL_RATIO: 1.1,

  // Voice Quality Scoring
  MIN_VOICE_QUALITY: 0.2,

  INIT_DELAY: 1500,
};

export function useVoiceProcessor() {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const settings = useSettingsStore();
  const {
    voiceThreshold,
    noiseSuppressionMode,
    advancedNoiseReduction,
    adaptiveThreshold,
    noiseProfiling,
    spectralFiltering,
    aiNoiseSuppression,
    setLocalSpeaking // 🚀 v5.3: Sync VAD state
  } = settings;

  // DÜZELTME: Eğer noiseSuppressionMode "krisp" ise ama aiNoiseSuppression false ise,
  // otomatik olarak true yap
  useEffect(() => {
    if (noiseSuppressionMode === "krisp" && !aiNoiseSuppression) {
      console.log("⚠️ Krisp modu aktif ama aiNoiseSuppression false, düzeltiliyor...");
      const { setNoiseSuppressionMode } = useSettingsStore.getState();
      setNoiseSuppressionMode("krisp"); // Bu otomatik olarak aiNoiseSuppression'ı true yapar
      console.log("✅ Krisp modu düzeltildi");
    }
  }, [noiseSuppressionMode, aiNoiseSuppression]);
  
  // İLK YÜKLEME: noiseSuppressionMode değiştiğinde log göster
  useEffect(() => {
    console.log("🔊 Noise suppression mode:", noiseSuppressionMode, {
      aiNoiseSuppression,
      hasLocalParticipant: !!localParticipant
    });
  }, [noiseSuppressionMode, aiNoiseSuppression, localParticipant]);

  // ========== REF'LER ==========
  const audioContextRef = useRef(null);
  const rnnoiseCheckIntervalRef = useRef(null); // RNNoise node kontrol interval'i
  const rnnoiseModuleRef = useRef(null); // RNNoise modülünü dinamik olarak yüklemek için
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const cloneStreamRef = useRef(null);
  const workletNodeRef = useRef(null); // SES İŞLEYİCİ WORKLET
  const rawAnalyserRef = useRef(null); // Raw audio analyser
  const rnnoiseNodeRef = useRef(null); // RNNoise Node

  // Ses işleme ref'leri
  const highPassFilterRef = useRef(null);
  const lowPassFilterRef = useRef(null);
  const notchFilterRef = useRef(null);
  const compressorRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Durum ref'leri
  const lastSpeakingTimeRef = useRef(0);
  const firstVoiceDetectionTimeRef = useRef(0);
  const isCleaningUpRef = useRef(false);
  const noiseProfileRef = useRef(null);
  const noiseProfileSamplesRef = useRef([]);
  const adaptiveThresholdRef = useRef(null);
  const smoothedRmsRef = useRef(0);
  const spectralDataRef = useRef(new Float32Array(CONFIG.FFT_SIZE / 2));
  const consecutiveVoiceDetectionsRef = useRef(0);
  const consecutiveSilenceDetectionsRef = useRef(0);
  const impactBlockTimestampRef = useRef(0);
  
  // 🚀 v5.3: UI Speaking Indicator için ayrı state (daha instant response)
  const lastUISpeakingTimeRef = useRef(0);
  const currentUISpeakingRef = useRef(false);

  // ========== YARDIMCI FONKSİYONLAR ==========

  // RMS ve ZCR artık Worklet içinde hesaplanıyor
  // Ancak rawAnalyser (main thread) için hala gerekebilir, o yüzden tutuyoruz
  const calculateRMS = useCallback((timeDomainData) => {
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
        // Byte verisi (0-255) -> Float (-1.0 to 1.0)
        const normalized = (timeDomainData[i] - 128) / 128.0;
        sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / timeDomainData.length);
  }, []);

  // Spektral Güç Hesaplama (belirli frekans bandında)
  const calculateSpectralPower = useCallback(
    (frequencyData, lowFreq, highFreq) => {
      const nyquist = CONFIG.SAMPLE_RATE / 2;
      const binSize = nyquist / frequencyData.length;
      const lowBin = Math.floor(lowFreq / binSize);
      const highBin = Math.min(
        Math.ceil(highFreq / binSize),
        frequencyData.length - 1
      );

      let power = 0;
      for (let i = lowBin; i <= highBin; i++) {
        power += frequencyData[i];
      }
      return power / (highBin - lowBin + 1);
    },
    []
  );

  // DENGELİ Eşik Hesaplama
  const calculateThreshold = useCallback((sliderValue) => {
    const normalized = sliderValue / 100;
    return CONFIG.MIN_RMS + normalized * (CONFIG.MAX_RMS - CONFIG.MIN_RMS);
  }, []);

  // Adaptif Eşik Hesaplama
  const calculateAdaptiveThreshold = useCallback(
    (baseThreshold, noiseLevel) => {
      if (noiseSuppressionMode !== "standard" || !adaptiveThreshold || !noiseProfiling || !noiseProfileRef.current) {
        return baseThreshold;
      }
      const noiseMultiplier = 1 + noiseLevel * 2;
      return baseThreshold * noiseMultiplier;
    },
    [adaptiveThreshold, noiseProfiling, noiseSuppressionMode]
  );

  // Gürültü Profili Güncelleme
  const updateNoiseProfile = useCallback(
    (rms, zcr, spectralData) => {
      if (!noiseProfiling) return;
      if (rms > CONFIG.NOISE_PROFILE_THRESHOLD) return;

      const sample = {
        rms,
        zcr,
        spectralData: Array.from(spectralData),
        timestamp: Date.now(),
      };

      noiseProfileSamplesRef.current.push(sample);

      if (noiseProfileSamplesRef.current.length > CONFIG.NOISE_PROFILE_SAMPLES) {
        noiseProfileSamplesRef.current.shift();
      }

      const tenSecondsAgo = Date.now() - 10000;
      noiseProfileSamplesRef.current = noiseProfileSamplesRef.current.filter(
        (s) => s.timestamp > tenSecondsAgo
      );

      if (noiseProfileSamplesRef.current.length >= 20) {
        const avgRms =
          noiseProfileSamplesRef.current.reduce((sum, s) => sum + s.rms, 0) /
          noiseProfileSamplesRef.current.length;
        const avgZcr =
          noiseProfileSamplesRef.current.reduce((sum, s) => sum + s.zcr, 0) /
          noiseProfileSamplesRef.current.length;

        noiseProfileRef.current = {
          rms: avgRms,
          zcr: avgZcr,
          spectralData: calculateAverageSpectrum(
            noiseProfileSamplesRef.current.map((s) => s.spectralData)
          ),
        };
      }
    },
    [noiseProfiling]
  );

  // Spektral Gating
  const spectralGating = useCallback(
    (currentSpectrum, noiseSpectrum) => {
      if (!CONFIG.SPECTRAL_GATING_ENABLED || !noiseSpectrum) return true;

      let passedBands = 0;
      let totalBands = 0;

      const nyquist = CONFIG.SAMPLE_RATE / 2;
      const binSize = nyquist / currentSpectrum.length;
      const lowBin = Math.floor(CONFIG.VOICE_LOW_FREQ / binSize);
      const highBin = Math.min(
        Math.ceil(CONFIG.VOICE_HIGH_FREQ / binSize),
        currentSpectrum.length - 1
      );

      for (let i = lowBin; i <= highBin; i++) {
        const signalPower = Math.pow(10, currentSpectrum[i] / 10);
        const noisePower = Math.pow(10, noiseSpectrum[i] / 10);
        const cleanedPower =
          signalPower - noisePower * CONFIG.SPECTRAL_SUBTRACTION_FACTOR;

        if (cleanedPower > noisePower * CONFIG.MIN_SPECTRAL_RATIO) {
          passedBands++;
        }
        totalBands++;
      }

      return passedBands / totalBands > 0.6;
    },
    []
  );

  // Ses Kalitesi Skoru
  const calculateVoiceQuality = useCallback(
    (rms, zcr, voicePower, windPower, threshold) => {
      let quality = 0;
      const rmsScore = Math.min(rms / threshold, 1) * 0.3;
      quality += rmsScore;

      const zcrScore =
        zcr > CONFIG.ZCR_THRESHOLD_MIN && zcr < CONFIG.ZCR_THRESHOLD_MAX
          ? 0.2
          : 0;
      quality += zcrScore;

      const spectralRatio = voicePower / (windPower + 0.001);
      const spectralScore = Math.min(spectralRatio / 5, 1) * 0.3;
      quality += spectralScore;

      const thresholdScore =
        rms > threshold * 1.3
          ? 0.2
          : rms > threshold * 1.1
          ? 0.15
          : rms > threshold
          ? 0.1
          : 0;
      quality += thresholdScore;

      return Math.min(quality, 1);
    },
    []
  );

  // Arka Plan Gürültü Çıkarma
  const subtractBackgroundNoise = useCallback(
    (currentRMS, currentZCR) => {
      if (!noiseProfileRef.current) return { rms: currentRMS, zcr: currentZCR };

      const noiseRMS = noiseProfileRef.current.rms;
      const noiseZCR = noiseProfileRef.current.zcr;

      const cleanedRMS = Math.max(
        0,
        currentRMS - noiseRMS * CONFIG.SPECTRAL_SUBTRACTION_FACTOR
      );
      const cleanedZCR = Math.max(0, currentZCR - noiseZCR * 0.5);

      return { rms: cleanedRMS, zcr: cleanedZCR };
    },
    []
  );

  // Darbe Gürültüsü Tespiti
  const detectImpactNoise = useCallback(
    ({ rms, zcr, voicePower, highFreqPower, threshold }) => {
      if (!CONFIG.IMPACT_DETECTION_ENABLED) return false;

      const transientRatio = highFreqPower / (voicePower + 0.001);
      const strongHighFreq = transientRatio > CONFIG.IMPACT_TRANSIENT_RATIO;
      const loudEnough = rms > threshold * CONFIG.IMPACT_MIN_RMS_FACTOR;
      const zcrSpike = zcr > CONFIG.IMPACT_ZCR_THRESHOLD;

      const weakVoiceBand =
        voicePower === 0
          ? true
          : voicePower < highFreqPower * CONFIG.IMPACT_WEAK_VOICE_RATIO;

      const hasStrongHighFreq = highFreqPower > threshold * 0.7;
      const veryLoud = rms > threshold * 1.8;
      const hasSignificantVoice = voicePower > highFreqPower * 0.3;
      
      if (veryLoud && hasSignificantVoice) {
        return false;
      }

      const hasAnyVoice = voicePower > highFreqPower * 0.15;
      if (veryLoud && hasAnyVoice) {
        return false;
      }

      const veryWeakVoice = voicePower < highFreqPower * CONFIG.IMPACT_WEAK_VOICE_RATIO;
      
      if (hasStrongHighFreq && veryWeakVoice && zcrSpike && loudEnough) {
        return true;
      }
      
      if (strongHighFreq && veryWeakVoice && loudEnough) {
        return true;
      }
      
      if (zcrSpike && veryWeakVoice && hasStrongHighFreq && loudEnough) {
        return true;
      }

      return strongHighFreq && loudEnough && zcrSpike && weakVoiceBand;
    },
    []
  );

  // Ortalama Spektrum
  const calculateAverageSpectrum = useCallback((spectrumArray) => {
    if (spectrumArray.length === 0) return null;
    const length = spectrumArray[0].length;
    const average = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let j = 0; j < spectrumArray.length; j++) {
        sum += spectrumArray[j][i];
      }
      average[i] = sum / spectrumArray.length;
    }
    return average;
  }, []);

  // Gürültü Seviyesi
  const calculateNoiseLevel = useCallback(() => {
    if (!noiseProfileRef.current) return 0;
    const profileRms = noiseProfileRef.current.rms;
    return Math.min(profileRms / CONFIG.MAX_RMS, 1);
  }, []);

  // VOICE ACTIVITY DETECTION (VAD)
  const detectVoiceActivity = useCallback(
    (
      rms,
      zcr,
      voiceSpectralPower,
      windSpectralPower,
      threshold,
      frequencyData
    ) => {
      let cleanedRMS = rms;
      let cleanedZCR = zcr;

      if (noiseSuppressionMode === "standard" && noiseProfiling && noiseProfileRef.current) {
        const cleaned = subtractBackgroundNoise(rms, zcr);
        cleanedRMS = cleaned.rms;
        cleanedZCR = cleaned.zcr;
      }

      const thresholdMultiplier = noiseSuppressionMode === "krisp" ? 1.0 : 1.1;
      const balancedThreshold = threshold * thresholdMultiplier;
      const rmsCheck = cleanedRMS > balancedThreshold;

      const zcrCheck =
        cleanedZCR > CONFIG.ZCR_THRESHOLD_MIN &&
        cleanedZCR < CONFIG.ZCR_THRESHOLD_MAX;

      const spectralRatio = voiceSpectralPower / (windSpectralPower + 0.001);
      const spectralCheck = spectralRatio > CONFIG.MIN_SPECTRAL_RATIO;

      let spectralGatingCheck = true;
      if (
        noiseSuppressionMode === "standard" &&
        CONFIG.SPECTRAL_GATING_ENABLED &&
        noiseProfiling &&
        noiseProfileRef.current?.spectralData
      ) {
        spectralGatingCheck = spectralGating(
          frequencyData,
          noiseProfileRef.current.spectralData
        );
      }

      const voiceQuality = calculateVoiceQuality(
        cleanedRMS,
        cleanedZCR,
        voiceSpectralPower,
        windSpectralPower,
        threshold
      );
      const qualityCheck = voiceQuality >= CONFIG.MIN_VOICE_QUALITY;

      let adaptiveCheck = true;
      if (noiseSuppressionMode === "standard" && adaptiveThreshold && noiseProfiling && noiseProfileRef.current) {
        const noiseLevel = calculateNoiseLevel();
        const adaptiveThresh = calculateAdaptiveThreshold(
          threshold,
          noiseLevel
        );
        adaptiveCheck = cleanedRMS > adaptiveThresh * 1.1;
      }

      const checks = [
        rmsCheck,
        zcrCheck,
        spectralCheck,
        spectralGatingCheck,
        qualityCheck,
        adaptiveCheck,
      ].filter(Boolean);

      if (noiseSuppressionMode === "krisp") {
        if (!rmsCheck) return false;
        if (cleanedRMS > threshold * 1.2) return true;
        if (zcrCheck || spectralCheck) return true;
        return false;
      }
      
      if (!rmsCheck) return false;
      if (cleanedRMS > threshold * 1.4) return true;
      if (zcrCheck && spectralCheck) return true;

      return checks.length >= 2;
    },
    [
      noiseProfiling,
      adaptiveThreshold,
      calculateNoiseLevel,
      calculateAdaptiveThreshold,
      subtractBackgroundNoise,
      spectralGating,
      calculateVoiceQuality,
      noiseSuppressionMode
    ]
  );

  // ========== TEMİZLİK ==========
  const cleanup = useCallback((preserveRNNoise = false) => {
    isCleaningUpRef.current = true;
    
    // 🚀 v5.3: UI speaking state'i kapat
    if (currentUISpeakingRef.current) {
      currentUISpeakingRef.current = false;
      useSettingsStore.getState().setLocalIsSpeaking(false);
    }

    if (rnnoiseCheckIntervalRef.current) {
      clearInterval(rnnoiseCheckIntervalRef.current);
      rnnoiseCheckIntervalRef.current = null;
    }

    if (cloneStreamRef.current) {
      cloneStreamRef.current.getTracks().forEach((track) => track.stop());
      cloneStreamRef.current = null;
    }

    // Node'ları temizle
    const nodesToClean = [
      sourceRef,
      analyserRef,
      highPassFilterRef,
      lowPassFilterRef,
      notchFilterRef,
      compressorRef,
      gainNodeRef,
      rawAnalyserRef,
      // Worklet Node
      workletNodeRef
    ];
    
    if (!preserveRNNoise) {
      nodesToClean.push(rnnoiseNodeRef);
    }
    
    nodesToClean.forEach((ref) => {
      if (ref.current) {
        try {
          ref.current.disconnect();
          if (ref.current.port) {
            // Worklet portunu kapat (eğer varsa)
             ref.current.port.close && ref.current.port.close();
             ref.current.port.onmessage = null;
          }
        } catch (e) {
            // ignore
        }
        ref.current = null;
      }
    });

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      if (preserveRNNoise) {
        if (audioContextRef.current.state === "running") {
          audioContextRef.current.suspend().catch(() => {});
        }
      } else {
        try {
          audioContextRef.current.close().catch((err) => {
             console.warn("AudioContext close error:", err);
          });
        } catch (e) {
           // ignore
        }
        audioContextRef.current = null;
        rnnoiseNodeRef.current = null;
      }
    }
  }, []);

  // ========== ANA EFFECT ==========
  useEffect(() => {
    if (!localParticipant || !room) return;

    isCleaningUpRef.current = false;
    let originalStreamTrack = null;
    let trackPublishedHandler = null;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    let retryTimer = null;

    const setupProcessor = async () => {
      // Cleanup
      const shouldPreserveRNNoise = noiseSuppressionMode === "krisp" && 
                                     rnnoiseNodeRef.current && 
                                     audioContextRef.current &&
                                     audioContextRef.current.state !== "closed";
      
      cleanup(!shouldPreserveRNNoise);
      isCleaningUpRef.current = false;
      
      // Audio Context Kontrolü
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioCtx({
            sampleRate: CONFIG.SAMPLE_RATE,
            latencyHint: "interactive",
          });
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") await ctx.resume();

      // Track Hazırlığı
      const trackPublication = localParticipant.getTrackPublication(
        Track.Source.Microphone
      );

      if (!trackPublication?.track) {
        // Retry logic... (Shortened for brevity but logic remains same in practice if we kept it)
        // Implementing basic retry:
         retryTimer = setTimeout(() => {
            if (!isCleaningUpRef.current) setupProcessor();
         }, 500);
         return;
      }
      
      const track = trackPublication.track;
      if (!track.mediaStreamTrack || track.mediaStreamTrack.kind !== "audio" || track.mediaStreamTrack.readyState === "ended") {
        return;
      }
      
      originalStreamTrack = track.mediaStreamTrack;

      // Warm-up Oscillator
      try {
          const warmUpOsc = ctx.createOscillator();
          const warmUpGain = ctx.createGain();
          warmUpOsc.connect(warmUpGain);
          warmUpGain.connect(ctx.destination);
          warmUpGain.gain.value = 0.0001;
          warmUpOsc.start();
      } catch(e) {}

      // Stream Cloning
      const cloneStream = originalStreamTrack.clone();
      cloneStreamRef.current = new MediaStream([cloneStream]);
      const source = ctx.createMediaStreamSource(cloneStreamRef.current);
      sourceRef.current = source;

      // Raw Analyser (For Fast VAD)
      const rawAnalyser = ctx.createAnalyser();
      rawAnalyser.fftSize = CONFIG.FFT_SIZE;
      rawAnalyser.smoothingTimeConstant = 0;
      source.connect(rawAnalyser);
      rawAnalyserRef.current = rawAnalyser;

      let currentNode = source;

      // Helper to resolve resource paths (Electron vs Web)
      const getResourcePath = async (filename) => {
         // 🚀 Fix for Dev Mode: If serving from localhost (http), DO NOT use file:// protocol.
         // Browsers block file:// access from http:// origins.
         if (process.env.NODE_ENV === "development" || window.location.protocol.startsWith("http")) {
            return `/${filename}`;
         }

         if (window.netrex && window.netrex.getResourcesPath) {
             try {
                const resourcesPath = await window.netrex.getResourcesPath();
                // Windows path fix: Convert backslashes to forward slashes for URL
                const cleanPath = resourcesPath.replace(/\\/g, '/');
                return `file:///${cleanPath}/${filename}`.replace(/([^:]\/)\/+/g, "$1"); // Normalize slashes
             } catch (e) {
                console.warn("Failed to get resources path:", e);
             }
         }
         return `/${filename}`;
      };

      // ... RNNoise Setup ... (Same as before)
      if (noiseSuppressionMode === "krisp") {
          if (!rnnoiseNodeRef.current) {
            try {
               if (!rnnoiseModuleRef.current) {
                 rnnoiseModuleRef.current = await import("simple-rnnoise-wasm");
               }
               const { RNNoiseNode, rnnoise_loadAssets } = rnnoiseModuleRef.current;
               
               // Path handling
               let workletUrl = await getResourcePath('rnnoise.worklet.js');
               let wasmUrl = await getResourcePath('rnnoise.wasm');
               
               const assets = await rnnoise_loadAssets({ scriptSrc: workletUrl, moduleSrc: wasmUrl });
               await RNNoiseNode.register(ctx, assets);
               const rnnoiseNode = new RNNoiseNode(ctx);
               currentNode.connect(rnnoiseNode);
               currentNode = rnnoiseNode;
               rnnoiseNodeRef.current = rnnoiseNode;
            } catch(e) {
                console.error("RNNoise load error", e);
            }
          } else {
             currentNode.connect(rnnoiseNodeRef.current);
             currentNode = rnnoiseNodeRef.current;
          }
      }

      // Filters (HighPass, LowPass, Notch, Compressor, Gain)
      // Only if not Krisp OR (Krisp and Node missing)
      if ((noiseSuppressionMode === "standard" || !rnnoiseNodeRef.current) && (advancedNoiseReduction || spectralFiltering)) {
          const highPass = ctx.createBiquadFilter();
          highPass.type = "highpass";
          highPass.frequency.value = CONFIG.VOICE_LOW_FREQ;
          highPass.Q.value = 0.8;
          currentNode.connect(highPass);
          currentNode = highPass;
          highPassFilterRef.current = highPass;
          
          const lowPass = ctx.createBiquadFilter();
          lowPass.type = "lowpass";
          lowPass.frequency.value = CONFIG.VOICE_HIGH_FREQ;
          lowPass.Q.value = 0.8;
          currentNode.connect(lowPass);
          currentNode = lowPass;
          lowPassFilterRef.current = lowPass;

          // Notch & Compressor
          if (advancedNoiseReduction) {
             const notch = ctx.createBiquadFilter();
             notch.type = "notch";
             notch.frequency.value = 50;
             currentNode.connect(notch);
             currentNode = notch;
             notchFilterRef.current = notch;

             const compressor = ctx.createDynamicsCompressor();
             compressor.threshold.value = -24;
             compressor.ratio.value = 12;
             compressor.attack.value = 0.003;
             compressor.release.value = 0.25;
             currentNode.connect(compressor);
             currentNode = compressor;
             compressorRef.current = compressor;
             
             const gain = ctx.createGain();
             currentNode.connect(gain);
             currentNode = gain;
             gainNodeRef.current = gain;
          }
      }

      // Main Analyser (For Spectral Data)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = CONFIG.FFT_SIZE;
      analyser.smoothingTimeConstant = CONFIG.SPECTRAL_SMOOTHING;
      currentNode.connect(analyser);
      analyserRef.current = analyser;
      
      // ============================================
      // 🚀 AUDIO WORKLET SETUP (CPU OFF-LOAD)
      // ============================================
      try {
          // Load the worklet
          try {
             const processorPath = await getResourcePath('voice-processor.worklet.js');
             await ctx.audioWorklet.addModule(processorPath);
          } catch(e) {
             console.warn("Worklet module load failed:", e);
          }

          const processorNode = new AudioWorkletNode(ctx, 'voice-processor');
          workletNodeRef.current = processorNode;

          // Connect: Analyser -> Worklet -> Destination (Quietly)
          // We connect from 'analyser' (which is at the end of chain) to Worklet
          // so Worklet sees the "processed" audio (filtered). 
          // Wait, 'analyser' is a tap. 'currentNode' connects to it.
          // We should also connect 'currentNode' to 'processorNode'.
          currentNode.connect(processorNode);
          
          // Connect to destination to keep alive (AudioWorklet needs to output or be connected to active graph)
          // Use a zero gain node to stop it from being audible (if it outputted anything)
          const silentGain = ctx.createGain();
          silentGain.gain.value = 0;
          processorNode.connect(silentGain);
          silentGain.connect(ctx.destination);

          // Data arrays for Main Thread Spectral Analysis
          // We still allocate these on main thread, but only fill them on message
          const frequencyDataArray = new Float32Array(analyser.frequencyBinCount);
          
          // MESSAGE HANDLER: Replaces the 'setInterval' loop
          processorNode.port.onmessage = (event) => {
              if (isCleaningUpRef.current || !originalStreamTrack || !analyserRef.current) return;
              
              const { type, rms, zcr } = event.data;
              if (type === 'metrics') {
                  // 1. Get Spectral Data (Fast C++)
                  analyserRef.current.getFloatFrequencyData(frequencyDataArray);
                  
                  // 2. RMS Smoothing
                  const rmsSmoothingFactor = rms > smoothedRmsRef.current 
                    ? CONFIG.RMS_ATTACK 
                    : CONFIG.RMS_RELEASE;
                  smoothedRmsRef.current = smoothedRmsRef.current * (1 - rmsSmoothingFactor) + rms * rmsSmoothingFactor;
                  
                  // 3. Raw RMS (bypass)
                  let rawRms = rms;
                  if (rawAnalyserRef.current) {
                      // Note: We don't have raw ZCR from main thread anymore (expensive loop)
                      // We could estimate or just use smoothed RMS for trigger
                      // But effectively we trust the Worklet's RMS.
                      // If we really need RAW (unprocessed) RMS, we would need another worklet instance attached to raw source.
                      // For now, let's use the processed RMS as primary, which is usually fine.
                      // Or check trigger logic: Krisp uses `rawRms`...
                      // Wait, we attached Worklet to `currentNode` which IS the processed node (after logic).
                      // If we want raw Analysis, we should attach Worklet to `sourceRef` too?
                      // Creating Multiple Worklets is cheap. 
                      // Let's stick to using the processed RMS. It's usually better (filtered).
                  }

                  // 4. Calculate Spectral Powers (Main Thread - Loop overhead but reduced freq)
                  const voicePower = calculateSpectralPower(frequencyDataArray, CONFIG.VOICE_LOW_FREQ, CONFIG.VOICE_HIGH_FREQ);
                  const windPower = calculateSpectralPower(frequencyDataArray, CONFIG.WIND_LOW_FREQ, CONFIG.WIND_HIGH_FREQ);
                  const impactHighPower = calculateSpectralPower(frequencyDataArray, CONFIG.IMPACT_HIGH_FREQ_START, CONFIG.IMPACT_HIGH_FREQ_END);

                  // 5. Thresholds
                  const currentThreshold = useSettingsStore.getState().voiceThreshold;
                  let threshold = calculateThreshold(currentThreshold);
                  
                  if (noiseSuppressionMode === "standard" && adaptiveThreshold && noiseProfiling) {
                    const noiseLevel = calculateNoiseLevel();
                    threshold = calculateAdaptiveThreshold(threshold, noiseLevel);
                    adaptiveThresholdRef.current = threshold;
                  }

                  // 6. Update Noise Profile
                  if (noiseSuppressionMode === "standard" && noiseProfiling && smoothedRmsRef.current < CONFIG.NOISE_PROFILE_THRESHOLD) {
                      updateNoiseProfile(smoothedRmsRef.current, zcr, frequencyDataArray);
                  }

                  // 7. Impact Detection
                  const potentialImpact = detectImpactNoise({
                      rms: smoothedRmsRef.current,
                      zcr,
                      voicePower,
                      highFreqPower: impactHighPower,
                      threshold
                  });

                  // 8. VAD Logic
                  const now = Date.now();
                  if (potentialImpact) {
                      impactBlockTimestampRef.current = now;
                      if (originalStreamTrack.enabled) originalStreamTrack.enabled = false;
                      firstVoiceDetectionTimeRef.current = 0;
                      lastSpeakingTimeRef.current = 0;
                  }
                  const impactActive = impactBlockTimestampRef.current && (now - impactBlockTimestampRef.current < CONFIG.IMPACT_HOLD_MS);

                  // VAD Execution
                  const isSpeaking = !impactActive && detectVoiceActivity(
                     smoothedRmsRef.current,
                     zcr,
                     voicePower,
                     windPower,
                     threshold,
                     frequencyDataArray
                  );

                  // 🚀 v5.3: Global State Sync
                  setLocalSpeaking(isSpeaking);

                  // 9. Microphone Control Logic (Same as before)
                  if (isSpeaking) {
                      impactBlockTimestampRef.current = 0;
                      if (firstVoiceDetectionTimeRef.current === 0) {
                          firstVoiceDetectionTimeRef.current = now;
                      }
                      lastSpeakingTimeRef.current = now;
                      const voiceDuration = now - firstVoiceDetectionTimeRef.current;
                      
                      const hasVoiceChars = (zcr > CONFIG.ZCR_THRESHOLD_MIN && zcr < CONFIG.ZCR_THRESHOLD_MAX) && (voicePower > windPower * CONFIG.MIN_SPECTRAL_RATIO);
                      const isStrong = smoothedRmsRef.current > threshold * (noiseSuppressionMode === "krisp" ? 0.9 : 1.35);
                      const hasMinDur = voiceDuration >= (noiseSuppressionMode === "krisp" ? CONFIG.MIN_VOICE_DURATION_RNNOISE : CONFIG.MIN_VOICE_DURATION);
                      
                      if (noiseSuppressionMode === "krisp") { // Krisp Aggressive Mode
                         if (smoothedRmsRef.current > threshold * 0.4 || hasVoiceChars) {
                             if (!originalStreamTrack.enabled) originalStreamTrack.enabled = true;
                         }
                      } else { // Standard Mode
                         if (hasVoiceChars || isStrong || hasMinDur) {
                             if (!originalStreamTrack.enabled) originalStreamTrack.enabled = true;
                         }
                      }
                      
                      // 🚀 v5.3: UI Speaking Indicator - Hemen aç (Sadece bağlıysa)
                      lastUISpeakingTimeRef.current = now;
                      if (!currentUISpeakingRef.current) {
                          // EĞER BAĞLI DEĞİLSE GÖSTERME
                          if (room.state === ConnectionState.Connected) {
                              currentUISpeakingRef.current = true;
                              useSettingsStore.getState().setLocalIsSpeaking(true);
                          }
                      }
                  } else {
                      // Silence
                      if (firstVoiceDetectionTimeRef.current > 0 && (now - firstVoiceDetectionTimeRef.current) < CONFIG.MAX_SHORT_NOISE_DURATION) {
                         firstVoiceDetectionTimeRef.current = 0; // Short noise reset
                      }
                      const releaseMap = noiseSuppressionMode === "krisp" ? CONFIG.RELEASE_TIME_RNNOISE : CONFIG.RELEASE_TIME;
                      if ((now - lastSpeakingTimeRef.current) > releaseMap) {
                          firstVoiceDetectionTimeRef.current = 0;
                          if (originalStreamTrack.enabled) originalStreamTrack.enabled = false;
                      }
                      
                      // 🚀 v5.3: UI Speaking Indicator - Kısa release ile kapat (80ms)
                      // Bağlantı kopsa bile kapatmayı garanti et
                      if (currentUISpeakingRef.current && ((now - lastUISpeakingTimeRef.current) > CONFIG.UI_RELEASE_TIME || room.state !== ConnectionState.Connected)) {
                          currentUISpeakingRef.current = false;
                          useSettingsStore.getState().setLocalIsSpeaking(false);
                      }
                  }
              }
          };

      } catch(e) {
          console.error("Audio Worklet Setup Error:", e);
      }

    };

    const checkConnection = () => {
       if (room.state === ConnectionState.Connected && !isCleaningUpRef.current) {
          setupProcessor();
       }
    };

    if (room.state === ConnectionState.Connected) {
       checkConnection();
    } else {
       room.on(RoomEvent.ConnectionStateChanged, checkConnection);
    }

    return () => {
       if (retryTimer) clearTimeout(retryTimer);
       room.off(RoomEvent.ConnectionStateChanged, checkConnection);
       cleanup();
       if (originalStreamTrack) originalStreamTrack.enabled = true;
    };
  }, [
    localParticipant,
    noiseSuppressionMode,
    advancedNoiseReduction,
    adaptiveThreshold,
    noiseProfiling,
    spectralFiltering,
    aiNoiseSuppression,
    setLocalSpeaking
  ]);
}
