import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Ses Cihazları
      audioInputId: "default",
      audioOutputId: "default",
      // YENİ: Video Cihazı
      videoId: "default",

      // Ses İşleme
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      rawAudioMode: false,

      // Seviyeler
      voiceThreshold: 15,
      sfxVolume: 50,
      profileColor: "#6366f1",

      // Kullanıcı sesleri
      userVolumes: {},

      // Tray Davranışı
      closeToTray: true,

      // Actions
      setAudioInput: (deviceId) => set({ audioInputId: deviceId }),
      setAudioOutput: (deviceId) => set({ audioOutputId: deviceId }),
      // YENİ: Video Action
      setVideoInput: (deviceId) => set({ videoId: deviceId }),

      toggleNoiseSuppression: () =>
        set((state) => ({ noiseSuppression: !state.noiseSuppression })),
      toggleEchoCancellation: () =>
        set((state) => ({ echoCancellation: !state.echoCancellation })),
      toggleAutoGainControl: () =>
        set((state) => ({ autoGainControl: !state.autoGainControl })),
      toggleRawAudioMode: () =>
        set((state) => ({ rawAudioMode: !state.rawAudioMode })),

      setVoiceThreshold: (threshold) => set({ voiceThreshold: threshold }),
      setSfxVolume: (volume) => set({ sfxVolume: volume }),
      setProfileColor: (color) => set({ profileColor: color }),

      setUserVolume: (identity, volume) =>
        set((state) => ({
          userVolumes: { ...state.userVolumes, [identity]: volume },
        })),

      setCloseToTray: async (enabled) => {
        set({ closeToTray: enabled });
        if (window.netrex) {
          await window.netrex.setSetting("closeToTray", enabled);
        }
      },

      syncWithElectron: async () => {
        if (window.netrex) {
          const val = await window.netrex.getSetting("closeToTray");
          if (val !== undefined) {
            set({ closeToTray: val });
          }
        }
      },
    }),
    {
      name: "netrex-user-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.syncWithElectron();
      },
    }
  )
);
