const { uIOhook } = require("uiohook-napi");

let isListenerRunning = false;

function setupInputListeners(getMainWindowFn, getHotkeysCacheFn, getIsRecordingModeFn) {
  
  function matchesKeybinding(event, keybinding) {
    if (!keybinding) return false;
    if (keybinding.type === "mouse" || keybinding.mouseButton)
      return event.button && keybinding.mouseButton === event.button;
    if ((keybinding.type === "keyboard" || keybinding.keycode) && event.keycode) {
      if (event.keycode !== keybinding.keycode) return false;
      const isModifier = [
        42, 54, 29, 3613, 97, 56, 3640, 3675, 3676, 125, 126,
      ].includes(event.keycode);
      if (isModifier) return true;
      return (
        !!event.ctrlKey === !!keybinding.ctrlKey &&
        !!event.shiftKey === !!keybinding.shiftKey &&
        !!event.altKey === !!keybinding.altKey &&
        !!event.metaKey === !!keybinding.metaKey
      );
    }
    return false;
  }

  function handleInputEvent(event, type) {
    const mainWindow = getMainWindowFn();
    const isRecordingMode = getIsRecordingModeFn();
    const hotkeysCache = getHotkeysCacheFn();

    if (isRecordingMode && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        "raw-keydown",
        type === "keyboard"
          ? {
              type: "keyboard",
              keycode: event.keycode,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
              metaKey: event.metaKey,
            }
          : { type: "mouse", mouseButton: event.button }
      );
      return;
    }

    const muteKey = hotkeysCache.mute;
    const deafenKey = hotkeysCache.deafen;
    const cameraKey = hotkeysCache.camera;

    if (muteKey && matchesKeybinding(event, muteKey)) {
      mainWindow?.webContents.send("hotkey-triggered", "toggle-mute");
    } else if (deafenKey && matchesKeybinding(event, deafenKey)) {
      mainWindow?.webContents.send("hotkey-triggered", "toggle-deafen");
    } else if (cameraKey && matchesKeybinding(event, cameraKey)) {
      mainWindow?.webContents.send("hotkey-triggered", "toggle-camera");
    }
  }

  uIOhook.on("keydown", (e) => handleInputEvent(e, "keyboard"));
  uIOhook.on("mousedown", (e) => {
    if (e.button !== 1 && e.button !== 2) handleInputEvent(e, "mouse");
  });

  // Default: start immediately? No, wait for explicit start if possible, 
  // but originally it was auto-started?
  // Let's provide control methods.
  
  const start = () => {
      if (!isListenerRunning) {
          uIOhook.start();
          isListenerRunning = true;
      }
  };

  const stop = () => {
      if (isListenerRunning) {
          uIOhook.stop();
          isListenerRunning = false;
      }
  };
  
  return { start, stop };
}

module.exports = { setupInputListeners };
