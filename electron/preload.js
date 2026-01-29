const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("netrex", {
  // Auth
  startOAuth: () => ipcRenderer.invoke("start-oauth"),
  onOAuthSuccess: (callback) => {
    ipcRenderer.removeAllListeners("oauth-success");
    ipcRenderer.on("oauth-success", (_, token) => callback(token));
  },

  // Settings & Hotkeys
  updateHotkey: (action, keybinding) =>
    ipcRenderer.invoke("update-hotkey", action, keybinding),
  getHotkey: (action) => ipcRenderer.invoke("get-hotkey", action),
  onHotkeyTriggered: (callback) =>
    ipcRenderer.on("hotkey-triggered", (_, action) => callback(action)),
  setRecordingMode: (enabled) =>
    ipcRenderer.invoke("set-recording-mode", enabled),
  onRawKeydown: (callback) =>
    ipcRenderer.on("raw-keydown", (_, event) => callback(event)),

  // LiveKit - Quota Efficient Token Generation (v5.2 - Server Pool Support)
  // identity: Persistent unique ID (userId_deviceShort) - prevents ghost participants
  // displayName: User-friendly name shown in UI
  // serverIndex: (Optional) Which server's credentials to use (for server pool)
  getLiveKitToken: (room, identity, displayName, serverIndex = 0) =>
    ipcRenderer.invoke("get-livekit-token", room, identity, displayName, serverIndex),
  
  // 🚀 v5.2: LiveKit server pool support
  getLiveKitServerInfo: (serverIndex = 0) =>
    ipcRenderer.invoke("get-livekit-server-info", serverIndex),

  // Utils
  openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),

  // Auto Update
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (_, status, details) =>
      callback(status, details)
    ),
  onUpdateProgress: (callback) =>
    ipcRenderer.on("update-progress", (_, percent) => callback(percent)),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),

  // Screen Share
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),

  // Screen Share with audio exclusion
  getDisplayMedia: async (options) => {
    // Electron'da getDisplayMedia'yı override et
    // Netrex seslerini exclude etmek için
    const stream = await navigator.mediaDevices.getDisplayMedia(options);
    
    // Eğer audio track varsa ve sistem sesi paylaşılıyorsa
    // Netrex/LiveKit seslerini filtrele
    if (stream.getAudioTracks().length > 0 && options?.audio?.excludeNetrex) {
      // Audio track'i filtrele (şimdilik direkt kullanıyoruz)
      // İleride Web Audio API ile filtreleme eklenebilir
    }
    
    return stream;
  },

  // --- YENİ: APP AYARLARI ---
  setSetting: (key, value) => ipcRenderer.invoke("set-setting", key, value),
  getSetting: (key) => ipcRenderer.invoke("get-setting", key),

  // Cleanup
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),

  // Electron path helpers for WASM files
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  getResourcesPath: () => ipcRenderer.invoke("get-resources-path"),

  // DevTools (Admin only)
  openDevTools: (userUid) => ipcRenderer.invoke("open-devtools", userUid),
  isAdmin: (userUid) => ipcRenderer.invoke("is-admin", userUid),
  setCurrentUserUid: (userUid) => ipcRenderer.invoke("set-current-user-uid", userUid),

  // Pencereyi ön plana al (bildirim tıklaması için)
  focusWindow: () => ipcRenderer.invoke("focus-window"),

  // Splash screen
  notifySplashComplete: () => ipcRenderer.invoke("splash-complete"),

  // App lifecycle
  onAppWillQuit: (callback) =>
    ipcRenderer.on("app-will-quit", () => callback()),
  
  // Cleanup tamamlandı mesajı gönder
  notifyCleanupComplete: () => ipcRenderer.send("cleanup-complete"),

  // Window state changes (minimize, hide, show, focus)
  onWindowStateChanged: (callback) =>
    ipcRenderer.on("window-state-changed", (_, state) => callback(state)),



  // --- GLOBAL INPUT LISTENER (CPU OPTIMIZATION) ---
  startInputListener: () => ipcRenderer.invoke("start-input-listener"),
  stopInputListener: () => ipcRenderer.invoke("stop-input-listener"),
});
