import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";

const CONFIG = {
  FFT_SIZE: 2048,
  SAMPLE_RATE: 48000,
  RELEASE_TIME: 100,
  RELEASE_TIME_RNNOISE: 80,
  UI_RELEASE_TIME: 120, // ✅ FIX: 200ms → 120ms - UserCard'ın kendi debounce'u var (200ms)
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
  const antiSilenceOscRef = useRef(null); // ✅ Anti-silence
  
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

    // MediaStream objesini referanslardan temizle (TRACK'LERİ SAKIN DURDURMA!)
    if (cloneStreamRef.current) {
      cloneStreamRef.current = null;
    }

    // ✅ FIX: Tüm node'lar (rnnoise dahil) her zaman temizlenir
    const nodesToClean = [
      sourceRef, analyserRef, highPassFilterRef, lowPassFilterRef,
      notchFilterRef, compressorRef, gainNodeRef, workletNodeRef,
      rnnoiseNodeRef
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
             // ✅ FIX: RNNoise node is kept globally! We only disconnect its outputs 
             // to prevent feedback loops when the graph is rebuilt.
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

    // ✅ FIX: Do NOT suspend global context to prevent gesture lockouts.
    // Since we disconnect all nodes, resource usage is minimal.
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

      // ✅ FIX: Do NOT clone the stream track. Use it directly to ensure we get live audio bytes.
      // Cloning sometimes results in a dead track if the original was toggled.
      cloneStreamRef.current = new MediaStream([originalStreamTrack]);
      const source = ctx.createMediaStreamSource(cloneStreamRef.current);
      sourceRef.current = source;
      let currentNode = source;

      // ============================================
      // ✅ RNNoise Setup (Module-level cache, her seferinde yeni node)
      // ============================================
      if (noiseSuppressionMode === "krisp") {
        try {
          // ✅ AudioContext çalışıyor mu kontrol et
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
              
              // Wait until it's safe to register (in case context was suspended quickly)
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
              // ✅ RNNOISE CRASH FIX: rnnoise.worklet.js crashes if inputs are empty (silence optimization).
              const antiSilenceOsc = ctx.createOscillator();
              const antiSilenceGain = ctx.createGain();
              antiSilenceGain.gain.value = 1e-10; // Practically zero
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

      // Main Analyser
      if (ctx.state === "closed" || isCleaningUpRef.current) return;
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

        if (ctx.state === "closed" || isCleaningUpRef.current) return;
        const processorNode = new AudioWorkletNode(ctx, 'voice-processor');
        workletNodeRef.current = processorNode;
        currentNode.connect(processorNode);
        
        if (ctx.state === "closed") return;
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
          
          // ============================================
          // ✅ SADECE UI VAD - Track asla kapatılmaz
          // Multi-speaker sesi bastırma sorununu çözmek için
          // originalStreamTrack.enabled'a dokunulmaz, LiveKit kendi yönetir
          // ============================================
          const isKrisp = noiseSuppressionMode === "krisp";
          const isStandard = noiseSuppressionMode === "standard";
          
          let isSpeaking = false;
          
          if (isKrisp) {
            // ✅ KESIN ÇÖZÜM: Krisp zaten arkaplan gürültüsünü sildiği için karmaşık vad hesaplarına gerek yok.
            // Sadece kullanıcının ayarladığı Noise Gate (Eşik) seviyesini geçip geçmediğine bakıyoruz.
            isSpeaking = rms > threshold && !isTransient;
          } else if (isStandard) {
            isSpeaking = rms > threshold && (isSustainedVoice || hasPotentialVoice);
          } else {
            // None modu: sadece threshold
            isSpeaking = rms > threshold;
          }
          
          // ✅ Sadece UI indikatörü güncelle - track'e dokunma
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
