import { useEffect, useRef, useCallback } from 'react';
import { useParticipants } from '@livekit/components-react';
import { Track, TrackEvent } from 'livekit-client';
import { useSpatialAudioStore } from '@/src/store/spatialAudioStore';
import { useParticipantVolumeStore } from '@/src/store/participantVolumeStore';

/**
 * 🎧 Spatial Audio Engine v2.0 — HRTF 3D Audio
 * 
 * Web Audio API pipeline per remote participant:
 * 
 *   [MediaStreamSource]
 *        ↓
 *   [BiquadFilter - LowPass]    ← Mesafeye göre ek matlık
 *        ↓
 *   [SpatialGain]               ← Mesafeye göre volume (custom eğri)
 *        ↓
 *   [UserGain]                  ← Kullanıcının manuel volume ayarı
 *        ↓
 *   [PannerNode - HRTF]         ← 🎯 GERÇEK 3D pozisyonlama
 *        ↓
 *   [DynamicsCompressorNode]    ← Yumuşak pik limiter
 *        ↓
 *   [AudioContext.destination]
 * 
 * HRTF (Head-Related Transfer Function):
 *   - İnsan kafasının akustik modelini kullanır
 *   - Sol/sağ gecikme farkı (ITD)
 *   - Frekans filtreleme (kulak kepçesi simülasyonu)
 *   - Gerçek ön/arka, sol/sağ ayrımı stereo kulaklıkla
 * 
 * 3D Koordinat Sistemi (canvas → audio):
 *   Canvas X → Audio X (sol/sağ)
 *   Canvas Y → Audio Z (ön/arka — üst=arka, alt=ön)
 *   Audio Y = 0 (aynı yükseklik düzlemi)
 */

/** Singleton AudioContext — tüm spatial pipeline'lar paylaşır */
let _spatialAudioContext = null;

function getSpatialAudioContext() {
  if (!_spatialAudioContext || _spatialAudioContext.state === 'closed') {
    _spatialAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // AudioListener'ı merkeze yerleştir (dinleyici = sen)
    const listener = _spatialAudioContext.listener;
    if (listener.positionX) {
      listener.positionX.value = 0;
      listener.positionY.value = 0;
      listener.positionZ.value = 0;
      // Yön: Ekrana doğru bakıyor (Canvas'ta aşağı = ön)
      listener.forwardX.value = 0;
      listener.forwardY.value = 0;
      listener.forwardZ.value = -1;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      // Eski API fallback
      listener.setPosition(0, 0, 0);
      listener.setOrientation(0, 0, -1, 0, 1, 0);
    }
  }
  if (_spatialAudioContext.state === 'suspended') {
    _spatialAudioContext.resume().catch(() => {});
  }
  return _spatialAudioContext;
}

// ── 3D KOORDINAT DÖNÜŞÜMLERİ ──

// Canvas → 3D oda koordinatları
// 600px canvas → 10 birimlik oda (±5 birim her yönde)
const ROOM_SCALE = 60; // canvas_px / ROOM_SCALE = audio_units

/**
 * Canvas pozisyonundan 3D audio koordinatları hesaplama
 * @param {number} x - Canvas X pozisyonu
 * @param {number} y - Canvas Y pozisyonu
 * @param {number} canvasW - Canvas genişliği
 * @param {number} canvasH - Canvas yüksekliği
 * @returns {{ audioX: number, audioY: number, audioZ: number, distance: number, normalized: number }}
 */
function canvasTo3D(x, y, canvasW, canvasH) {
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // Canvas → Audio 3D 
  // X: sol(-) / sağ(+)
  // Y: 0 (aynı yükseklik)
  // Z: ön(-) / arka(+) — Canvas'ta alt = ön (negatif Z), üst = arka (pozitif Z)
  const audioX = (x - centerX) / ROOM_SCALE;
  const audioY = 0;
  const audioZ = (centerY - y) / ROOM_SCALE; // Y ters — canvas üst = arka (pozitif Z)

  // Piksel cinsinden mesafe
  const distance = Math.sqrt(
    Math.pow(x - centerX, 2) +
    Math.pow(y - centerY, 2)
  );

  // Normalize (köşegene göre)
  const maxDistance = Math.sqrt(
    Math.pow(canvasW / 2, 2) +
    Math.pow(canvasH / 2, 2)
  );
  const normalized = Math.min(distance / maxDistance, 1);

  return { audioX, audioY, audioZ, distance, normalized };
}

/**
 * Mesafeden gain ve filter değerleri hesaplama
 * @param {number} normalized - 0-1 arası normalize mesafe
 */
function calculateAudioFromDistance(normalized) {
  // ── GAIN ──
  // Yumuşak eğri: 1.0 → 0.30 (asla sessizliğe düşmez)
  const spatialGain = Math.max(0.30, 1.0 - Math.pow(normalized, 1.5) * 0.70);

  // ── FILTER ──
  // HRTF zaten yön bazlı frekans filtrelemesi yapıyor
  // Bu filter SADECE çok uzak mesafelerde hafif sıcaklık ekler
  // Min 12kHz — ses kalitesini bozmaz, sadece ultra-uzak'ta hafif warmth
  // %60'ın altındaki mesafelerde fiilen transparan (20kHz)
  const filterFrequency = normalized > 0.6 
    ? 12000 + ((1 - normalized) / 0.4 * 8000) // 20000 → 12000 (sadece %60-100 arası)
    : 20000; // Transparan — filtre yok

  return { spatialGain, filterFrequency };
}

// export for SpatialCanvas badge display
function calculateAudioFromPosition(x, y, canvasW, canvasH) {
  const { normalized } = canvasTo3D(x, y, canvasW, canvasH);
  const { spatialGain, filterFrequency } = calculateAudioFromDistance(normalized);
  
  // Pan for display (approximate)
  const centerX = canvasW / 2;
  const rawPan = ((x - centerX) / (canvasW / 2)) * 1.3;
  const pan = Math.max(-1, Math.min(1, rawPan));

  return { pan, spatialGain, filterFrequency };
}

// Canvas boyutları (SpatialCanvas ile senkronize)
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;

export function useSpatialAudio() {
  const participants = useParticipants();
  const spatialEnabled = useSpatialAudioStore(s => s.enabled);
  const positions = useSpatialAudioStore(s => s.positions);
  const volumes = useParticipantVolumeStore(s => s.volumes);

  // Pipeline map: identity → SpatialPipeline
  const pipelinesRef = useRef(new Map());
  // Track which audio elements we've muted
  const mutedElementsRef = useRef(new Map());
  // Previous enabled state for transition detection
  const prevEnabledRef = useRef(false);
  // Current channel ID
  const channelIdRef = useRef(null);

  // Get current channel positions
  const getPositionsForChannel = useCallback(() => {
    const state = useSpatialAudioStore.getState();
    for (const [channelId, channelPositions] of Object.entries(state.positions)) {
      if (Object.keys(channelPositions).length > 0) {
        channelIdRef.current = channelId;
        return channelPositions;
      }
    }
    return {};
  }, []);

  /**
   * Bir katılımcı için HRTF spatial pipeline oluştur
   */
  const createPipeline = useCallback((identity, mediaStream, userVolume) => {
    try {
      const ctx = getSpatialAudioContext();

      // Source: MediaStream'den ses al
      const source = ctx.createMediaStreamSource(mediaStream);

      // BiquadFilter: Low-pass — ek mesafe matlığı
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 20000;
      filter.Q.value = 0.5;

      // SpatialGain: Custom mesafe bazlı volume
      const spatialGain = ctx.createGain();
      spatialGain.gain.value = 1.0;

      // UserGain: Manuel volume ayarı
      const userGainNode = ctx.createGain();
      userGainNode.gain.value = userVolume;

      // 🎯 PannerNode: HRTF 3D pozisyonlama
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';           // Gerçek 3D ses!
      panner.distanceModel = 'inverse';        // Ters mesafe modeli
      panner.refDistance = 1;                  // Bu mesafenin altında tam volume
      panner.maxDistance = 20;                 // Maksimum meaningful mesafe
      panner.rolloffFactor = 0;                // ✅ Mesafe attüasyonu KAPALI — kendi gain eğrimiz yönetiyor
      panner.coneInnerAngle = 360;             // Ses kaynağı her yöne yayılıyor
      panner.coneOuterAngle = 360;
      panner.coneOuterGain = 0;
      // Başlangıç pozisyonu: merkezde
      if (panner.positionX) {
        panner.positionX.value = 0;
        panner.positionY.value = 0;
        panner.positionZ.value = 0;
      } else {
        panner.setPosition(0, 0, 0);
      }

      // DynamicsCompressor: Ultra-hafif safety limiter
      // Sadece patlama/clipping önleme — normal sese dokunmaz
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -3;   // Sadece 0dB'ye çok yakın piklere müdahale
      compressor.knee.value = 30;         // Çok geniş knee — yumuşak geçiş
      compressor.ratio.value = 1.5;       // Minimal sıkıştırma
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Pipeline bağlantıları
      source.connect(filter);
      filter.connect(spatialGain);
      spatialGain.connect(userGainNode);
      userGainNode.connect(panner);
      panner.connect(compressor);
      compressor.connect(ctx.destination);

      const pipeline = {
        source,
        filter,
        spatialGain,
        userGain: userGainNode,
        panner,
        compressor,
        mediaStream, // Save stream ref to detect mute/unmute change
        mutedElements: []
      };

      pipelinesRef.current.set(identity, pipeline);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🎧 HRTF Spatial pipeline oluşturuldu: ${identity}`);
      }

      return pipeline;
    } catch (error) {
      console.warn(`⚠️ Spatial pipeline oluşturulamadı ${identity}:`, error);
      return null;
    }
  }, []);

  /**
   * Bir pipeline'ı temizle ve kaldır
   */
  const destroyPipeline = useCallback((identity) => {
    const pipeline = pipelinesRef.current.get(identity);
    if (!pipeline) return;

    try {
      pipeline.source.disconnect();
      pipeline.filter.disconnect();
      pipeline.spatialGain.disconnect();
      pipeline.userGain.disconnect();
      pipeline.panner.disconnect();
      pipeline.compressor.disconnect();
    } catch (e) {}

    // Unsubscribe from ElementAttached event to prevent leaks
    if (pipeline.track && pipeline.onElementAttached) {
      try {
        pipeline.track.off(TrackEvent.ElementAttached, pipeline.onElementAttached);
      } catch(e) {}
    }

    // Muted audio element'leri geri aç
    pipeline.mutedElements.forEach(el => {
      try { el.muted = false; } catch(e) {}
    });

    pipelinesRef.current.delete(identity);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🎧 Spatial pipeline temizlendi: ${identity}`);
    }
  }, []);

  /**
   * Tüm pipeline'ları temizle
   */
  const destroyAllPipelines = useCallback(() => {
    for (const identity of pipelinesRef.current.keys()) {
      destroyPipeline(identity);
    }
    pipelinesRef.current.clear();

    for (const [el] of mutedElementsRef.current) {
      try { el.muted = false; } catch(e) {}
    }
    mutedElementsRef.current.clear();
  }, [destroyPipeline]);

  /**
   * Bir pipeline'ın 3D audio parametrelerini güncelle
   */
  const updatePipelineAudio = useCallback((identity, position, userVolume) => {
    const pipeline = pipelinesRef.current.get(identity);
    if (!pipeline) return;

    const ctx = getSpatialAudioContext();
    const currentTime = ctx.currentTime;

    if (position) {
      // Canvas → 3D koordinatlar
      const { audioX, audioY, audioZ, normalized } = canvasTo3D(
        position.x, position.y, CANVAS_WIDTH, CANVAS_HEIGHT
      );

      // 🎯 HRTF PannerNode 3D pozisyon güncelleme
      if (pipeline.panner.positionX) {
        // Modern API — AudioParam ile smooth transition
        pipeline.panner.positionX.linearRampToValueAtTime(audioX, currentTime + 0.02);
        pipeline.panner.positionY.linearRampToValueAtTime(audioY, currentTime + 0.02);
        pipeline.panner.positionZ.linearRampToValueAtTime(audioZ, currentTime + 0.02);
      } else {
        // Legacy API
        pipeline.panner.setPosition(audioX, audioY, audioZ);
      }

      // Custom gain ve filter (HRTF'nin üzerine ek efekt)
      const { spatialGain, filterFrequency } = calculateAudioFromDistance(normalized);

      pipeline.spatialGain.gain.linearRampToValueAtTime(spatialGain, currentTime + 0.02);
      pipeline.filter.frequency.linearRampToValueAtTime(
        Math.max(2000, filterFrequency), currentTime + 0.02
      );
    }

    // User volume update
    pipeline.userGain.gain.linearRampToValueAtTime(
      Math.max(0, userVolume), currentTime + 0.02
    );
  }, []);

  // ──────────────────────────────────────────────────
  // SPATIAL MODE ON/OFF GEÇİŞİ
  // ──────────────────────────────────────────────────
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = spatialEnabled;

    if (wasEnabled === spatialEnabled) return;

    if (spatialEnabled) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎧 HRTF Spatial mod açılıyor...');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎧 Spatial mod kapatılıyor...');
      }

      // Fade out → destroy
      for (const [identity, pipeline] of pipelinesRef.current) {
        try {
          const ctx = getSpatialAudioContext();
          pipeline.userGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
        } catch(e) {}
      }

      setTimeout(() => {
        destroyAllPipelines();
      }, 60);
    }
  }, [spatialEnabled, destroyAllPipelines]);

  // ──────────────────────────────────────────────────
  // PIPELINE BUILD/UPDATE
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!spatialEnabled) return;
    if (!participants || participants.length === 0) return;

    const channelPositions = getPositionsForChannel();
    const activeIdentities = new Set();

    participants.forEach(participant => {
      if (participant.isLocal) return;
      const identity = participant.identity;
      activeIdentities.add(identity);

      try {
        const micPub = participant.getTrackPublication(Track.Source.Microphone);
        if (!micPub?.track || micPub.track.kind !== 'audio') return;

        const mediaStream = micPub.track.mediaStream;
        if (!mediaStream) return;

        const userVolume = volumes[identity] ?? 1.0;
        const position = channelPositions[identity] || null;

        // Check if existing pipeline has a different mediaStream reference (mute/unmute case)
        const existingPipeline = pipelinesRef.current.get(identity);
        if (existingPipeline && existingPipeline.mediaStream !== mediaStream) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🎧 Participant ${identity} stream changed - destroying old pipeline`);
          }
          destroyPipeline(identity);
        }

        // Pipeline yoksa oluştur
        if (!pipelinesRef.current.has(identity)) {
          const pipeline = createPipeline(identity, mediaStream, userVolume);
          if (!pipeline) return;

          // Register late-attached elements event listener to prevent echo/double-audio
          const onElementAttached = (el) => {
            if (el && el.tagName === 'AUDIO') {
              el.muted = true;
              if (!pipeline.mutedElements.includes(el)) {
                pipeline.mutedElements.push(el);
              }
              mutedElementsRef.current.set(el, identity);
            }
          };

          // Store track and handler on pipeline for cleanup
          pipeline.track = micPub.track;
          pipeline.onElementAttached = onElementAttached;

          // Register event listener
          micPub.track.on(TrackEvent.ElementAttached, onElementAttached);

          // Original <audio> element'leri mute'la
          const attachedElements = micPub.track.attachedElements || [];
          attachedElements.forEach(el => {
            if (el && el.tagName === 'AUDIO') {
              el.muted = true;
              pipeline.mutedElements.push(el);
              mutedElementsRef.current.set(el, identity);
            }
          });

          // Fade in
          try {
            const ctx = getSpatialAudioContext();
            pipeline.userGain.gain.setValueAtTime(0, ctx.currentTime);
            pipeline.userGain.gain.linearRampToValueAtTime(userVolume, ctx.currentTime + 0.05);
          } catch(e) {}
        }

        // Audio parametrelerini güncelle
        updatePipelineAudio(identity, position, userVolume);

      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Spatial pipeline hatası ${identity}:`, error);
        }
      }
    });

    // Ayrılan katılımcıları temizle
    for (const identity of pipelinesRef.current.keys()) {
      if (!activeIdentities.has(identity)) {
        destroyPipeline(identity);
      }
    }
  }, [
    spatialEnabled, 
    participants, 
    positions, 
    volumes, 
    createPipeline, 
    destroyPipeline, 
    updatePipelineAudio, 
    getPositionsForChannel
  ]);

  // ──────────────────────────────────────────────────
  // CLEANUP
  // ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      destroyAllPipelines();
    };
  }, [destroyAllPipelines]);

  // ──────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────
  return {
    updatePosition: useCallback((identity, x, y) => {
      if (!pipelinesRef.current.has(identity)) return;
      const userVolume = useParticipantVolumeStore.getState().volumes[identity] ?? 1.0;
      updatePipelineAudio(identity, { x, y }, userVolume);
    }, [updatePipelineAudio]),

    activePipelineCount: pipelinesRef.current.size,
    isActive: spatialEnabled,
  };
}

// Export for use in SpatialCanvas
export { calculateAudioFromPosition, CANVAS_WIDTH, CANVAS_HEIGHT };
