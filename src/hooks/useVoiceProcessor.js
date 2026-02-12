import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { shallow } from "zustand/shallow";

const CONFIG = {
  FFT_SIZE: 2048,
  SAMPLE_RATE: 48000,
  RELEASE_TIME: 100,
  RELEASE_TIME_RNNOISE: 80,
  UI_RELEASE_TIME: 200, // CPU Optimizasyonu: UI update sıklığını düşür
  IMPACT_HOLD_MS: 50,
  MIN_RMS: 0.001,
  MAX_RMS: 0.10,
  VOICE_LOW_FREQ: 80,
  VOICE_HIGH_FREQ: 5000,
  KRISP_WHISPER_ENABLED: true,
  SPECTRAL_SMOOTHING: 0.05,
};

// ============================================
// ✅ MODULE-LEVEL CACHE (tüm instance'lar paylaşıyor)
// ============================================
let rnnoiseModulePromise = null;
let cachedResourcesPath = null;

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
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  
  // ============================================
  // ✅ OPTIMIZED ZUSTAND SELECTORS (shallow)
  // ============================================
  const {
    noiseSuppressionMode,
    advancedNoiseReduction,
    spectralFiltering,
    aiNoiseSuppression,
    voiceThreshold,
    setLocalIsSpeaking
  } = useSettingsStore(
    s => ({
      noiseSuppressionMode: s.noiseSuppressionMode,
      advancedNoiseReduction: s.advancedNoiseReduction,
      spectralFiltering: s.spectralFiltering,
      aiNoiseSuppression: s.aiNoiseSuppression,
      voiceThreshold: s.voiceThreshold,
      setLocalIsSpeaking: s.setLocalIsSpeaking,
    }),
    shallow
  );

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
  // ✅ FIX: preserveRNNoise kaldırıldı - her zaman tamamen temizle
  // suspend() kullanmak Audio Graph Leak'e neden oluyordu
  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;
    
    if (currentUISpeakingRef.current) {
      currentUISpeakingRef.current = false;
      setLocalIsSpeaking(false);
    }

    // Clone stream track'leri durdur
    if (cloneStreamRef.current) {
      cloneStreamRef.current.getTracks().forEach(t => t.stop());
      cloneStreamRef.current = null;
    }

    // ✅ FIX: Tüm node'lar (rnnoise dahil) her zaman temizlenir
    const nodesToClean = [
      sourceRef, analyserRef, highPassFilterRef, lowPassFilterRef,
      notchFilterRef, compressorRef, gainNodeRef, workletNodeRef,
      rnnoiseNodeRef
    ];
    
    nodesToClean.forEach(ref => {
      if (ref.current) {
        try {
          ref.current.disconnect();
          if (ref.current.port) {
            ref.current.port.close?.();
            ref.current.port.onmessage = null;
          }
        } catch (e) {}
        ref.current = null;
      }
    });

    // ✅ FIX: Mutlaka close() kullan, asla suspend() değil
    // suspend() AudioContext'i durdurmaz, worklet thread'leri çalışmaya devam eder
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
    }
    audioContextRef.current = null;
  }, [setLocalIsSpeaking]);

  // ========== ANA EFFECT ==========
  useEffect(() => {
    if (!localParticipant || !room) return;

    isCleaningUpRef.current = false;
    let originalStreamTrack = null;
    let retryTimer = null;
    let lastTrackEnabled = null; // ✅ Track state tracking

    const setupProcessor = async () => {
      // ✅ FIX: Her zaman tamamen temizle, preserveRNNoise yok
      cleanup();
      isCleaningUpRef.current = false;
      
      // Audio Context
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
      lastTrackEnabled = originalStreamTrack.enabled;

      // Stream Cloning
      const cloneStream = originalStreamTrack.clone();
      cloneStreamRef.current = new MediaStream([cloneStream]);
      const source = ctx.createMediaStreamSource(cloneStreamRef.current);
      sourceRef.current = source;
      let currentNode = source;

      // ============================================
      // ✅ RNNoise Setup (Module-level cache, her seferinde yeni node)
      // ============================================
      if (noiseSuppressionMode === "krisp") {
        try {
          const rnnoiseModule = await getRNNoiseModule();
          const { RNNoiseNode, rnnoise_loadAssets } = rnnoiseModule;
          
          const workletUrl = getResourcePath('rnnoise.worklet.js');
          const wasmUrl = getResourcePath('rnnoise.wasm');
          
          const assets = await rnnoise_loadAssets({ scriptSrc: workletUrl, moduleSrc: wasmUrl });
          await RNNoiseNode.register(ctx, assets);
          const rnnoiseNode = new RNNoiseNode(ctx);
          currentNode.connect(rnnoiseNode);
          currentNode = rnnoiseNode;
          rnnoiseNodeRef.current = rnnoiseNode;
          console.log("✅ RNNoise initialized (fresh)");
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

      // Main Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = CONFIG.FFT_SIZE;
      analyser.smoothingTimeConstant = CONFIG.SPECTRAL_SMOOTHING;
      currentNode.connect(analyser);
      analyserRef.current = analyser;
      
      // ============================================
      // 🚀 AUDIO WORKLET SETUP
      // ============================================
      try {
        try {
          const processorPath = getResourcePath('voice-processor.worklet.js');
          await ctx.audioWorklet.addModule(processorPath);
        } catch(e) {
          console.warn("Worklet module load failed:", e);
        }

        const processorNode = new AudioWorkletNode(ctx, 'voice-processor');
        workletNodeRef.current = processorNode;
        currentNode.connect(processorNode);
        
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        processorNode.connect(silentGain);
        silentGain.connect(ctx.destination);

        // ============================================
        // ✅ OPTIMIZED MESSAGE HANDLER v5.0
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
          const threshold = cachedThresholdRef.current; // ✅ CACHED
          
          // Darbe tespiti
          if (isTransient) {
            impactBlockTimestampRef.current = now;
            if (lastTrackEnabled !== false) {
              originalStreamTrack.enabled = false;
              lastTrackEnabled = false;
            }
            return;
          }
          
          const impactActive = (now - impactBlockTimestampRef.current) < CONFIG.IMPACT_HOLD_MS;
          if (impactActive) {
            if (lastTrackEnabled !== false) {
              originalStreamTrack.enabled = false;
              lastTrackEnabled = false;
            }
            return;
          }
          
          // ============================================
          // ✅ MOD BAZLI VAD (Voice Activity Detection)
          // ============================================
          // ÖNEMLI: Tüm modlarda threshold ZORUNLU - altındaki ses geçmez
          const isKrisp = noiseSuppressionMode === "krisp";
          const isStandard = noiseSuppressionMode === "standard";
          
          let isSpeaking = false;
          
          // ✅ Önce threshold kontrolü - altındaysa hiçbir şey geçmez
          if (rms < threshold * 0.5) {
            isSpeaking = false;
          } else if (isKrisp) {
            // Krisp: RNNoise temiz sinyal + threshold
            isSpeaking = rms > threshold && (
              isSustainedVoice || 
              (isWhisper && CONFIG.KRISP_WHISPER_ENABLED) ||
              hasPotentialVoice ||
              !isTransient
            );
          } else if (isStandard) {
            // Standard: Filter chain + threshold
            isSpeaking = rms > threshold * 0.8 && (
              isSustainedVoice || hasPotentialVoice
            );
          } else {
            // None: Sadece threshold
            isSpeaking = rms > threshold * 1.3 && isSustainedVoice;
          }
          
          if (isSpeaking) {
            lastSpeakingTimeRef.current = now;
            impactBlockTimestampRef.current = 0;
            
            // ✅ Track state tracking
            if (lastTrackEnabled !== true) {
              originalStreamTrack.enabled = true;
              lastTrackEnabled = true;
            }
            
            // UI indicator
            lastUISpeakingTimeRef.current = now;
            if (!currentUISpeakingRef.current && room.state === ConnectionState.Connected) {
              currentUISpeakingRef.current = true;
              setLocalIsSpeaking(true);
            }
          } else {
            const releaseTime = isKrisp ? CONFIG.RELEASE_TIME_RNNOISE : CONFIG.RELEASE_TIME;
            
            if ((now - lastSpeakingTimeRef.current) > releaseTime && lastTrackEnabled !== false) {
              originalStreamTrack.enabled = false;
              lastTrackEnabled = false;
            }
            
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

    // ✅ FIX: Use local variable instead of useRef (can't call hooks inside useEffect)
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
      if (originalStreamTrack) originalStreamTrack.enabled = true;
    };
  }, [
    localParticipant,
    room,
    noiseSuppressionMode,
    advancedNoiseReduction,
    spectralFiltering,
    aiNoiseSuppression,
    setLocalIsSpeaking,
    cleanup,
  ]);
}
