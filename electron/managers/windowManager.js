const { BrowserWindow, app, ipcMain, Menu, session } = require('electron');
const path = require('path');
const log = require('electron-log');

// ============================================
// 🚀 OPTIMIZED WINDOW MANAGER v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ HTML encoding cached
// 2. ✅ WebPreferences constants
// 3. ✅ CSP header cached
// 4. ✅ Event listeners optimized
//
// ============================================

const { getIconPath, getSplashHtml, getAlreadyRunningHtml, getExitSplashHtml } = require('./utils');
const currentStore = new (require('electron-store'))();

let mainWindow = null;
let splashWindow = null;
let exitSplashWindow = null;
let isQuitting = false;
let updateCheckCompleted = false;

// Exports
const getMainWindow = () => mainWindow;
const getSplashWindow = () => splashWindow;
const getExitSplashWindow = () => exitSplashWindow;
const setQuitting = (val) => { isQuitting = val; };

// ============================================
// ✅ WEB PREFERENCES CONSTANTS
// ============================================
const SPLASH_WEB_PREFS = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
};

const MAIN_WEB_PREFS = {
    preload: path.join(__dirname, "../preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,
    backgroundThrottling: false,
    enableBlinkFeatures: '',
    spellcheck: false,
    offscreen: false, // ✅ Audio için gerekli
    enableWebSQL: false, // ✅ Gereksiz feature disable
};

// ============================================
// ✅ HTML ENCODING CACHE
// ============================================
let cachedSplashHtml = null;
let cachedExitSplashHtml = null;

function getCachedSplashHtml() {
    if (!cachedSplashHtml) {
        const logoPath = app.isPackaged
            ? `file://${path.join(process.resourcesPath, "logo.png").replace(/\\/g, "/")}`
            : `file://${path.join(__dirname, "../../public/logo.png").replace(/\\/g, "/")}`;
        
        cachedSplashHtml = `data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml(logoPath))}`;
    }
    return cachedSplashHtml;
}

function getCachedExitSplashHtml() {
    if (!cachedExitSplashHtml) {
        cachedExitSplashHtml = `data:text/html;charset=utf-8,${encodeURIComponent(getExitSplashHtml())}`;
    }
    return cachedExitSplashHtml;
}

// ============================================
// ✅ CSP HEADER CACHE
// ============================================
const CSP_HEADER_DEV = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: wss: http: ws:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: http:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data: https: http:",
    "style-src 'self' 'unsafe-inline' https: http:"
].join('; ');

const CSP_HEADER_PROD = [
    "default-src 'self' 'unsafe-inline' file: data: blob: https: wss: http: ws:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: http:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data: https: http:",
    "style-src 'self' 'unsafe-inline' https: http:"
].join('; ');

const CSP_HEADER = app.isPackaged ? CSP_HEADER_PROD : CSP_HEADER_DEV;

// ============================================
// CREATE SPLASH WINDOW
// ============================================
function createSplashWindow() {
  log.info("Splash penceresi oluşturuluyor...");

  splashWindow = new BrowserWindow({
    width: 360,
    height: 480,
    backgroundColor: "#0f0f11",
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    center: true,
    show: false,
    webPreferences: SPLASH_WEB_PREFS, // ✅ Constant
    icon: getIconPath(),
  });

  // ✅ Cached HTML
  splashWindow.loadURL(getCachedSplashHtml());

  splashWindow.webContents.once("did-finish-load", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      log.info("Splash penceresi gösteriliyor...");
      splashWindow.show();
      splashWindow.focus();
    }
  });

  splashWindow.webContents.once("did-fail-load", (event, errorCode, errorDescription) => {
    log.error("Splash penceresi yüklenemedi:", errorCode, errorDescription);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
      splashWindow.focus();
    }
  });

  splashWindow.on("closed", () => {
    log.info("Splash penceresi kapatıldı");
    splashWindow = null;
  });

  splashWindow.on("close", (event) => {
    if (!updateCheckCompleted) {
      log.info("Splash penceresi kapatılmaya çalışıldı ama engellendi");
      event.preventDefault();
    } else {
      log.info("Splash penceresi kapatılıyor");
    }
  });
  
  return splashWindow;
}

// ============================================
// CREATE EXIT SPLASH WINDOW
// ============================================
function createExitSplashWindow() {
  if (exitSplashWindow && !exitSplashWindow.isDestroyed()) {
    return exitSplashWindow;
  }

  exitSplashWindow = new BrowserWindow({
    width: 320,
    height: 400,
    backgroundColor: "#0a0a0f",
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: false,
    webPreferences: SPLASH_WEB_PREFS, // ✅ Constant
    icon: getIconPath(),
  });

  // ✅ Cached HTML
  exitSplashWindow.loadURL(getCachedExitSplashHtml());

  exitSplashWindow.webContents.once("did-finish-load", () => {
    if (exitSplashWindow && !exitSplashWindow.isDestroyed()) {
      exitSplashWindow.show();
      exitSplashWindow.focus();
    }
  });

  exitSplashWindow.on("closed", () => {
    exitSplashWindow = null;
  });

  return exitSplashWindow;
}

// ============================================
// CREATE MAIN WINDOW
// ============================================
function createWindow(isAdminUserFn, currentUserUidFn) {
  const checkUpdatesOnStartup = currentStore.get("settings.checkUpdatesOnStartup", true);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#1e1e1e",
    show: false,
    webPreferences: MAIN_WEB_PREFS, // ✅ Constant
    icon: getIconPath(),
  });

  if (app.isPackaged) mainWindow.setMenu(null);
  
  // ============================================
  // ✅ CSP HEADER - Cached String
  // ============================================
  session.defaultSession.webRequest.onHeadersReceived((d, c) => {
    c({
      responseHeaders: {
        ...d.responseHeaders,
        "Content-Security-Policy": [CSP_HEADER],
      },
    });
  });

  // Context menu (Admin only)
  mainWindow.webContents.on("context-menu", (event, params) => {
    const uid = currentUserUidFn();
    if (uid && isAdminUserFn(uid)) {
      const contextMenuTemplate = [
        { role: "copy", label: "Kopyala" },
        { type: "separator" },
        {
          label: "İncele",
          click: () => {
            mainWindow.webContents.inspectElement(params.x, params.y);
          },
        },
      ];

      const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
      contextMenu.popup();
    }
  });

  // Load app
  if (!app.isPackaged) {
    const port = process.env.PORT || 3000;
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    const indexPath = path.join(__dirname, "../../out/index.html");
    mainWindow.loadFile(indexPath);
  }

  // ============================================
  // CLOSE BEHAVIOR (TRAY)
  // ============================================
  mainWindow.on("close", (event) => {
    const closeToTray = currentStore.get("settings.closeToTray", true);
    if (!isQuitting) {
        event.preventDefault();
        
        if (closeToTray) {
            mainWindow.hide();
            mainWindow.webContents.send("window-state-changed", "hidden");
        } else {
            // Graceful Exit Flow
            mainWindow.webContents.send("request-exit");
            
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            mainWindow.focus();
        }
        return false;
    }
  });

  // ============================================
  // ✅ EVENT LISTENERS - Optimized
  // ============================================
  const sendState = (s) => mainWindow?.webContents.send("window-state-changed", s);
  
  const WINDOW_EVENTS = ['minimize', 'restore', 'focus', 'show'];
  const EVENT_STATE_MAP = {
    minimize: 'minimized',
    restore: 'restored',
    focus: 'focused',
    show: 'shown'
  };

  WINDOW_EVENTS.forEach(event => {
    mainWindow.on(event, () => sendState(EVENT_STATE_MAP[event]));
  });

  // Splash logic
  if (!checkUpdatesOnStartup) {
    if (splashWindow) splashWindow.close();
    mainWindow.show();
  } else {
    // Timeout fallback
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        updateCheckCompleted = true; 
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    }, 5000);
  }

  return mainWindow;
}

// ============================================
// SHOW MAIN WINDOW
// ============================================
function showMainWindow() {
  if (mainWindow && !mainWindow.isVisible()) {
    updateCheckCompleted = true;
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

function setUpdateCheckCompleted(val) {
    updateCheckCompleted = val;
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
    createWindow,
    createSplashWindow,
    createExitSplashWindow,
    getMainWindow,
    getSplashWindow,
    getExitSplashWindow,
    setQuitting,
    showMainWindow,
    setUpdateCheckCompleted
};
