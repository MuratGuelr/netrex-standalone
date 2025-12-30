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
  RELEASE_TIME: 350,
  RELEASE_TIME_RNNOISE: 600, // Biraz daha uzun release (yarım kelime arası kesilmesin)
  ATTACK_TIME: 0,      // Hemen aç
  ATTACK_TIME_RNNOISE: 0,
  MIN_VOICE_DURATION: 1,
  MIN_VOICE_DURATION_RNNOISE: 1,
  MAX_SHORT_NOISE_DURATION: 50,
  // ÖNEMLİ DÜZELTME: Interval buffer boyutundan (21ms) büyük olmamalı yoksa veri kaybı olur!
  CHECK_INTERVAL: 50,  // 20 -> 50 (CPU usage optimized)

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
  } = settings;

  // DÜZELTME: Eğer noiseSuppressionMode "krisp" ise ama aiNoiseSuppression false ise,
  // otomatik olarak true yap (eski ayarlardan kalan tutarsızlığı düzelt)
  useEffect(() => {
    if (noiseSuppressionMode === "krisp" && !aiNoiseSuppression) {
      console.log("⚠️ Krisp modu aktif ama aiNoiseSuppression false, düzeltiliyor...");
      const { setNoiseSuppressionMode } = useSettingsStore.getState();
      setNoiseSuppressionMode("krisp"); // Bu otomatik olarak aiNoiseSuppression'ı true yapar
      console.log("✅ Krisp modu düzeltildi");
    }
  }, [noiseSuppressionMode, aiNoiseSuppression]);
  
  // İLK YÜKLEME: noiseSuppressionMode değiştiğinde log göster (debug için)
  useEffect(() => {
    console.log("🔊 Noise suppression mode:", noiseSuppressionMode, {
      aiNoiseSuppression,
      hasLocalParticipant: !!localParticipant
    });
  }, [noiseSuppressionMode, aiNoiseSuppression, localParticipant]);

  // ========== REF'LER ==========
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const rnnoiseCheckIntervalRef = useRef(null); // RNNoise node kontrol interval'i
  const rnnoiseModuleRef = useRef(null); // RNNoise modülünü dinamik olarak yüklemek için
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const cloneStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const rawAnalyserRef = useRef(null); // Raw audio analyser (RNNoise gecikmesini bypass etmek için)

  // Ses işleme ref'leri
  const highPassFilterRef = useRef(null);
  const lowPassFilterRef = useRef(null);
  const notchFilterRef = useRef(null);
  const compressorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const rnnoiseNodeRef = useRef(null);

  // Durum ref'leri
  const lastSpeakingTimeRef = useRef(0);
  const firstVoiceDetectionTimeRef = useRef(0); // İlk ses algılanma zamanı
  const isCleaningUpRef = useRef(false);
  const noiseProfileRef = useRef(null); // Arka plan gürültü profili
  const noiseProfileSamplesRef = useRef([]);
  const adaptiveThresholdRef = useRef(null);
  const smoothedRmsRef = useRef(0);
  const spectralDataRef = useRef(new Float32Array(CONFIG.FFT_SIZE / 2));
  const consecutiveVoiceDetectionsRef = useRef(0); // Ardışık ses algılamaları
  const consecutiveSilenceDetectionsRef = useRef(0); // Ardışık sessizlik algılamaları
  const impactBlockTimestampRef = useRef(0); // Son darbe gürültüsü zamanı

  // ========== YARDIMCI FONKSİYONLAR ==========

  // RMS (Root Mean Square) Hesaplama
  const calculateRMS = useCallback((timeDomainData) => {
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128.0;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / timeDomainData.length);
  }, []);

  // Zero-Crossing Rate (Ses algılama için kritik)
  const calculateZCR = useCallback((timeDomainData) => {
    let crossings = 0;
    for (let i = 1; i < timeDomainData.length; i++) {
      const prev = timeDomainData[i - 1] - 128;
      const curr = timeDomainData[i] - 128;
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        crossings++;
      }
    }
    return crossings / timeDomainData.length;
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

  // DENGELİ Eşik Hesaplama (Slider değerinden)
  const calculateThreshold = useCallback((sliderValue) => {
    const normalized = sliderValue / 100;
    // Normal eşik hesaplama (dengeli)
    return CONFIG.MIN_RMS + normalized * (CONFIG.MAX_RMS - CONFIG.MIN_RMS);
  }, []);

  // Adaptif Eşik Hesaplama (Arka plan gürültüsüne göre)
  const calculateAdaptiveThreshold = useCallback(
    (baseThreshold, noiseLevel) => {
      if (noiseSuppressionMode !== "standard" || !adaptiveThreshold || !noiseProfiling || !noiseProfileRef.current) {
        return baseThreshold;
      }

      // Arka plan gürültüsü yüksekse eşiği artır
      const noiseMultiplier = 1 + noiseLevel * 2; // Gürültüye göre 1x-3x arası
      return baseThreshold * noiseMultiplier;
    },
    [adaptiveThreshold, noiseProfiling]
  );

  // Gürültü Profili Güncelleme (Sadece sessizlik anlarında)
  const updateNoiseProfile = useCallback(
    (rms, zcr, spectralData, threshold) => {
      if (!noiseProfiling) return;

      // 🔥 SADECE ÇOK DÜŞÜK SES SEVİYELERİNDE GÜRÜLTÜ PROFİLİ OLUŞTUR
      if (rms > CONFIG.NOISE_PROFILE_THRESHOLD) return;

      const sample = {
        rms,
        zcr,
        spectralData: Array.from(spectralData),
        timestamp: Date.now(),
      };

      noiseProfileSamplesRef.current.push(sample);

      // Son N örneği sakla
      if (
        noiseProfileSamplesRef.current.length > CONFIG.NOISE_PROFILE_SAMPLES
      ) {
        noiseProfileSamplesRef.current.shift();
      }

      // Eski örnekleri temizle (10 saniyeden eski)
      const tenSecondsAgo = Date.now() - 10000;
      noiseProfileSamplesRef.current = noiseProfileSamplesRef.current.filter(
        (s) => s.timestamp > tenSecondsAgo
      );

      // Ortalama gürültü profili hesapla (en az 20 örnek gerekli)
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

  // 🔥 SPEKTRAL GATING - Her frekans bandını ayrı kontrol et
  const spectralGating = useCallback(
    (currentSpectrum, noiseSpectrum, threshold) => {
      if (!CONFIG.SPECTRAL_GATING_ENABLED || !noiseSpectrum) return true;

      let passedBands = 0;
      let totalBands = 0;

      // Ses bandındaki frekansları kontrol et
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

        // Spektral çıkarma: Sinyal - (Gürültü * Faktör)
        const cleanedPower =
          signalPower - noisePower * CONFIG.SPECTRAL_SUBTRACTION_FACTOR;

        // Eğer temizlenmiş sinyal, gürültünün en az MIN_SPECTRAL_RATIO katıysa geçerli
        if (cleanedPower > noisePower * CONFIG.MIN_SPECTRAL_RATIO) {
          passedBands++;
        }
        totalBands++;
      }

      // En az %60 frekans bandının geçmesi gerekiyor
      return passedBands / totalBands > 0.6;
    },
    []
  );

  // 🔥 SES KALİTESİ SKORU (0-1 arası)
  const calculateVoiceQuality = useCallback(
    (rms, zcr, voicePower, windPower, threshold) => {
      let quality = 0;

      // 1. RMS Skoru (0-0.3)
      const rmsScore = Math.min(rms / threshold, 1) * 0.3;
      quality += rmsScore;

      // 2. ZCR Skoru (0-0.2) - İnsan sesi aralığında mı?
      const zcrScore =
        zcr > CONFIG.ZCR_THRESHOLD_MIN && zcr < CONFIG.ZCR_THRESHOLD_MAX
          ? 0.2
          : 0;
      quality += zcrScore;

      // 3. Spektral Güç Skoru (0-0.3)
      const spectralRatio = voicePower / (windPower + 0.001);
      const spectralScore = Math.min(spectralRatio / 5, 1) * 0.3;
      quality += spectralScore;

      // 4. Threshold üstü skoru (0-0.2) - Daha toleranslı
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

  // 🔥 ARKA PLAN GÜRÜLTÜ ÇIKARMA
  const subtractBackgroundNoise = useCallback(
    (currentRMS, currentZCR, threshold) => {
      if (!noiseProfileRef.current) return { rms: currentRMS, zcr: currentZCR };

      const noiseRMS = noiseProfileRef.current.rms;
      const noiseZCR = noiseProfileRef.current.zcr;

      // Gürültüyü çıkar
      const cleanedRMS = Math.max(
        0,
        currentRMS - noiseRMS * CONFIG.SPECTRAL_SUBTRACTION_FACTOR
      );
      const cleanedZCR = Math.max(0, currentZCR - noiseZCR * 0.5);

      return { rms: cleanedRMS, zcr: cleanedZCR };
    },
    []
  );

  // Darbe/klik sesi tespiti (klavye, mouse, vurma) - Çok Agresif (Mekanik Klavye için)
  const detectImpactNoise = useCallback(
    ({ rms, zcr, voicePower, highFreqPower, threshold }) => {
      if (!CONFIG.IMPACT_DETECTION_ENABLED) return false;

      // 1. Yüksek frekans oranı kontrolü (daha düşük eşik - daha fazla klavye sesini yakala)
      const transientRatio = highFreqPower / (voicePower + 0.001);
      const strongHighFreq = transientRatio > CONFIG.IMPACT_TRANSIENT_RATIO;

      // 2. RMS kontrolü (daha düşük eşik - daha fazla klavye sesini yakala)
      const loudEnough = rms > threshold * CONFIG.IMPACT_MIN_RMS_FACTOR;

      // 3. ZCR kontrolü (daha düşük eşik - mekanik klavye seslerini yakala)
      const zcrSpike = zcr > CONFIG.IMPACT_ZCR_THRESHOLD;

      // 4. Voice band kontrolü (çok katı - voice bandı çok zayıf olmalı)
      const weakVoiceBand =
        voicePower === 0
          ? true
          : voicePower < highFreqPower * CONFIG.IMPACT_WEAK_VOICE_RATIO;

      // 5. Yüksek frekans gücü kontrolü (mekanik klavye sesleri yüksek frekanslarda güçlü)
      // Yüksek frekans gücü threshold'un üstünde olmalı
      const hasStrongHighFreq = highFreqPower > threshold * 0.7; // Dengeli eşik

      // 6. Yüksek sesli basışları filtrele - eğer RMS çok yüksekse ama voice power da varsa, bu muhtemelen konuşma
      const veryLoud = rms > threshold * 1.8; // Çok yüksek ses
      const hasSignificantVoice = voicePower > highFreqPower * 0.3; // Voice bandı önemli seviyede
      
      // Eğer çok yüksek sesli ama voice power da varsa, bu muhtemelen konuşma (klavye değil)
      if (veryLoud && hasSignificantVoice) {
        return false; // Bu muhtemelen konuşma, klavye değil
      }

      // 7. Ekstra kontrol: Eğer RMS çok yüksekse ama voice power yoksa ve ZCR çok yüksekse, bu klavye olabilir
      // Ama eğer voice power biraz bile varsa, bu muhtemelen konuşma
      const hasAnyVoice = voicePower > highFreqPower * 0.15; // Çok az bile voice power varsa
      if (veryLoud && hasAnyVoice) {
        return false; // Voice power varsa, bu klavye değil
      }

      // 8. Mekanik klavye için özel kontrol: Yüksek frekans güçlü VE voice band çok zayıf
      const veryWeakVoice = voicePower < highFreqPower * CONFIG.IMPACT_WEAK_VOICE_RATIO;
      
      // Mekanik klavye tespiti: Yüksek frekans güçlü + voice band çok zayıf + ZCR yüksek
      // Bu kombinasyon mekanik klavye için çok karakteristik
      if (hasStrongHighFreq && veryWeakVoice && zcrSpike && loudEnough) {
        return true; // Kesinlikle mekanik klavye
      }
      
      // Alternatif kontrol 1: Yüksek frekans oranı çok yüksek + voice band zayıf
      if (strongHighFreq && veryWeakVoice && loudEnough) {
        return true; // Muhtemelen mekanik klavye
      }
      
      // Alternatif kontrol 2: ZCR çok yüksek + voice band çok zayıf (mekanik klavye karakteristiği)
      if (zcrSpike && veryWeakVoice && hasStrongHighFreq && loudEnough) {
        return true; // Muhtemelen mekanik klavye
      }

      // Tüm kontroller geçmeli (dengeli kontrol - önceki ayara yakın)
      return strongHighFreq && loudEnough && zcrSpike && weakVoiceBand;
    },
    []
  );

  // Ortalama spektrum hesaplama
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

  // Gürültü Seviyesi Hesaplama
  const calculateNoiseLevel = useCallback(() => {
    if (!noiseProfileRef.current) return 0;

    // Profil ile mevcut sesi karşılaştır
    // Bu basitleştirilmiş bir yaklaşım - gerçekte daha karmaşık olabilir
    const profileRms = noiseProfileRef.current.rms;

    // Gürültü seviyesi 0-1 arası (0 = temiz, 1 = çok gürültülü)
    return Math.min(profileRms / CONFIG.MAX_RMS, 1);
  }, []);

  // DENGELİ Voice Activity Detection (Gürültüyü engelle ama konuşmayı geçir)
  const detectVoiceActivity = useCallback(
    (
      rms,
      zcr,
      voiceSpectralPower,
      windSpectralPower,
      threshold,
      frequencyData
    ) => {
      // === 1. ARKA PLAN GÜRÜLTÜ ÇIKARMA (Sadece aktifse) ===
      let cleanedRMS = rms;
      let cleanedZCR = zcr;

      if (noiseSuppressionMode === "standard" && noiseProfiling && noiseProfileRef.current) {
        const cleaned = subtractBackgroundNoise(rms, zcr, threshold);
        cleanedRMS = cleaned.rms;
        cleanedZCR = cleaned.zcr;
      }

      // === 2. KRISP BENZERİ EŞİK KONTROLÜ ===
      // RNNoise modunda daha toleranslı eşik (sesleri erken kesmemek için)
      const thresholdMultiplier = noiseSuppressionMode === "krisp" ? 1.0 : 1.1;
      const balancedThreshold = threshold * thresholdMultiplier;
      const rmsCheck = cleanedRMS > balancedThreshold;

      // === 3. ZCR KONTROLÜ (Dengeli - insan sesi aralığı) ===
      const zcrCheck =
        cleanedZCR > CONFIG.ZCR_THRESHOLD_MIN &&
        cleanedZCR < CONFIG.ZCR_THRESHOLD_MAX;

      // === 4. SPEKTRAL GÜÇ KONTROLÜ (Krisp benzeri) ===
      // Ses gücü, rüzgar gücünün üstünde olmalı (daha toleranslı - ilk kelimeyi kaçırmamak için)
      const spectralRatio = voiceSpectralPower / (windSpectralPower + 0.001);
      const spectralCheck = spectralRatio > CONFIG.MIN_SPECTRAL_RATIO;

      // === 5. SPEKTRAL GATING (Sadece aktifse - Standart modda) ===
      let spectralGatingCheck = true;
      if (
        noiseSuppressionMode === "standard" &&
        CONFIG.SPECTRAL_GATING_ENABLED &&
        noiseProfiling &&
        noiseProfileRef.current?.spectralData
      ) {
        spectralGatingCheck = spectralGating(
          frequencyData,
          noiseProfileRef.current.spectralData,
          threshold
        );
      }

      // === 6. SES KALİTESİ SKORU ===
      const voiceQuality = calculateVoiceQuality(
        cleanedRMS,
        cleanedZCR,
        voiceSpectralPower,
        windSpectralPower,
        threshold
      );
      const qualityCheck = voiceQuality >= CONFIG.MIN_VOICE_QUALITY;

      // === 7. ADAPTİF EŞİK (Eğer aktifse - daha toleranslı) ===
      let adaptiveCheck = true;
      if (noiseSuppressionMode === "standard" && adaptiveThreshold && noiseProfiling && noiseProfileRef.current) {
        const noiseLevel = calculateNoiseLevel();
        const adaptiveThresh = calculateAdaptiveThreshold(
          threshold,
          noiseLevel
        );
        // Adaptif eşiğin üstünde olmalı (1.1x - daha toleranslı)
        adaptiveCheck = cleanedRMS > adaptiveThresh * 1.1;
      }

      // === TÜM KONTROLLER ===
      const checks = [
        rmsCheck,
        zcrCheck,
        spectralCheck,
        spectralGatingCheck,
        qualityCheck,
        adaptiveCheck,
      ].filter(Boolean);

      // KRISP BENZERİ KONTROL
      // RNNoise modunda da threshold'a saygı duymalı
      if (noiseSuppressionMode === "krisp") {
        // RMS threshold'u geçmezse direkt reddet
        if (!rmsCheck) return false;
        
        // Güçlü ses varsa (threshold'un 1.2x üstünde) sadece RMS yeterli
        if (cleanedRMS > threshold * 1.2) {
          return true;
        }
        
        // ZCR veya spektral kontrol varsa geç
        if (zcrCheck || spectralCheck) {
          return true;
        }
        
        // Sadece RMS geçtiyse ve diğer kontroller başarısızsa, reddet
        // Bu sayede %100'de gerçekten hiç ses geçmez
        return false;
      }
      
      // Standart mod: Orijinal mantık
      // RMS check her zaman önemli
      if (!rmsCheck) return false; // RMS geçmezse direkt reddet

      // Eğer güçlü ses varsa (threshold'un 1.4x üstünde) sadece RMS yeterli
      if (cleanedRMS > threshold * 1.4) {
        return true; // Güçlü sesler için hemen geç (ilk kelimeyi kaçırmasın)
      }

      // Eğer iyi ZCR ve spektral oran varsa (insan sesi karakteristikleri) hemen geç
      if (zcrCheck && spectralCheck) {
        return true; // İnsan sesi karakteristikleri varsa hemen geç
      }

      return checks.length >= 2; // En az 2 kontrol (RMS + 1 tane daha)
    },
    [
      noiseProfiling,
      adaptiveThreshold,
      calculateNoiseLevel,
      calculateAdaptiveThreshold,
      subtractBackgroundNoise,
      spectralGating,
      calculateVoiceQuality,
    ]
  );

  // ========== TEMİZLİK ==========
  const cleanup = useCallback((preserveRNNoise = false) => {
    isCleaningUpRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (rnnoiseCheckIntervalRef.current) {
      clearInterval(rnnoiseCheckIntervalRef.current);
      rnnoiseCheckIntervalRef.current = null;
    }

    if (cloneStreamRef.current) {
      cloneStreamRef.current.getTracks().forEach((track) => track.stop());
      cloneStreamRef.current = null;
    }

    // Tüm audio node'ları temizle (RNNoise hariç eğer preserve edilecekse)
    const nodesToClean = [
      sourceRef,
      analyserRef,
      highPassFilterRef,
      lowPassFilterRef,
      notchFilterRef,
      compressorRef,
      gainNodeRef,
      workletNodeRef,
      rawAnalyserRef,
    ];
    
    // RNNoise'u sadece preserve edilmeyecekse temizle
    if (!preserveRNNoise) {
      nodesToClean.push(rnnoiseNodeRef);
    }
    
    nodesToClean.forEach((ref) => {
      if (ref.current) {
        try {
          ref.current.disconnect();
        } catch (e) {
          // Disconnect hatası - node zaten bağlı değilse normal, sessizce yoksay
          if (process.env.NODE_ENV === "development") {
            console.warn("Audio node disconnect error:", e);
          }
        }
        ref.current = null;
      }
    });

    // Audio context'i kapatma - sadece suspend et (RNNoise için önemli)
    // Audio context kapanırsa RNNoise node'u da kaybolur
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      // Sadece suspend et, kapatma (RNNoise node'u korumak için)
      if (audioContextRef.current.state === "running") {
        audioContextRef.current.suspend().catch(() => {});
      }
      // Context'i kapatma - RNNoise için gerekli
      // audioContextRef.current.close().catch(() => {});
      // audioContextRef.current = null;
    }
  }, []);

  // ========== ANA EFFECT ==========
  useEffect(() => {
    // Room bağlantısı tamamlanmadan önce başlatma
    if (!localParticipant || !room) return;

    isCleaningUpRef.current = false;
    let originalStreamTrack = null;
    let trackPublishedHandler = null;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    let retryTimer = null;

    // setupProcessor fonksiyonunu önce tanımla (hoisting sorununu önlemek için)
    const setupProcessor = async () => {
      // Önce cleanup yap - ama RNNoise'u koru (eğer hala geçerliyse)
      // İLK YÜKLEMEDE: Eğer noiseSuppressionMode "krisp" ise ama node yoksa, cleanup'ta node'u temizleme
      // Çünkü ilk yüklemede node henüz oluşturulmamış olabilir
      const shouldPreserveRNNoise = noiseSuppressionMode === "krisp" && 
                                     rnnoiseNodeRef.current && 
                                     audioContextRef.current &&
                                     audioContextRef.current.state !== "closed";
      
      cleanup(!shouldPreserveRNNoise);
      isCleaningUpRef.current = false;
      
      // Audio context'i resume et (eğer suspend edildiyse)
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      
      // Audio context'in running olduğundan emin ol
      if (audioContextRef.current && audioContextRef.current.state !== "running") {
        await audioContextRef.current.resume();
      }

      const trackPublication = localParticipant.getTrackPublication(
        Track.Source.Microphone
      );

      if (!trackPublication?.track) {
        // Track henüz hazır değil, event listener ekle
        if (trackPublishedHandler) {
          localParticipant.off(RoomEvent.TrackPublished, trackPublishedHandler);
        }
        
        trackPublishedHandler = (pub) => {
          if (pub.source === Track.Source.Microphone && pub.track) {
            // Track hazır oldu, setup'ı tekrar dene
            setTimeout(() => {
              if (!isCleaningUpRef.current && localParticipant) {
                setupProcessor();
              }
            }, 200);
            if (trackPublishedHandler) {
              localParticipant.off(RoomEvent.TrackPublished, trackPublishedHandler);
              trackPublishedHandler = null;
            }
          }
        };
        localParticipant.on(RoomEvent.TrackPublished, trackPublishedHandler);
        
        // Retry mekanizması - eğer track bir süre sonra hala hazır değilse tekrar dene
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          setTimeout(() => {
            if (!isCleaningUpRef.current && localParticipant) {
              const checkTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
              if (!checkTrack?.track && retryCount < MAX_RETRIES) {
                setupProcessor();
              }
            }
          }, 500);
        }
        return;
      }
      
      retryCount = 0; // Track bulundu, retry sayacını sıfırla
      
      const track = trackPublication.track;
      
      // Track kontrolleri
      if (!track.mediaStreamTrack) {
        console.warn("Track'in mediaStreamTrack'i yok!");
        return;
      }
      
      // Track'in audio track olduğunu kontrol et
      if (track.mediaStreamTrack.kind !== "audio") {
        console.warn("Track audio track değil!");
        return;
      }
      
      // Track'in readyState'ini kontrol et
      if (track.mediaStreamTrack.readyState === "ended") {
        console.warn("Track zaten sonlandırılmış!");
        return;
      }
      
      originalStreamTrack = track.mediaStreamTrack;

      try {
        // 1. AudioContext Oluştur veya Mevcut Olanı Kullan
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioCtx({
            sampleRate: CONFIG.SAMPLE_RATE,
            latencyHint: "interactive",
          });
        }
        const ctx = audioContextRef.current;

        // Audio context'i resume et (suspended ise)
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        
        // Audio context'in running olduğundan emin ol
        if (ctx.state !== "running") {
          await ctx.resume();
        }

        // 2. Stream Klonlama
        const cloneStream = originalStreamTrack.clone();
        cloneStreamRef.current = new MediaStream([cloneStream]);

        // 3. GELİŞMİŞ AUDIO ZİNCİRİ OLUŞTUR
        const source = ctx.createMediaStreamSource(cloneStreamRef.current);
        sourceRef.current = source;

        // RAW ANALYSER (Gecikmesiz VAD tetikleme için)
        // RNNoise'un attack süresini beklemeden kapıyı açmak için ham sesi analiz et
        const rawAnalyser = ctx.createAnalyser();
        rawAnalyser.fftSize = CONFIG.FFT_SIZE;
        rawAnalyser.smoothingTimeConstant = 0; // Anlık tepki için smoothing yok
        source.connect(rawAnalyser);
        rawAnalyserRef.current = rawAnalyser;

        let currentNode = source;

        // RNNOISE AI GÜRÜLTÜ BASTIRMA (Krisp modu)
        // NOT: RNNoise sadece gürültü bastırma yapar, VAD yapmaz
        // VAD sistemimiz RNNoise'dan SONRA çalışacak (RNNoise çıkışını analiz edecek)
        // Bu sayede hem gürültü bastırma hem de VAD çalışır
        // DÜZELTME: noiseSuppressionMode === "krisp" yeterli, aiNoiseSuppression kontrolü gereksiz
        if (noiseSuppressionMode === "krisp") {
          // RNNoise node yoksa veya geçersizse, yeni oluştur
          if (!rnnoiseNodeRef.current) {
            try {
              // Audio context'in hazır olduğundan emin ol (İLK YÜKLEME İÇİN ÖNEMLİ)
              if (ctx.state !== "running") {
                console.log("⚠️ Audio context suspended, resume ediliyor...");
                await ctx.resume();
                // Audio context'in tamamen hazır olması için bekle
                await new Promise(resolve => setTimeout(resolve, 100));
                console.log("✅ Audio context resumed, state:", ctx.state);
              }
              
              // RNNoise modülünü dinamik olarak yükle (SSR'dan kaçınmak için)
              // AudioWorkletNode sadece tarayıcıda mevcut, SSR'da yüklenmemeli
              if (!rnnoiseModuleRef.current) {
                console.log("🔊 RNNoise modülü yükleniyor...");
                rnnoiseModuleRef.current = await import("simple-rnnoise-wasm");
                console.log("✅ RNNoise modülü yüklendi");
              }
              const { RNNoiseNode, rnnoise_loadAssets } = rnnoiseModuleRef.current;
            
              // RNNoise'u kaydet ve yükle
              // Electron build'de path'leri düzelt (file:// protokolü için absolute path kullan)
              const isElectronBuild = typeof window !== 'undefined' && 
                (window.location?.protocol === 'file:' || 
                 window.navigator?.userAgent?.includes('Electron'));
              
              // Path'leri belirle
              let wasmUrl, workletUrl;
              
              if (isElectronBuild) {
                // Electron build'de: absolute file:// path kullan
                // window.location.href = file:///C:/Users/.../out/index.html
                // Dosyalar index.html ile aynı dizinde (out/)
                const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
                wasmUrl = baseUrl + 'rnnoise.wasm';
                workletUrl = baseUrl + 'rnnoise.worklet.js';
              } else {
                // Development/Web'de: relative path kullan
                wasmUrl = "/rnnoise.wasm";
                workletUrl = "/rnnoise.worklet.js";
              }
              
              // Debug logging (her zaman göster - build'de de sorunları görmek için)
              console.log("🔊 RNNoise yükleniyor...", {
                isElectronBuild,
                protocol: window?.location?.protocol,
                wasmUrl,
                workletUrl,
                currentPath: window?.location?.href,
                locationOrigin: window?.location?.origin,
                locationPathname: window?.location?.pathname,
                baseUrl: isElectronBuild ? window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) : undefined
              });
              
              console.log("🔊 RNNoise assets yükleniyor...", { wasmUrl, workletUrl });
              const assets = await rnnoise_loadAssets({
                scriptSrc: workletUrl,
                moduleSrc: wasmUrl
              });
              console.log("✅ RNNoise assets yüklendi");
              
              // Audio context'in hala running olduğundan emin ol (register öncesi)
              if (ctx.state !== "running") {
                console.log("⚠️ Audio context tekrar suspended, resume ediliyor...");
                await ctx.resume();
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              console.log("🔊 RNNoise node kaydediliyor...");
              await RNNoiseNode.register(ctx, assets);
              console.log("✅ RNNoise node kaydedildi");
              
              // Audio context'in hala running olduğundan emin ol (node oluşturma öncesi)
              if (ctx.state !== "running") {
                console.log("⚠️ Audio context tekrar suspended, resume ediliyor...");
                await ctx.resume();
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              console.log("🔊 RNNoise node oluşturuluyor...");
              const rnnoiseNode = new RNNoiseNode(ctx);
              
              // Node'u bağlamadan önce audio context'in running olduğundan emin ol
              if (ctx.state !== "running") {
                await ctx.resume();
              }
              
              console.log("🔊 RNNoise node bağlanıyor...");
              currentNode.connect(rnnoiseNode);
              currentNode = rnnoiseNode;
              rnnoiseNodeRef.current = rnnoiseNode;
              
              // VAD durumunu güncelle (opsiyonel, sadece bilgi için)
              rnnoiseNode.update();
              
              console.log("✅ RNNoise AI gürültü bastırma aktif (Krisp modu) - YENİ NODE", {
                nodeCreated: !!rnnoiseNode,
                nodeConnected: true,
                audioContextState: ctx.state,
                nodeRef: !!rnnoiseNodeRef.current,
                contextSampleRate: ctx.sampleRate
              });
            } catch (error) {
              // RNNoise yüklenemezse mevcut sisteme devam et (modu değiştirme, sadece RNNoise'u devre dışı bırak)
              console.error("❌ RNNoise yüklenemedi, RNNoise devre dışı bırakılıyor (mod korunuyor):", {
                error: error.message,
                stack: error.stack,
                name: error.name,
                isElectronBuild: typeof window !== 'undefined' && 
                  (window.location?.protocol === 'file:' || 
                   window.navigator?.userAgent?.includes('Electron')),
                protocol: window?.location?.protocol,
                currentPath: window?.location?.href,
                currentMode: noiseSuppressionMode
              });
              rnnoiseNodeRef.current = null;
              rnnoiseModuleRef.current = null; // Hata durumunda modülü temizle
              // NOT: Modu değiştirme, sadece RNNoise'u devre dışı bırak
              // Kullanıcı settings'te "krisp" seçmişse, bu seçimi koru
              // RNNoise yüklenemezse standart işleme devam eder ama mod "krisp" olarak kalır
            }
          } else {
            // RNNoise node zaten var, mevcut source'a bağla
            try {
              const node = rnnoiseNodeRef.current;
              // Önceki bağlantıları temizle (eğer varsa)
              try {
                node.disconnect();
              } catch (e) {
                // Disconnect hatası normal (zaten bağlı değilse)
              }
              // Yeni source'a bağla
              currentNode.connect(node);
              currentNode = node;
              console.log("✅ RNNoise node yeniden kullanılıyor (mevcut node korundu)", {
                nodeExists: !!node,
                audioContextState: ctx.state
              });
            } catch (e) {
              console.warn("⚠️ RNNoise node bağlantı hatası, yeniden oluşturuluyor:", e);
              rnnoiseNodeRef.current = null;
              // Yeniden oluşturma için tekrar dene (recursive call yerine flag kullan)
              // Bu durumda bir sonraki setupProcessor çağrısında yeni node oluşturulacak
            }
          }
        }

        // HIGH-PASS FILTER (Düşük frekanslı gürültüleri kes - Dengeli)
        // Standart modda aktif, Krisp modunda RNNoise varsa RNNoise kendi işlemesini yapıyor
        // Ama RNNoise yoksa standart filtreleri kullan
        if ((noiseSuppressionMode === "standard" || (noiseSuppressionMode === "krisp" && !rnnoiseNodeRef.current)) && (advancedNoiseReduction || spectralFiltering)) {
          const highPass = ctx.createBiquadFilter();
          highPass.type = "highpass";
          highPass.frequency.value = CONFIG.VOICE_LOW_FREQ; // 100Hz altını kes (bass gürültüleri)
          highPass.Q.value = 0.8; // Dengeli filtre
          currentNode.connect(highPass);
          currentNode = highPass;
          highPassFilterRef.current = highPass;
        }

        // LOW-PASS FILTER (Yüksek frekanslı gürültüleri kes - Dengeli)
        // Standart modda aktif, Krisp modunda RNNoise varsa RNNoise kendi işlemesini yapıyor
        // Ama RNNoise yoksa standart filtreleri kullan
        if ((noiseSuppressionMode === "standard" || (noiseSuppressionMode === "krisp" && !rnnoiseNodeRef.current)) && (advancedNoiseReduction || spectralFiltering)) {
          const lowPass = ctx.createBiquadFilter();
          lowPass.type = "lowpass";
          lowPass.frequency.value = CONFIG.VOICE_HIGH_FREQ; // 7kHz üstünü kes (tiz gürültüleri)
          lowPass.Q.value = 0.8; // Dengeli filtre
          currentNode.connect(lowPass);
          currentNode = lowPass;
          lowPassFilterRef.current = lowPass;
        }

        // NOTCH FILTER (50/60Hz güç hattı gürültüsü)
        // Standart modda aktif, Krisp modunda RNNoise varsa RNNoise kendi işlemesini yapıyor
        // Ama RNNoise yoksa standart filtreleri kullan
        if ((noiseSuppressionMode === "standard" || (noiseSuppressionMode === "krisp" && !rnnoiseNodeRef.current)) && advancedNoiseReduction) {
          const notch = ctx.createBiquadFilter();
          notch.type = "notch";
          notch.frequency.value = 50; // Türkiye'de 50Hz
          notch.Q.value = 10;
          currentNode.connect(notch);
          currentNode = notch;
          notchFilterRef.current = notch;
        }

        // DYNAMIC RANGE COMPRESSOR (Ses seviyesini dengeler)
        // Standart modda aktif, Krisp modunda RNNoise varsa RNNoise kendi işlemesini yapıyor
        // Ama RNNoise yoksa standart filtreleri kullan
        if ((noiseSuppressionMode === "standard" || (noiseSuppressionMode === "krisp" && !rnnoiseNodeRef.current)) && advancedNoiseReduction) {
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -24;
          compressor.knee.value = 30;
          compressor.ratio.value = 12;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;
          currentNode.connect(compressor);
          currentNode = compressor;
          compressorRef.current = compressor;
        }

        // GAIN NODE (Sabit kazanç - gereksiz ayar kaldırıldı)
        // Standart modda aktif, Krisp modunda RNNoise varsa RNNoise kendi işlemesini yapıyor
        // Ama RNNoise yoksa standart filtreleri kullan
        if ((noiseSuppressionMode === "standard" || (noiseSuppressionMode === "krisp" && !rnnoiseNodeRef.current)) && advancedNoiseReduction) {
          const gain = ctx.createGain();
          gain.gain.value = 1.0; // Sabit kazanç
          currentNode.connect(gain);
          currentNode = gain;
          gainNodeRef.current = gain;
        }

        // ANALYSER (Ses analizi için)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = CONFIG.FFT_SIZE;
        analyser.smoothingTimeConstant = CONFIG.SPECTRAL_SMOOTHING;
        currentNode.connect(analyser);
        analyserRef.current = analyser;

        // RNNoise durumunu kontrol et ve logla
        if (noiseSuppressionMode === "krisp") {
          console.log("🔍 RNNoise durum kontrolü:", {
            rnnoiseNodeExists: !!rnnoiseNodeRef.current,
            audioContextState: ctx.state,
            analyserConnected: !!analyserRef.current,
            currentNodeType: currentNode.constructor.name,
            sourceConnected: !!sourceRef.current
          });
        }

        // 4. VERİ ARRAY'LERİ
        const timeDataArray = new Uint8Array(analyser.fftSize);
        const frequencyDataArray = new Float32Array(analyser.frequencyBinCount);

        // 5. SES KONTROL DÖNGÜSÜ (Gelişmiş)
        const checkVolume = () => {
          if (
            isCleaningUpRef.current ||
            !analyserRef.current ||
            !originalStreamTrack ||
            originalStreamTrack.readyState === "ended"
          )
            return;

          // Audio context state kontrolü - suspended olursa resume et
          if (audioContextRef.current && audioContextRef.current.state === "suspended") {
            audioContextRef.current.resume().catch((err) => {
              console.warn("Audio context resume hatası:", err);
            });
          }

          // Time domain verisi (RMS ve ZCR için)
          analyserRef.current.getByteTimeDomainData(timeDataArray);

          // Frequency domain verisi (Spektral analiz için)
          analyserRef.current.getFloatFrequencyData(frequencyDataArray);
          spectralDataRef.current = frequencyDataArray;

          // === SES ANALİZİ ===

          // 1. RMS Hesaplama
          const rms = calculateRMS(timeDataArray);
          
          // Raw RMS Hesaplama (Gecikmesiz)
          let rawRms = rms;
          if (rawAnalyserRef.current) {
            const rawTimeData = new Uint8Array(rawAnalyserRef.current.fftSize);
            rawAnalyserRef.current.getByteTimeDomainData(rawTimeData);
            rawRms = calculateRMS(rawTimeData);
          }

          // RMS Yumuşatma - ASİMETRİK (Hızlı açılış, yavaş kapanış)
          const rmsSmoothingFactor = rms > smoothedRmsRef.current 
            ? CONFIG.RMS_ATTACK 
            : CONFIG.RMS_RELEASE;
          
          smoothedRmsRef.current =
            smoothedRmsRef.current * (1 - rmsSmoothingFactor) +
            rms * rmsSmoothingFactor;

          // 2. Zero-Crossing Rate
          const zcr = calculateZCR(timeDataArray);

          // 3. Spektral Güç Hesaplama
          const voicePower = calculateSpectralPower(
            frequencyDataArray,
            CONFIG.VOICE_LOW_FREQ,
            CONFIG.VOICE_HIGH_FREQ
          );

          const windPower = calculateSpectralPower(
            frequencyDataArray,
            CONFIG.WIND_LOW_FREQ,
            CONFIG.WIND_HIGH_FREQ
          );

          const impactHighFreqPower = calculateSpectralPower(
            frequencyDataArray,
            CONFIG.IMPACT_HIGH_FREQ_START,
            CONFIG.IMPACT_HIGH_FREQ_END
          );

          // 4. Temel Eşik Hesaplama - Store'dan güncel değeri al (closure sorunu önlenir)
          const currentVoiceThreshold = useSettingsStore.getState().voiceThreshold;
          let threshold = calculateThreshold(currentVoiceThreshold);

          // 5. Adaptif Eşik (eğer aktifse - sadece Standart modda)
          if (noiseSuppressionMode === "standard" && adaptiveThreshold && noiseProfiling) {
            const noiseLevel = calculateNoiseLevel();
            threshold = calculateAdaptiveThreshold(threshold, noiseLevel);
            adaptiveThresholdRef.current = threshold;
          }

          // 6. Gürültü Profili Güncelleme (sadece çok sessizlikte - Standart modda)
          if (
            noiseSuppressionMode === "standard" &&
            noiseProfiling &&
            smoothedRmsRef.current < CONFIG.NOISE_PROFILE_THRESHOLD
          ) {
            updateNoiseProfile(
              smoothedRmsRef.current,
              zcr,
              frequencyDataArray,
              threshold
            );
          }

          // 7. Darbe gürültüsü tespiti (klavye/mouse/vurma) - ÇOK AGRESİF
          const potentialImpact = detectImpactNoise({
            rms: smoothedRmsRef.current,
            zcr,
            voicePower,
            highFreqPower: impactHighFreqPower,
            threshold,
          });

          const now = Date.now();
          if (potentialImpact) {
            impactBlockTimestampRef.current = now;
            // Darbe gürültüsü sırasında mikrofonu hemen kapat
            if (originalStreamTrack.enabled) {
              originalStreamTrack.enabled = false;
            }
            // Darbe gürültüsü tespit edildiğinde ses algılamayı sıfırla
            firstVoiceDetectionTimeRef.current = 0;
            consecutiveVoiceDetectionsRef.current = 0;
            lastSpeakingTimeRef.current = 0;
          }
          const impactActive =
            impactBlockTimestampRef.current &&
            now - impactBlockTimestampRef.current < CONFIG.IMPACT_HOLD_MS;

          // 8. Voice Activity Detection (Çok Katı - Krisp Benzeri)
          // ÖNEMLİ: Krisp modunda trigger için rawRms kullanarak RNNoise gecikmesini bypass et
          const vadRmsInput = noiseSuppressionMode === "krisp" 
            ? Math.max(smoothedRmsRef.current, rawRms) 
            : smoothedRmsRef.current;

          const isSpeaking = !impactActive && detectVoiceActivity(
            vadRmsInput,
            zcr,
            voicePower,
            windPower,
            threshold,
            frequencyDataArray
          );

          // === DENGELİ MİKROFON KONTROLÜ ===

          if (isSpeaking) {
            // Konuşma başladığında darbe blokajını sıfırla
            impactBlockTimestampRef.current = 0;
            // İlk ses algılanması
            if (firstVoiceDetectionTimeRef.current === 0) {
              firstVoiceDetectionTimeRef.current = Date.now();
              consecutiveVoiceDetectionsRef.current = 0;
            }

            consecutiveVoiceDetectionsRef.current++;
            consecutiveSilenceDetectionsRef.current = 0;
            lastSpeakingTimeRef.current = Date.now();

            const voiceDuration =
              Date.now() - firstVoiceDetectionTimeRef.current;

            // === AKILLI SES AÇMA (En başı kesmemek için optimize) ===
            // RNNoise modunda çok daha agresif açılma (ilk harfi kaçırmamak için)

            // 1. İnsan sesi karakteristikleri kontrolü (ZCR + Spektral)
            const hasGoodZCR =
              zcr > CONFIG.ZCR_THRESHOLD_MIN && zcr < CONFIG.ZCR_THRESHOLD_MAX;
            const hasGoodSpectralRatio =
              voicePower > windPower * CONFIG.MIN_SPECTRAL_RATIO;
            const hasVoiceCharacteristics = hasGoodZCR && hasGoodSpectralRatio;

            // 2. Güçlü ses kontrolü (RNNoise modunda daha düşük eşik)
            const strongVoiceMultiplier = noiseSuppressionMode === "krisp" ? 0.9 : 1.35;
            // Raw RMS kullanarak gecikmesiz kontrol
            const isStrongVoice = Math.max(smoothedRmsRef.current, rawRms) > threshold * strongVoiceMultiplier;

            // 3. Attack time geçti mi? (RNNoise modunda çok daha kısa)
            const attackTime = noiseSuppressionMode === "krisp" 
              ? CONFIG.ATTACK_TIME_RNNOISE 
              : CONFIG.ATTACK_TIME;
            const hasAttackTime = voiceDuration >= attackTime;

            // 4. Minimum süre geçti mi? (RNNoise modunda çok daha kısa)
            const minVoiceDuration = noiseSuppressionMode === "krisp" 
              ? CONFIG.MIN_VOICE_DURATION_RNNOISE 
              : CONFIG.MIN_VOICE_DURATION;
            const hasMinDuration = voiceDuration >= minVoiceDuration;

            // RNNoise modunda: Çok daha agresif açılma (ilk harfi kaçırmamak için)
            if (noiseSuppressionMode === "krisp") {
              // RNNoise modunda: Ses algılandığında HEMEN aç (ilk harfi kaçırmamak için)
              // Sadece çok düşük sesler için bekle
              // RNNoise modunda: Ses algılandığında HEMEN aç (ilk harfi kaçırmamak için)
              // Sadece çok düşük sesler için bekle
              // Raw RMS ile kontrol et (RNNoise gecikmesini bypass et)
              // Threshold %40'ı geçince veya karakteristikler varsa hemen aç
              if (rawRms > threshold * 0.4 || smoothedRmsRef.current > threshold * 0.6 || hasVoiceCharacteristics || hasAttackTime) {
                if (!originalStreamTrack.enabled) {
                  originalStreamTrack.enabled = true;
                }
              }
            } else {
              // Standart mod: Orijinal mantık
              // KRISP BENZERİ HEMEN AÇMA KOŞULLARI (İlk kelimeyi kaçırmamak için):
              // - İnsan sesi karakteristikleri var (ZCR + Spektral) → HEMEN AÇ
              // - VEYA güçlü ses (threshold'un 1.35x üstünde) → HEMEN AÇ
              // - VEYA attack time geçti → HEMEN AÇ
              // - VEYA minimum süre geçti → HEMEN AÇ
              if (
                hasVoiceCharacteristics || // İnsan sesi karakteristikleri varsa hemen aç
                isStrongVoice || // Güçlü ses varsa hemen aç
                hasAttackTime || // Attack time geçtiyse hemen aç
                hasMinDuration // Minimum süre geçtiyse hemen aç
              ) {
                // Mikrofonu aç (ilk kelimeyi kaçırmamak için hemen)
            if (!originalStreamTrack.enabled) {
              originalStreamTrack.enabled = true;
            }
          } else {
                // Henüz açma koşulları sağlanmadı
                // Çok kısa sesler (< 20ms) için kapalı tut (gürültü)
                if (voiceDuration < CONFIG.MAX_SHORT_NOISE_DURATION) {
                  // Çok kısa ses - muhtemelen gürültü, kapalı tut
            } else {
                  // Attack time'a yaklaşıyorsa aç (yakında geçecek)
              if (!originalStreamTrack.enabled) {
                originalStreamTrack.enabled = true;
                  }
                }
              }
            }
          } else {
            // Ses algılanmadı
            consecutiveSilenceDetectionsRef.current++;

            // Ses kesildi, minimum süre kontrolünü sıfırla
            if (firstVoiceDetectionTimeRef.current > 0) {
              const voiceDuration =
                Date.now() - firstVoiceDetectionTimeRef.current;

              // Eğer çok kısa bir ses olduysa (gürültü), sıfırla
              if (voiceDuration < CONFIG.MAX_SHORT_NOISE_DURATION) {
                firstVoiceDetectionTimeRef.current = 0;
                consecutiveVoiceDetectionsRef.current = 0;
              }
            }

            // Ses kesildiğinde bekle (RELEASE_TIME)
            // RNNoise modunda daha uzun bekleme süresi (sesleri erken kesmemek için)
            const releaseTime = noiseSuppressionMode === "krisp" 
              ? CONFIG.RELEASE_TIME_RNNOISE 
              : CONFIG.RELEASE_TIME;
            const timeSinceLastSpeak = Date.now() - lastSpeakingTimeRef.current;

            // Ardışık sessizlik algılaması veya release time geçtiyse kapat
            if (
              consecutiveSilenceDetectionsRef.current >= 3 ||
              timeSinceLastSpeak > releaseTime
            ) {
              firstVoiceDetectionTimeRef.current = 0;
              consecutiveVoiceDetectionsRef.current = 0;

              if (originalStreamTrack.enabled) {
                originalStreamTrack.enabled = false;
              }
            }
          }
        };

        // Döngüyü başlat (10ms aralıklarla - çok hızlı tepki)
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(checkVolume, CONFIG.CHECK_INTERVAL);

        // İlk kontrolü hemen yap
        checkVolume();

        // Periyodik olarak audio context state kontrolü (sadece resume için, RNNoise yeniden bağlama yok)
        // Önceki interval'i temizle
        if (rnnoiseCheckIntervalRef.current) {
          clearInterval(rnnoiseCheckIntervalRef.current);
        }
        
        rnnoiseCheckIntervalRef.current = setInterval(() => {
          if (isCleaningUpRef.current) {
            if (rnnoiseCheckIntervalRef.current) {
              clearInterval(rnnoiseCheckIntervalRef.current);
              rnnoiseCheckIntervalRef.current = null;
            }
            return;
          }

          // Sadece audio context state kontrolü - suspended olursa resume et
          if (audioContextRef.current && audioContextRef.current.state === "suspended") {
            console.warn("⚠️ Audio context suspended, resume ediliyor...");
            audioContextRef.current.resume().catch((err) => {
              console.warn("Audio context resume hatası:", err);
            });
          }
          // RNNoise node kontrolü kaldırıldı - sonsuz döngüyü önlemek için
        }, 15000); // Her 15 saniyede bir kontrol et (CPU tasarrufu)
      } catch (err) {
        console.error("Gelişmiş Voice Processor Hatası:", err);
        if (originalStreamTrack) {
          originalStreamTrack.enabled = true;
        }
      }
    };

    // Room bağlantısı tamamlanana kadar bekle
    const checkConnection = () => {
      if (room.state === ConnectionState.Connected && !isCleaningUpRef.current) {
        // Bağlantı tamamlandı, setupProcessor'ı başlat
        setupProcessor();
        
        // Eğer track henüz hazır değilse, bir süre sonra tekrar dene
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          if (!isCleaningUpRef.current && localParticipant && room.state === ConnectionState.Connected) {
            const trackPublication = localParticipant.getTrackPublication(
              Track.Source.Microphone
            );
            if (!trackPublication?.track) {
              setupProcessor();
            }
          }
        }, CONFIG.INIT_DELAY);
      }
    };
    
    // Room bağlantısı tamamlanmış mı kontrol et
    if (room.state === ConnectionState.Connected) {
      // Zaten bağlıysa hemen başlat
      checkConnection();
    } else {
      // Bağlantı tamamlanana kadar bekle
      room.on(RoomEvent.ConnectionStateChanged, checkConnection);
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      room.off(RoomEvent.ConnectionStateChanged, checkConnection);
      if (trackPublishedHandler && localParticipant) {
        localParticipant.off(RoomEvent.TrackPublished, trackPublishedHandler);
      }
      cleanup();
      if (originalStreamTrack) {
        originalStreamTrack.enabled = true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    localParticipant,
    // voiceThreshold ÇIKARILDI: Her checkVolume döngüsünde zaten güncel değer okunuyor
    // ve değiştiğinde RNNoise node'unun yeniden oluşturulmasına gerek yok (WASM crash'i önler)
    noiseSuppressionMode,
    advancedNoiseReduction,
    adaptiveThreshold,
    noiseProfiling,
    spectralFiltering,
    aiNoiseSuppression,
    // Callback'ler useCallback ile memoize edildiği için dependency'ye eklenmelerine gerek yok
    // Ama ayarlar değiştiğinde processor yeniden başlatılmalı, bu yüzden ayarları dependency'de tutuyoruz
  ]);
}
