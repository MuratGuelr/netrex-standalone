import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";

const CONFIG = {
  FFT_SIZE: 2048,
  SAMPLE_RATE: 48000,
  RELEASE_TIME: 100,
  RELEASE_TIME_RNNOISE: 80,
  UI_RELEASE_TIME: 120,
  IMPACT_HOLD_MS: 50,
  MIN_RMS: 0.001,
  MAX_RMS: 0.10,
  VOICE_LOW_FREQ: 80,
  VOICE_HIGH_FREQ: 5000,
  KRISP_WHISPER_ENABLED: true,
  SPECTRAL_SMOOTHING: 0.05,
  // ✅ Noise Gate: smooth fade in/out süresi (saniye)
  GATE_ATTACK: 0.005,  // 5ms - hızlı açılsın
  GATE_RELEASE: 0.08,  // 80ms - yumuşak kapansın (pop/click önleme)
};

// ============================================
// ✅ MODULE-LEVEL CACHE (tüm instance'lar paylaşıyor)
// ============================================
let rnnoiseModulePromise = null;
let cachedResourcesPath = null;
let globalSharedAudioContext = null;
let globalRNNoiseNode = null;
let isRNNoiseRegistering = false;

const getRNNoiseModule = () => {
  if (!rnnoiseModulePromise) {
    rnnoiseModulePromise = import("simple-rnnoise-wasm");
  }
  return rnnoiseModulePromise;
};

// ✅ Resources path cache (Electron IPC call eliminate)
const initResourcesPath = async () => {
  if (cachedResourcesPath) return cachedResourcesPath;
  
  if (typeof window !== 'undefined' && window.netrex?.getResourcesPath) {
    try {
      cachedResourcesPath = await window.netrex.getResourcesPath();
      console.log("✅ Resources path cached:", cachedResourcesPath);
    } catch (e) {
      console.warn("Resources path init failed:", e);
    }
  }
  return cachedResourcesPath;
};

const getResourcePath = (filename) => {
  if (process.env.NODE_ENV === "development" || 
      (typeof window !== 'undefined' && window.location.protocol.startsWith("http"))) {
    return `/${filename}`;
  }
  if (cachedResourcesPath) {
    const cleanPath = cachedResourcesPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const cleanFilename = filename.replace(/^\/+/, '');
    return `file:///${cleanPath}/${cleanFilename}`;
  }
  return `/${filename}`;
};

export function useVoiceProcessor() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const room = useRoomContext();
  
  // ============================================
  // ✅ OPTIMIZED ZUSTAND SELECTORS (shallow)
  // ============================================
  const noiseSuppressionMode = useSettingsStore(s => s.noiseSuppressionMode);
  const advancedNoiseReduction = useSettingsStore(s => s.advancedNoiseReduction);
  const spectralFiltering = useSettingsStore(s => s.spectralFiltering);
  const aiNoiseSuppression = useSettingsStore(s => s.aiNoiseSuppression);
  const voiceThreshold = useSettingsStore(s => s.voiceThreshold);
  const setLocalIsSpeaking = useSettingsStore(s => s.setLocalIsSpeaking);

  // Krisp modu senkronizasyonu
  useEffect(() => {
    if (noiseSuppressionMode === "krisp" && !aiNoiseSuppression) {
      console.log("⚠️ Krisp modu aktif ama aiNoiseSuppression false, düzeltiliyor...");
      useSettingsStore.getState().setNoiseSuppressionMode("krisp");
    }
  }, [noiseSuppressionMode, aiNoiseSuppression]);

  // ========== REF'LER ==========
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const cloneStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const rnnoiseNodeRef = useRef(null);
  const highPassFilterRef = useRef(null);
  const lowPassFilterRef = useRef(null);
  const notchFilterRef = useRef(null);
  const compressorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const antiSilenceOscRef = useRef(null);
  
  // ✅ YENİ: Track replacement refs
  const destinationNodeRef = useRef(null);
  const gateGainNodeRef = useRef(null);
  const originalSenderRef = useRef(null);
  const processedTrackRef = useRef(null);
  
  const lastSpeakingTimeRef = useRef(0);
  const isCleaningUpRef = useRef(false);
  const impactBlockTimestampRef = useRef(0);
  const lastUISpeakingTimeRef = useRef(0);
  const currentUISpeakingRef = useRef(false);
  
  // ✅ THRESHOLD CACHE
  const cachedThresholdRef = useRef(CONFIG.MIN_RMS);
  
  const calculateThreshold = useCallback((sliderValue) => {
    const normalized = sliderValue / 100;
    return CONFIG.MIN_RMS + normalized * (CONFIG.MAX_RMS - CONFIG.MIN_RMS);
  }, []);
  
  useEffect(() => {
    cachedThresholdRef.current = calculateThreshold(voiceThreshold);
  }, [voiceThreshold, calculateThreshold]);

  // ✅ Initialize resources path (once)
  useEffect(() => {
    initResourcesPath();
  }, []);

  // ========== CLEANUP ==========
  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;
    
    if (currentUISpeakingRef.current) {
      currentUISpeakingRef.current = false;
      setLocalIsSpeaking(false);
    }

    // ✅ Orijinal track'i geri yükle (eğer replace edilmişse)
    if (originalSenderRef.current && processedTrackRef.current) {
      try {
        // Track'i stop et
        processedTrackRef.current.stop();
      } catch(e) {}
      processedTrackRef.current = null;
      originalSenderRef.current = null;
    }

    // MediaStream objesini referanslardan temizle
    if (cloneStreamRef.current) {
      cloneStreamRef.current = null;
    }

    // ✅ FIX: Tüm node'lar (rnnoise dahil) her zaman temizlenir
    const nodesToClean = [
      sourceRef, analyserRef, highPassFilterRef, lowPassFilterRef,
      notchFilterRef, compressorRef, gainNodeRef, workletNodeRef,
      rnnoiseNodeRef, destinationNodeRef, gateGainNodeRef
    ];
    
    // Anti-silence oscillator
    if (antiSilenceOscRef.current) {
      try { antiSilenceOscRef.current.stop(); } catch(e) {}
      try { antiSilenceOscRef.current.disconnect(); } catch(e) {}
      antiSilenceOscRef.current = null;
    }
    
    nodesToClean.forEach(ref => {
      if (ref.current) {
        try {
          if (ref === rnnoiseNodeRef) {
             ref.current.disconnect(); 
          } else {
             ref.current.disconnect();
             if (ref.current.port) {
               ref.current.port.close?.();
               ref.current.port.onmessage = null;
             }
          }
        } catch (e) {}
        ref.current = null;
      }
    });
    // ✅ AudioContext'i kapat (memory leak'in en büyük kaynağı!)
    // close() çağrılmazsa tüm internal node'lar, buffer'lar ve audio thread'ler bellekte kalır
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }, [setLocalIsSpeaking]);

  // ========== ANA EFFECT ==========
  useEffect(() => {
    if (!localParticipant || !room) return;

    isCleaningUpRef.current = false;
    let originalStreamTrack = null;
    let retryTimer = null;
    let lastTrackEnabled = null;

    const setupProcessor = async () => {
      cleanup();
      isCleaningUpRef.current = false;
      
      // Audio Context
      if (!globalSharedAudioContext || globalSharedAudioContext.state === "closed") {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        globalSharedAudioContext = new AudioCtx({
          sampleRate: CONFIG.SAMPLE_RATE,
          latencyHint: "interactive",
        });
      }
      audioContextRef.current = globalSharedAudioContext;
      
      const ctx = audioContextRef.current;
      try {
        if (ctx.state === "suspended") await ctx.resume();
        if (ctx.state !== "running") await ctx.resume();
      } catch(e) {
        console.warn("AudioContext resume failed:", e);
      }

      // Track
      const trackPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (!trackPublication?.track) {
        retryTimer = setTimeout(() => {
          if (!isCleaningUpRef.current) setupProcessor();
        }, 500);
        return;
      }
      
      const { track } = trackPublication;
      if (!track.mediaStreamTrack || track.mediaStreamTrack.kind !== "audio" || track.mediaStreamTrack.readyState === "ended") {
        return;
      }
      
      originalStreamTrack = track.mediaStreamTrack;

      // ✅ Orijinal track'ten MediaStream oluştur (analiz + işleme için)
      cloneStreamRef.current = new MediaStream([originalStreamTrack]);
      const source = ctx.createMediaStreamSource(cloneStreamRef.current);
      sourceRef.current = source;
      let currentNode = source;

      // ============================================
      // ✅ NOISE GATE GAIN NODE - Tüm modlarda kullanılacak
      // Bu node, threshold altındaki sesleri bastırmak için
      // ============================================
      const gateGain = ctx.createGain();
      gateGain.gain.value = 1.0; // Başlangıçta açık
      gateGainNodeRef.current = gateGain;

      // ============================================
      // ✅ RNNoise Setup (GERÇEK SES İŞLEME!)
      // ============================================
      if (noiseSuppressionMode === "krisp") {
        try {
          if (!ctx || ctx.state === "closed") {
            console.warn("⚠️ AudioContext closed, RNNoise atlanıyor");
          } else {
            if (!globalRNNoiseNode && !isRNNoiseRegistering) {
              isRNNoiseRegistering = true;
              const rnnoiseModule = await getRNNoiseModule();
              const { RNNoiseNode, rnnoise_loadAssets } = rnnoiseModule;
              
              const workletUrl = getResourcePath('rnnoise.worklet.js');
              const wasmUrl = getResourcePath('rnnoise.wasm');
              
              const assets = await rnnoise_loadAssets({ scriptSrc: workletUrl, moduleSrc: wasmUrl });
              
              if (ctx.state !== "closed") {
                 await RNNoiseNode.register(ctx, assets);
                 globalRNNoiseNode = new RNNoiseNode(ctx);
                 console.log("✅ RNNoise initialized (Globally created)");
              }
              isRNNoiseRegistering = false;
            }

            // Wait if it's currently downloading/compiling
            while (isRNNoiseRegistering) {
              await new Promise(r => setTimeout(r, 50));
            }

            if (globalRNNoiseNode) {
              // ✅ RNNOISE CRASH FIX: anti-silence oscillator
              const antiSilenceOsc = ctx.createOscillator();
              const antiSilenceGain = ctx.createGain();
              antiSilenceGain.gain.value = 1e-10;
              antiSilenceOsc.connect(antiSilenceGain);
              antiSilenceGain.connect(globalRNNoiseNode);
              antiSilenceOsc.start();
              antiSilenceOscRef.current = antiSilenceOsc;

              currentNode.connect(globalRNNoiseNode);
              currentNode = globalRNNoiseNode;
              rnnoiseNodeRef.current = globalRNNoiseNode;
            }
          }
        } catch(e) {
          console.error("❌ RNNoise error:", e);
        }
      }

      // Filters (Standard mode only)
      if ((noiseSuppressionMode === "standard" || !rnnoiseNodeRef.current) && 
          (advancedNoiseReduction || spectralFiltering)) {
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

      // ============================================
      // ✅ KRİTİK: Sinyal BÖLME noktası
      // currentNode = RNNoise/Filtreler sonrası ses
      // Bu sesi iki yere bağlıyoruz:
      //   1. Analyser → Worklet (VAD analizi - gate'den ETKİLENMEZ)
      //   2. Gate → Destination → LiveKit (karşı tarafa giden ses)
      // Gate kapalıyken bile VAD analizi çalışır!
      // ============================================
      const preGateNode = currentNode; // Gate'den önceki son node'u sakla

      // ── YOL 1: VAD Analizi (gate'den bağımsız) ──
      if (ctx.state === "closed" || isCleaningUpRef.current) return;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = CONFIG.FFT_SIZE;
      analyser.smoothingTimeConstant = CONFIG.SPECTRAL_SMOOTHING;
      preGateNode.connect(analyser); // Gate'den ÖNCE bağla!
      analyserRef.current = analyser;

      // ── YOL 2: Gate → Destination → LiveKit ──
      preGateNode.connect(gateGain);
      currentNode = gateGain;

      // ============================================
      // ✅ ÇIKIŞ: İşlenmiş sesi LiveKit Track'e bağla
      // createMediaStreamDestination ile yeni bir MediaStream oluştur
      // ve LiveKit'in sender'ı üzerinde replaceTrack yap
      // ============================================
      if (ctx.state === "closed" || isCleaningUpRef.current) return;
      
      const destination = ctx.createMediaStreamDestination();
      destinationNodeRef.current = destination;
      currentNode.connect(destination);
      
      // ✅ İşlenmiş track'i LiveKit sender'ına bağla
      const processedTrack = destination.stream.getAudioTracks()[0];
      processedTrackRef.current = processedTrack;
      
      try {
        // ✅ LiveKit'in resmi API'si: track.sender kullan (internal pcManager yerine)
        const trackPub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const livekitTrack = trackPub?.track;
        
        if (livekitTrack?.sender) {
          originalSenderRef.current = livekitTrack.sender;
          await livekitTrack.sender.replaceTrack(processedTrack);
          console.log("✅ LiveKit track replaced with processed audio (RNNoise + NoiseGate applied!)");
        } else {
          // Fallback: PC sender'larından bul
          const senders = room.engine?.pcManager?.publisher?.pc?.getSenders?.();
          if (senders) {
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (audioSender) {
              originalSenderRef.current = audioSender;
              await audioSender.replaceTrack(processedTrack);
              console.log("✅ LiveKit track replaced via fallback sender");
            } else {
              console.warn("⚠️ Audio sender bulunamadı");
            }
          } else {
            console.warn("⚠️ Senders erişilemedi, track replacement atlandı");
          }
        }
      } catch(e) {
        console.warn("⚠️ Track replacement başarısız:", e);
      }

      // ============================================
      // 🚀 AUDIO WORKLET SETUP (Sadece UI VAD + Gate Control)
      // ============================================
      try {
        try {
          const processorPath = getResourcePath('voice-processor.worklet.js');
          await ctx.audioWorklet.addModule(processorPath);
        } catch(e) {
          // Worklet zaten kayıtlıysa hata verebilir, sorun değil
        }

        if (ctx.state === "closed" || isCleaningUpRef.current) return;
        const processorNode = new AudioWorkletNode(ctx, 'voice-processor');
        workletNodeRef.current = processorNode;
        
        // ✅ Analyser (gate'den ÖNCE bağlı) → processorNode (VAD analizi)
        analyserRef.current.connect(processorNode);
        
        if (ctx.state === "closed") return;
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        processorNode.connect(silentGain);
        silentGain.connect(ctx.destination);

        // ============================================
        // ✅ VAD + NOISE GATE MESSAGE HANDLER
        // Hem UI animasyonunu hem de noise gate'i kontrol eder
        // ============================================
        processorNode.port.onmessage = (event) => {
          if (isCleaningUpRef.current || !originalStreamTrack) return;
          
          const { 
            type, 
            rms,
            isTransient,
            isSustainedVoice,
            hasPotentialVoice,
            isWhisper
          } = event.data;
          
          if (type !== 'metrics') return;
          
          const now = Date.now();
          const threshold = cachedThresholdRef.current;
          
          const isKrisp = noiseSuppressionMode === "krisp";
          const isStandard = noiseSuppressionMode === "standard";
          
          let isSpeaking = false;
          
          if (isKrisp) {
            // ✅ Krisp: RNNoise arkaplan gürültüsünü zaten siliyor
            // Sadece noise gate threshold'u kontrol et
            isSpeaking = rms > threshold && !isTransient;
          } else if (isStandard) {
            isSpeaking = rms > threshold && (isSustainedVoice || hasPotentialVoice);
          } else {
            // None modu: sadece threshold
            isSpeaking = rms > threshold;
          }
          
          // ============================================
          // ✅ NOISE GATE: Gerçek sesi de kontrol et
          // Gate gain'i smooth şekilde aç/kapat
          // ============================================
          const gateNode = gateGainNodeRef.current;
          if (gateNode && gateNode.gain) {
            const currentTime = ctx.currentTime;
            if (isSpeaking) {
              // Konuşma var → gate AÇ (hızlı attack)
              gateNode.gain.cancelScheduledValues(currentTime);
              gateNode.gain.setTargetAtTime(1.0, currentTime, CONFIG.GATE_ATTACK);
            } else {
              // Konuşma yok → gate KAPAT (yumuşak release)
              gateNode.gain.cancelScheduledValues(currentTime);
              gateNode.gain.setTargetAtTime(0.0, currentTime, CONFIG.GATE_RELEASE);
            }
          }
          
          // ✅ UI indikatörü güncelle
          if (isSpeaking) {
            lastSpeakingTimeRef.current = now;
            lastUISpeakingTimeRef.current = now;
            if (!currentUISpeakingRef.current && room.state === ConnectionState.Connected) {
              currentUISpeakingRef.current = true;
              setLocalIsSpeaking(true);
            }
          } else {
            if (currentUISpeakingRef.current && (now - lastUISpeakingTimeRef.current) > CONFIG.UI_RELEASE_TIME) {
              currentUISpeakingRef.current = false;
              setLocalIsSpeaking(false);
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

    let hasRegisteredConnection = false;
    
    if (room.state === ConnectionState.Connected) {
      checkConnection();
    } else if (!hasRegisteredConnection) {
      hasRegisteredConnection = true;
      console.log("✅ Registering voice processor connection listener (ONCE)");
      room.on(RoomEvent.ConnectionStateChanged, checkConnection);
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (hasRegisteredConnection) {
        console.log("🧹 Cleaning up voice processor connection listener");
        room.off(RoomEvent.ConnectionStateChanged, checkConnection);
      }
      cleanup();
    };
  }, [
    localParticipant,
    isMicrophoneEnabled,
    room,
    noiseSuppressionMode,
    advancedNoiseReduction,
    spectralFiltering,
    aiNoiseSuppression,
    setLocalIsSpeaking,
    cleanup,
  ]);
}
