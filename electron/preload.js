const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("netrex", {
  // --- AUTH ---
  startOAuth: () => ipcRenderer.invoke("start-oauth"),
  onOAuthSuccess: (callback) => {
    ipcRenderer.removeAllListeners("oauth-success");
    ipcRenderer.on("oauth-success", (_, token) => callback(token));
  },

  // --- SETTINGS & HOTKEYS ---
  updateHotkey: (action, keybinding) =>
    ipcRenderer.invoke("update-hotkey", action, keybinding),
  getHotkey: (action) => ipcRenderer.invoke("get-hotkey", action),
  onHotkeyTriggered: (callback) =>
    ipcRenderer.on("hotkey-triggered", (_, action) => callback(action)),
  setRecordingMode: (enabled) =>
    ipcRenderer.invoke("set-recording-mode", enabled),
  onRawKeydown: (callback) =>
    ipcRenderer.on("raw-keydown", (_, event) => callback(event)),

  // --- LIVEKIT ---
  getLiveKitToken: (room, user) =>
    ipcRenderer.invoke("get-livekit-token", room, user),

  // --- UTILS ---
  openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),

  // --- AUTO UPDATE ---
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (_, status, details) =>
      callback(status, details)
    ),

  onUpdateProgress: (callback) =>
    ipcRenderer.on("update-progress", (_, percent) => callback(percent)),

  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),

  // --- EKRAN PAYLAŞIMI (YENİ) ---
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),

  // --- CLEANUP ---
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),
});
