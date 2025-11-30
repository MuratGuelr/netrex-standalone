const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("netrex", {
  // Auth
  startOAuth: () => ipcRenderer.invoke("start-oauth"),
  onOAuthSuccess: (callback) => {
    // Listener'ı temizleyip yeniden ekleyelim ki dublike olmasın
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

  // LiveKit
  getLiveKitToken: (room, user) =>
    ipcRenderer.invoke("get-livekit-token", room, user),

  // External Links
  openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),

  // Cleanup
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),
});
