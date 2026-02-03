const { contextBridge, ipcRenderer } = require("electron");

// ============================================
// 🚀 OPTIMIZED PRELOAD v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ once() kullanımı (one-time events)
// 2. ✅ Event handlers cleanup function döndürüyor
// 3. ✅ removeAllListeners() kaldırıldı
// 4. ✅ getDisplayMedia kaldırıldı (renderer'da olmalı)
//
// ============================================

// ============================================
// ✅ SAFE EVENT HANDLER HELPERS
// ============================================

/**
 * Creates a persistent event handler with cleanup
 * @param {string} channel - IPC channel name
 * @param {function} transform - Optional transform function for event args
 * @returns {function} - Handler registration function that returns cleanup
 */
const createEventHandler = (channel, transform = (_, ...args) => args) => {
    return (callback) => {
        const handler = (event, ...args) => callback(...transform(event, ...args));
        ipcRenderer.on(channel, handler);
        
        // ✅ Return cleanup function
        return () => ipcRenderer.removeListener(channel, handler);
    };
};

/**
 * Creates a one-time event handler (auto cleanup)
 * @param {string} channel - IPC channel name
 * @param {function} transform - Optional transform function for event args
 * @returns {function} - Handler registration function
 */
const createOnceHandler = (channel, transform = (_, ...args) => args) => {
    return (callback) => {
        ipcRenderer.once(channel, (event, ...args) => callback(...transform(event, ...args)));
    };
};

// ============================================
// CONTEXT BRIDGE API
// ============================================
contextBridge.exposeInMainWorld("netrex", {
  // ============================================
  // AUTH
  // ============================================
  startOAuth: () => ipcRenderer.invoke("start-oauth"),
  onOAuthSuccess: createOnceHandler("oauth-success", (_, token) => [token]), // ✅ once()

  // ============================================
  // SETTINGS & HOTKEYS
  // ============================================
  updateHotkey: (action, keybinding) =>
    ipcRenderer.invoke("update-hotkey", action, keybinding),
  getHotkey: (action) => ipcRenderer.invoke("get-hotkey", action),
  onHotkeyTriggered: createEventHandler("hotkey-triggered", (_, action) => [action]),
  setRecordingMode: (enabled) =>
    ipcRenderer.invoke("set-recording-mode", enabled),
  onRawKeydown: createEventHandler("raw-keydown", (_, event) => [event]),

  // ============================================
  // LIVEKIT
  // ============================================
  getLiveKitToken: (room, identity, displayName, serverIndex = 0) =>
    ipcRenderer.invoke("get-livekit-token", room, identity, displayName, serverIndex),
  
  getLiveKitServerInfo: (serverIndex = 0) =>
    ipcRenderer.invoke("get-livekit-server-info", serverIndex),

  // ============================================
  // UTILS
  // ============================================
  openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),

  // ============================================
  // AUTO UPDATE
  // ============================================
  onUpdateStatus: createEventHandler("update-status", (_, status, details) => [status, details]),
  onUpdateProgress: createEventHandler("update-progress", (_, percent) => [percent]),
  onUpdateRestarting: createOnceHandler("update-restarting"), // ✅ once()
  onUpdateRestartFailed: createEventHandler("update-restart-failed", (_, error) => [error]),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),

  // ============================================
  // SCREEN SHARE
  // ============================================
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),

  // ✅ getDisplayMedia kaldırıldı - preload'da çalışmaz, renderer'da olmalı

  // ============================================
  // SETTINGS
  // ============================================
  setSetting: (key, value) => ipcRenderer.invoke("set-setting", key, value),
  getSetting: (key) => ipcRenderer.invoke("get-setting", key),

  // ============================================
  // PATHS
  // ============================================
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  getResourcesPath: () => ipcRenderer.invoke("get-resources-path"),

  // ============================================
  // DEVTOOLS / ADMIN
  // ============================================
  openDevTools: (userUid) => ipcRenderer.invoke("open-devtools", userUid),
  isAdmin: (userUid) => ipcRenderer.invoke("is-admin", userUid),
  setCurrentUserUid: (userUid) => ipcRenderer.invoke("set-current-user-uid", userUid),

  // ============================================
  // WINDOW
  // ============================================
  focusWindow: () => ipcRenderer.invoke("focus-window"),

  // ============================================
  // SPLASH
  // ============================================
  notifySplashComplete: () => ipcRenderer.invoke("splash-complete"),

  // ============================================
  // APP LIFECYCLE
  // ============================================
  onAppWillQuit: createOnceHandler("app-will-quit"), // ✅ once()
  notifyCleanupComplete: () => ipcRenderer.send("cleanup-complete"),

  // ============================================
  // WINDOW STATE
  // ============================================
  onWindowStateChanged: createEventHandler("window-state-changed", (_, state) => [state]),

  // ============================================
  // INPUT LISTENER
  // ============================================
  startInputListener: () => ipcRenderer.invoke("start-input-listener"),
  stopInputListener: () => ipcRenderer.invoke("stop-input-listener"),

  // ============================================
  // EXIT
  // ============================================
  onRequestExit: createEventHandler("request-exit", (_, event) => [event]),
  forceQuitApp: () => ipcRenderer.invoke("app-quit-force"),
});
