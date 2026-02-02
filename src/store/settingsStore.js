import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Ses Cihazları
      audioInputId: "default",
      audioOutputId: "default",
      videoId: "default",

      // Global Voice State
      isMuted: false,
      isDeafened: false,
      
      // Global Modal State
      showSettingsModal: false,
      settingsScrollToSection: null, // "profileInfo" etc. - Settings modal açıldığında bu bölüme scroll edilir

      // YENİ: KAMERA İZNİ (Varsayılan Açık)
      enableCamera: true,

      // Ses İşleme
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      rawAudioMode: false,

      // Gelişmiş Ses İşleme (Krisp/Discord benzeri)
      // Ses İşleme Modu: "none" | "standard" | "krisp"
      noiseSuppressionMode: "standard", // Discord benzeri mod seçimi
      advancedNoiseReduction: true, // Çok katmanlı gürültü azaltma (otomatik ayarlanır)
      adaptiveThreshold: true, // Otomatik eşik ayarlama (otomatik ayarlanır)
      noiseProfiling: true, // Arka plan gürültü profili (otomatik ayarlanır)
      spectralFiltering: true, // Spektral filtreleme (otomatik ayarlanır)
      windNoiseReduction: true, // Rüzgar gürültüsü azaltma
      noiseReductionLevel: 70, // 0-100 arası gürültü azaltma seviyesi
      aiNoiseSuppression: false, // AI tabanlı gürültü bastırma (RNNoise) - Opsiyonel (otomatik ayarlanır)

      // Seviyeler
      voiceThreshold: 15,
      sfxVolume: 50,
      profileColor: "#6366f1",

      // Kullanıcı sesleri
      userVolumes: {},

      // Tray
      closeToTray: true,
      checkUpdatesOnStartup: true, // Açılışta güncelleme kontrolü

      // Bildirimler
      desktopNotifications: true,
      notificationSound: true,
      notifyOnMessage: true,
      notifyOnJoin: false,
      notifyOnLeave: false,
      notificationSoundType: "default", // "default" | "custom"

      // Görünüm
      uiScale: 100, // 75, 100, 125, 150
      fontSize: "medium", // "small" | "medium" | "large"
      fontFamily: "system", // Sistem fontları veya web fontları

      // Performans
      hardwareAcceleration: true, // Animasyonlar için GPU zorlama
      graphicsQuality: "high", // "high" | "low" | "potato"
      disableAnimations: false, // Animasyonları tamamen kapat
      disableBackgroundEffects: false, // Arka plan efektlerini kapat
      videoCodec: "vp8", // "vp8" | "h264" | "av1"

      // Kamera
      cameraMirrorEffect: true, // Ayna efekti
      videoResolution: "240p", // "240p" | "360p" | "480p"
      videoFrameRate: 18, // 15 | 18 | 24

      // Kontrol Çubuğu Ayarları
      controlBarHidden: false, // Kontrol çubuğu gizli mi?

      // Online/Offline durumu
      userStatus: "online", // "online" | "idle" | "offline" | "invisible"
      isAutoIdle: false, // Otomatik idle modu mu (pencere arka planda veya inaktivite)?
      idleTimeout: 5 * 60 * 1000, // 5 dakika inaktivite sonrası idle (ms)
      
      // 🚀 v5.2: Ses odasında olma durumu (idle detection için kullanılır)
      isInVoiceRoom: false, // Kullanıcı bir ses odasında mı?
      
      // 🚀 v5.3: Local participant speaking durumu (useVoiceProcessor'dan gelir)
      // Bu sayede useAudioActivity hook'u local için gerekli değil - sıfır ek CPU maliyeti
      localIsSpeaking: false,

      // Actions
      setAudioInput: (deviceId) => set({ audioInputId: deviceId }),
      setAudioOutput: (deviceId) => set({ audioOutputId: deviceId }),
      setVideoInput: (deviceId) => set({ videoId: deviceId }),

      // Voice State Toggles
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleDeaf: () => set((state) => ({ isDeafened: !state.isDeafened })),
      setSettingsOpen: (isOpen) => set({ showSettingsModal: isOpen }),
      setSettingsScrollToSection: (section) => set({ settingsScrollToSection: section }),
      // Settings modal'ı belirli bir bölüme scroll ederek aç
      openSettingsToSection: (section) => set({ showSettingsModal: true, settingsScrollToSection: section }),

      // YENİ: KAMERA İZNİ TOGGLE
      toggleEnableCamera: () =>
        set((state) => ({ enableCamera: !state.enableCamera })),

      toggleNoiseSuppression: () =>
        set((state) => ({ noiseSuppression: !state.noiseSuppression })),
      toggleEchoCancellation: () =>
        set((state) => ({ echoCancellation: !state.echoCancellation })),
      toggleAutoGainControl: () =>
        set((state) => ({ autoGainControl: !state.autoGainControl })),
      toggleRawAudioMode: () =>
        set((state) => ({ rawAudioMode: !state.rawAudioMode })),

      // Gelişmiş Ses İşleme Toggle'ları
      toggleAdvancedNoiseReduction: () =>
        set((state) => ({
          advancedNoiseReduction: !state.advancedNoiseReduction,
        })),
      toggleAdaptiveThreshold: () =>
        set((state) => ({ adaptiveThreshold: !state.adaptiveThreshold })),
      toggleNoiseProfiling: () =>
        set((state) => ({ noiseProfiling: !state.noiseProfiling })),
      toggleSpectralFiltering: () =>
        set((state) => ({ spectralFiltering: !state.spectralFiltering })),
      toggleWindNoiseReduction: () =>
        set((state) => ({ windNoiseReduction: !state.windNoiseReduction })),
      toggleAiNoiseSuppression: () =>
        set((state) => ({ aiNoiseSuppression: !state.aiNoiseSuppression })),
      
      // Ses İşleme Modu Ayarlama (Discord benzeri)
      setNoiseSuppressionMode: (mode) => {
        set((state) => {
          const newState = { noiseSuppressionMode: mode };
          
          // Mode'a göre otomatik ayarları yap
          if (mode === "none") {
            // Hiçbir işleme yok
            newState.advancedNoiseReduction = false;
            newState.adaptiveThreshold = false;
            newState.noiseProfiling = false;
            newState.spectralFiltering = false;
            newState.aiNoiseSuppression = false;
          } else if (mode === "standard") {
            // Standart işleme (mevcut sistemimiz)
            newState.advancedNoiseReduction = true;
            newState.adaptiveThreshold = true;
            newState.noiseProfiling = true;
            newState.spectralFiltering = true;
            newState.aiNoiseSuppression = false;
          } else if (mode === "krisp") {
            // Krisp benzeri AI işleme (RNNoise)
            newState.advancedNoiseReduction = false; // RNNoise kendi işlemesini yapıyor
            newState.adaptiveThreshold = false;
            newState.noiseProfiling = false;
            newState.spectralFiltering = false;
            newState.aiNoiseSuppression = true; // RNNoise aktif
          }
          
          return newState;
        });
      },

      setNoiseReductionLevel: (level) =>
        set({ noiseReductionLevel: Math.max(0, Math.min(100, level)) }),

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
      setCheckUpdatesOnStartup: async (enabled) => {
        set({ checkUpdatesOnStartup: enabled });
        if (window.netrex) {
          await window.netrex.setSetting("checkUpdatesOnStartup", enabled);
        }
      },

      // Bildirim ayarları
      setDesktopNotifications: (enabled) => set({ desktopNotifications: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
      setNotifyOnMessage: (enabled) => set({ notifyOnMessage: enabled }),
      setNotifyOnJoin: (enabled) => set({ notifyOnJoin: enabled }),
      setNotifyOnLeave: (enabled) => set({ notifyOnLeave: enabled }),
      setNotificationSoundType: (type) => set({ notificationSoundType: type }),

      setUIScale: (scale) => set({ uiScale: scale }),
      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (font) => set({ fontFamily: font }),

      // Performans ayarları
      setHardwareAcceleration: (enabled) => set({ hardwareAcceleration: enabled }),
      
      // Grafik Kalitesi Presetleri
      setGraphicsQuality: (quality) => set((state) => {
        const newState = { graphicsQuality: quality };
        
        switch (quality) {
          case "potato":
             newState.disableAnimations = true;
             newState.disableBackgroundEffects = true;
             newState.hardwareAcceleration = false;
             break;
          case "low":
             newState.disableAnimations = false;
             newState.disableBackgroundEffects = true;
             newState.hardwareAcceleration = true;
             break;
          case "high":
             newState.disableAnimations = false;
             newState.disableBackgroundEffects = false;
             newState.hardwareAcceleration = true;
             break;
        }
        return newState;
      }),
      
      toggleDisableAnimations: () => set((state) => ({ disableAnimations: !state.disableAnimations })),
      toggleDisableBackgroundEffects: () => set((state) => ({ disableBackgroundEffects: !state.disableBackgroundEffects })),
      setVideoCodec: (codec) => set({ videoCodec: codec }),

      // Kamera ayarları
      setCameraMirrorEffect: (enabled) => set({ cameraMirrorEffect: enabled }),
      setVideoResolution: (resolution) => set({ videoResolution: resolution }),
      setVideoFrameRate: (fps) => set({ videoFrameRate: fps }),

      // Kontrol Çubuğu Ayarları
      toggleControlBarHidden: () => set((state) => ({ controlBarHidden: !state.controlBarHidden })),

      // Online/Offline ayarları
      // Online/Offline ayarları
      setUserStatus: (status) => set({ userStatus: status, isAutoIdle: false }), // Manuel statüs değişimi otomatik modu kapatır
      setIsAutoIdle: (isIdle) => set((state) => {
        // IDLE OLMA DURUMU:
        if (isIdle) {
            // Sadece 'online' isek otomatik idle olabiliriz. 
            // 'invisible' veya 'offline' isek dokunma.
            if (state.userStatus === 'online') {
                return { userStatus: 'idle', isAutoIdle: true };
            }
        } 
        // AKTİF OLMA DURUMU:
        else {
            // Sadece otomatik olarak idle olduysak geri 'online' yaparız.
            if (state.userStatus === 'idle' && state.isAutoIdle) {
                return { userStatus: 'online', isAutoIdle: false };
            }
        }
        return {};
      }),
      
      // 🚀 v5.2: Ses odasında olma durumunu ayarla
      setInVoiceRoom: (inRoom) => set({ isInVoiceRoom: inRoom }),
      
      // 🚀 v5.3: Local speaking durumunu ayarla (useVoiceProcessor tarafından çağrılır)
      setLocalIsSpeaking: (speaking) => set({ localIsSpeaking: speaking }),

      syncWithElectron: async () => {
        if (window.netrex) {
          const closeToTrayVal = await window.netrex.getSetting("closeToTray");
          if (closeToTrayVal !== undefined) {
            set({ closeToTray: closeToTrayVal });
          }
          const checkUpdatesVal = await window.netrex.getSetting("checkUpdatesOnStartup");
          if (checkUpdatesVal !== undefined) {
            set({ checkUpdatesOnStartup: checkUpdatesVal });
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
