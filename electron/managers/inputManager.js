const { uIOhook } = require("uiohook-napi");

// ============================================
// 🚀 OPTIMIZED INPUT MANAGER v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ Set kullanımı (array.includes yerine)
// 2. ✅ Hotkeys cache dışarıda
// 3. ✅ Erken return'ler
// 4. ✅ Gereksiz function call'lar önlendi
// 5. ✅ Object pooling (recording mode)
//
// ============================================

let isListenerRunning = false;

// ✅ CONSTANT: Modifier keycodes Set olarak
const MODIFIER_KEYCODES = new Set([42, 54, 29, 3613, 97, 56, 3640, 3675, 3676, 125, 126]);

// ✅ OBJECT POOLING: Recording mode için reusable objects
const keyboardEventPool = {
  type: "keyboard",
  keycode: 0,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false
};

const mouseEventPool = {
  type: "mouse",
  mouseButton: 0
};

function setupInputListeners(getMainWindowFn, getHotkeysCacheFn, getIsRecordingModeFn) {
  
  // ============================================
  // ✅ HOTKEYS CACHE (dışarıda tutuluyor)
  // ============================================
  let cachedHotkeys = null;
  
  const refreshCache = () => {
    cachedHotkeys = getHotkeysCacheFn();
  };
  
  // İlk yükleme
  refreshCache();

  // ============================================
  // ✅ OPTIMIZED: matchesKeybinding (Set kullanımı)
  // ============================================
  function matchesKeybinding(event, keybinding) {
    if (!keybinding) return false;
    
    // Mouse binding
    if (keybinding.mouseButton) {
      return event.button === keybinding.mouseButton;
    }
    
    // Keyboard binding
    if (keybinding.keycode && event.keycode) {
      if (event.keycode !== keybinding.keycode) return false;
      
      // ✅ Set.has() - O(1) complexity (array.includes yerine)
      if (MODIFIER_KEYCODES.has(event.keycode)) return true;
      
      // ✅ Gereksiz boolean conversion kaldırıldı
      return event.ctrlKey === keybinding.ctrlKey &&
             event.shiftKey === keybinding.shiftKey &&
             event.altKey === keybinding.altKey &&
             event.metaKey === keybinding.metaKey;
    }
    
    return false;
  }

  // ============================================
  // ✅ OPTIMIZED: handleInputEvent
  // ============================================
  function handleInputEvent(event, type) {
    // ✅ Erken mainWindow kontrolü
    const mainWindow = getMainWindowFn();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const isRecordingMode = getIsRecordingModeFn();
    
    // Recording mode: Object pooling kullan
    if (isRecordingMode) {
      if (type === "keyboard") {
        // ✅ Object pooling - yeni object yaratma
        keyboardEventPool.keycode = event.keycode;
        keyboardEventPool.ctrlKey = event.ctrlKey;
        keyboardEventPool.shiftKey = event.shiftKey;
        keyboardEventPool.altKey = event.altKey;
        keyboardEventPool.metaKey = event.metaKey;
        mainWindow.webContents.send("raw-keydown", keyboardEventPool);
      } else {
        mouseEventPool.mouseButton = event.button;
        mainWindow.webContents.send("raw-keydown", mouseEventPool);
      }
      return;
    }

    // ✅ Cache'ten hotkeys oku (function call yok)
    if (!cachedHotkeys) return;
    
    // ✅ Tek döngü ile tüm hotkey'leri kontrol et
    for (const [action, keybinding] of Object.entries(cachedHotkeys)) {
      if (keybinding && matchesKeybinding(event, keybinding)) {
        mainWindow.webContents.send("hotkey-triggered", `toggle-${action}`);
        return; // ✅ İlk eşleşmede çık
      }
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  uIOhook.on("keydown", (e) => handleInputEvent(e, "keyboard"));
  
  // ✅ Mouse button filtering (erken return)
  uIOhook.on("mousedown", (e) => {
    if (e.button === 1 || e.button === 2) return; // Middle/right click ignore
    handleInputEvent(e, "mouse");
  });

  // ============================================
  // CONTROL METHODS
  // ============================================
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
  
  // ✅ Cache refresh metodu expose et
  return { start, stop, refreshCache };
}

module.exports = { setupInputListeners };
