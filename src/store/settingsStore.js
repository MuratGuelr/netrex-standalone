import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set) => ({
      // Ses Cihazları
      audioInputId: "default",
      audioOutputId: "default",

      // Ses İşleme
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      rawAudioMode: false, // Ham ses modu (Kaspersky fix için)

      // Seviyeler
      voiceThreshold: 15,
      sfxVolume: 50,
      profileColor: "#6366f1",

      // Kullanıcı sesleri
      userVolumes: {},

      // YENİ: Bas-Konuş (PTT) Ayarları
      pushToTalk: false, // false = Ses Aktivitesi, true = Bas Konuş
      pttKey: null, // Atanan tuş objesi

      // Actions
      setAudioInput: (deviceId) => set({ audioInputId: deviceId }),
      setAudioOutput: (deviceId) => set({ audioOutputId: deviceId }),

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

      // YENİ ACTIONLAR
      setPushToTalk: (enabled) => set({ pushToTalk: enabled }),
      setPttKey: (key) => set({ pttKey: key }),
    }),
    {
      name: "netrex-user-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
