import { create } from 'zustand';

/**
 * ✅ OPTIMIZED SoundManagerStore v2.0
 * - AudioContext leak fix
 * - Source node cleanup
 * - Retry logic
 * - Volume clamping
 */
export const useSoundManagerStore = create((set, get) => ({
  audioContext: null,
  cachedBuffers: {},
  isLoaded: false,
  _isInitializing: false,

  init: async () => {
    const state = get();
    if (state.isLoaded || state.audioContext || state._isInitializing) return;
    
    set({ _isInitializing: true });
    
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const sounds = ['mute', 'unmute', 'deafen', 'undeafen', 'join', 'left', 'message'];
      const cache = {};

      const isFileProtocol = window.location.protocol === 'file:';
      const baseUrl = isFileProtocol ? '.' : '';

      const fetchWithRetry = async (url, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.arrayBuffer();
          } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      };

      const loadPromises = sounds.map(async (name) => {
        try {
          const arrayBuffer = await fetchWithRetry(`${baseUrl}/sounds/${name}.mp3`);
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          cache[name] = audioBuffer;
        } catch (err) {
          console.warn(`🔊 Ses yüklenemedi: ${name}`, err);
        }
      });

      await Promise.all(loadPromises);
      
      const loadedCount = Object.keys(cache).length;
      if (loadedCount > 0) {
        set({ audioContext: ctx, cachedBuffers: cache, isLoaded: true, _isInitializing: false });
        console.log(`✅ ${loadedCount}/${sounds.length} sistem sesi RAM'e yüklendi`);
      } else {
        throw new Error('No sounds loaded');
      }
    } catch (e) {
      console.error("❌ SoundManager başlatılamadı:", e);
      set({ _isInitializing: false });
    }
  },

  play: (name, volume = 0.5) => {
    const safeVolume = Math.max(0, Math.min(1, volume));
    const { audioContext, cachedBuffers } = get();
    
    if (!audioContext || !cachedBuffers[name]) {
      const audio = new Audio(`./sounds/${name}.mp3`);
      audio.volume = safeVolume;
      audio.onended = () => {
        audio.src = '';
        audio.remove?.();
      };
      audio.onerror = () => {
        audio.src = '';
        audio.remove?.();
      };
      audio.play().catch(() => {
        audio.src = '';
        audio.remove?.();
      });
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = cachedBuffers[name];
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = safeVolume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
    
    source.start(0);
  },
  
  cleanup: () => {
    const { audioContext } = get();
    if (audioContext) {
      audioContext.close();
      set({ audioContext: null, cachedBuffers: {}, isLoaded: false });
    }
  }
}));
