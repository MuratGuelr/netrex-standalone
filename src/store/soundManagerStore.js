import { create } from 'zustand';

/**
 * 🚀 SoundManagerStore - Ses efektlerini RAM'e (AudioBuffer) yükleyip saklar.
 * Disk gecikmesini saniyelerden milisaniyelere indirir.
 */
export const useSoundManagerStore = create((set, get) => ({
  audioContext: null,
  cachedBuffers: {},
  isLoaded: false,

  init: async () => {
    if (get().isLoaded) return;
    
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const sounds = ['mute', 'unmute', 'deafen', 'undeafen', 'join', 'left', 'message'];
      const cache = {};

      const isFileProtocol = window.location.protocol === 'file:';
      const baseUrl = isFileProtocol ? '.' : '';

      const loadPromises = sounds.map(async (name) => {
        try {
          const response = await fetch(`${baseUrl}/sounds/${name}.mp3`);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          cache[name] = audioBuffer;
        } catch (err) {
          console.warn(`🔊 Ses yüklenemedi: ${name}`, err);
        }
      });

      await Promise.all(loadPromises);
      set({ audioContext: ctx, cachedBuffers: cache, isLoaded: true });
      console.log("✅ Tüm sistem sesleri RAM'e yüklendi (Low Latency Mode)");
    } catch (e) {
      console.error("❌ SoundManager başlatılamadı:", e);
    }
  },

  play: (name, volume = 0.5) => {
    const { audioContext, cachedBuffers } = get();
    if (!audioContext || !cachedBuffers[name]) {
      // Fallback: Cache yoksa klasik yöntemle dene (çok düşük ihtimal)
      const audio = new Audio(`./sounds/${name}.mp3`);
      audio.volume = volume;
      audio.play().catch(() => {});
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = cachedBuffers[name];
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start(0);
  }
}));
