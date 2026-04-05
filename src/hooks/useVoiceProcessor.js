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
let cachedResourcesPath = null;
let globalSharedAudioContext = null;

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
      // Sadece aiNoiseSuppression'ı düzelt, modu tekrar set etme (sonsuz döngü riski)
      useSettingsStore.getState().toggleAiNoiseSuppression();
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
  
  // ✅ Mic enabled ref (to avoid stale closures in message handler)
  const isMicEnabledRef = useRef(isMicrophoneEnabled);
  useEffect(() => {
    isMicEnabledRef.current = isMicrophoneEnabled;
  }, [isMicrophoneEnabled]);
  
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

  // ✅ Noise ayarlarını ref'te tut - settings değişince audio graph yeniden kurulmasın
  const noiseSettingsRef = useRef({});
  useEffect(() => {
    noiseSettingsRef.current = {
      noiseSuppressionMode,
      advancedNoiseReduction,
      spectralFiltering,
      aiNoiseSuppression,
    };
  }, [noiseSuppressionMode, advancedNoiseReduction, spectralFiltering, aiNoiseSuppression]);

  // ✅ Hook unmount edildiğinde global AudioContext'i temizle
  // (cleanup() bunu artık yapmıyor - reconnect döngüsünde tekrar kullanılıyor)
  useEffect(() => {
    return () => {
      if (globalSharedAudioContext && globalSharedAudioContext.state !== 'closed') {
        globalSharedAudioContext.close().catch(() => {});
        globalSharedAudioContext = null;
      }
    };
  }, []); // sadece unmount

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
    
    // ✅ FIX: Local AudioContext ref'ini temizle ama global'i KAPATMA!
    // globalSharedAudioContext'i burada kapatmak RAM leak'e yol açar:
    // - AudioContext kapatılırsa yeniden açmak yeni bellek alanı oluşturur
    // - useEffect cleanup her settings değişiminde tetiklenebildiğinden
    //   sürekli open→close→open döngüsü oluşur
    // Global context'i sadece hook tamamen unmount edildiğinde kapat (aşağıda)
    if (audioContextRef.current && audioContextRef.current !== globalSharedAudioContext) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    }
    audioContextRef.current = null;
  }, [setLocalIsSpeaking]);

  // ✅ Effect 2: Sadece gate kontrolü (mute/unmute için)
  // Bu sayede mute basınca bütün audio graph yeniden kurulmaz, sadece ses kesilir.
  useEffect(() => {
    const gateNode = gateGainNodeRef.current;
    const ctx = audioContextRef.current;
    
    if (!gateNode || !ctx || ctx.state === 'closed') return;
    
    if (!isMicrophoneEnabled) {
      // Mute: gate'i kapat (audio graph yeniden kurulmasın!)
      gateNode.gain.cancelScheduledValues(ctx.currentTime);
      gateNode.gain.setTargetAtTime(0.0, ctx.currentTime, 0.01);
    }
    // Unmute: VAD handler zaten gate'i açacak
  }, [isMicrophoneEnabled]);

  // ========== ANA EFFECT ==========
  useEffect(() => {
    if (!localParticipant || !room) return;

    isCleaningUpRef.current = false;
    let originalStreamTrack = null;
    let retryTimer = null;

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
      gateGain.gain.value = isMicEnabledRef.current ? 1.0 : 0.0; // Mute kontrolü
      gateGainNodeRef.current = gateGain;

      // ============================================
      // ✅ RNNoise Setup (@timephy/rnnoise-wasm)
      // Self-contained worklet with inline WASM - no separate file loading
      // ============================================
      if (noiseSettingsRef.current.noiseSuppressionMode === "krisp") {
        try {
          if (!ctx || ctx.state === "closed") {
            console.warn("⚠️ AudioContext closed, RNNoise atlanıyor");
          } else {
            // Load the bundled worklet (polyfills + WASM + processor all-in-one)
            const workletPath = getResourcePath('rnnoise-suppressor.worklet.js');
            try {
              await ctx.audioWorklet.addModule(workletPath);
            } catch(e) {
              // Worklet already registered on this context - that's OK
            }
            
            if (ctx.state !== "closed" && !isCleaningUpRef.current) {
              const rnnoiseNode = new AudioWorkletNode(ctx, 'NoiseSuppressorWorklet');
              currentNode.connect(rnnoiseNode);
              currentNode = rnnoiseNode;
              rnnoiseNodeRef.current = rnnoiseNode;
              console.log("✅ RNNoise initialized (@timephy/rnnoise-wasm)");
            }
          }
        } catch(e) {
          console.error("❌ RNNoise error:", e);
        }
      }

      // Filters (Standard mode only)
      if ((noiseSettingsRef.current.noiseSuppressionMode === "standard" || !rnnoiseNodeRef.current) && 
          (noiseSettingsRef.current.advancedNoiseReduction || noiseSettingsRef.current.spectralFiltering)) {
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

        if (noiseSettingsRef.current.advancedNoiseReduction) {
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
          
          // Mute ise VAD UI güncellemelerini durdurabiliriz ama analiz devam edebilir
          // Ancak gate kontrolü isMicrophoneEnabled'a bağlı olmalı
          const { 
            type, 
            rms,
            isTransient,
            isSustainedVoice,
            hasPotentialVoice
          } = event.data;
          
          if (type !== 'metrics') return;
          
          const now = Date.now();
          const threshold = cachedThresholdRef.current;
          const { noiseSuppressionMode: nsMode } = noiseSettingsRef.current;
          let isSpeaking = false;
          if (nsMode === "krisp") {
            isSpeaking = rms > threshold && !isTransient;
          } else if (nsMode === "standard") {
            isSpeaking = rms > threshold && (isSustainedVoice || hasPotentialVoice);
          } else {
            isSpeaking = rms > threshold;
          }
          
          // ============================================
          // ✅ NOISE GATE: Sadece mic açıksa gate'i kontrol et
          // ============================================
          const gateNode = gateGainNodeRef.current;
          if (gateNode && gateNode.gain && isMicEnabledRef.current) {
            const currentTime = ctx.currentTime;
            if (isSpeaking) {
              gateNode.gain.cancelScheduledValues(currentTime);
              gateNode.gain.setTargetAtTime(1.0, currentTime, CONFIG.GATE_ATTACK);
            } else {
              gateNode.gain.cancelScheduledValues(currentTime);
              gateNode.gain.setTargetAtTime(0.0, currentTime, CONFIG.GATE_RELEASE);
            }
          }
          
          // ✅ UI indikatörü güncelle (Sadece mic açıksa)
          if (isSpeaking && isMicEnabledRef.current) {
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
      room.on(RoomEvent.ConnectionStateChanged, checkConnection);
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (hasRegisteredConnection) {
        room.off(RoomEvent.ConnectionStateChanged, checkConnection);
      }
      cleanup();
    };
  }, [
    localParticipant,
    room,
    // ✅ Noise ayarları KALDIRILDI - bunlar artık noiseSettingsRef üzerinden okunuyor
    // Bu sayede ayar değişince tüm audio graph yeniden kurulmayacak
    setLocalIsSpeaking,
    cleanup,
  ]);
}
