const { BrowserWindow, app, ipcMain, Menu, session } = require('electron');
const path = require('path');
const log = require('electron-log');
const fs = require('fs'); // fs is needed for checking icon existence inside createTray (if moved here, but actually tray is separate)
// Wait, createTray is in main.js but we might move it to trayManager.
// WindowManager should just handle windows.

const { getIconPath, getSplashHtml, getAlreadyRunningHtml, getExitSplashHtml } = require('./utils');
const store = require('electron-store'); // We need direct access or pass it in? Store is a class.
// We can assume store is passed or instantiated. 
// Ideally windowManager shouldn't care about store too much, but it reads 'settings.closeToTray'.
// Let's instantiate a local store instance or pass it. 
// Instantiating multiple stores on same file is fine.

const currentStore = new (require('electron-store'))();

let mainWindow = null;
let splashWindow = null;
let exitSplashWindow = null;
let isQuitting = false;
let updateCheckCompleted = false;

// We need to export these to be accessible
const getMainWindow = () => mainWindow;
const getSplashWindow = () => splashWindow;
const getExitSplashWindow = () => exitSplashWindow;

const setQuitting = (val) => { isQuitting = val; };

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: getIconPath(),
  });

  const logoPath = app.isPackaged
    ? `file://${path.join(process.resourcesPath, "logo.png").replace(/\\/g, "/")}`
    : `file://${path.join(__dirname, "../../public/logo.png").replace(/\\/g, "/")}`;

  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml(logoPath))}`
  );

  splashWindow.webContents.once("did-finish-load", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      log.info("Splash penceresi gösteriliyor...");
      splashWindow.show();
      splashWindow.focus();
    }
  });

  splashWindow.webContents.once(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      log.error("Splash penceresi yüklenemedi:", errorCode, errorDescription);
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.show();
        splashWindow.focus();
      }
    }
  );

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: getIconPath(),
  });

  exitSplashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getExitSplashHtml())}`
  );

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

function createWindow(isAdminUserFn, currentUserUidFn) {
  const checkUpdatesOnStartup = currentStore.get(
    "settings.checkUpdatesOnStartup",
    true
  );

  // Ana pencereyi başlangıçta gizli oluştur
  // __dirname is electron/managers
  const preloadPath = path.join(__dirname, "../preload.js");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#1e1e1e",
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      // 🚀 v5.3 CPU OPTİMİZASYONU:
      enableBlinkFeatures: '', // Gereksiz Blink özelliklerini kapat
      spellcheck: false, // Yazım denetimi CPU kullanır
    },
    icon: getIconPath(),
  });

  if (app.isPackaged) mainWindow.setMenu(null);
  
  // CSP
  // CSP
  session.defaultSession.webRequest.onHeadersReceived((d, c) => {
    const isDev = !app.isPackaged;
    // 🛡️ v5.3: Production'da da 'unsafe-eval' ekledik çünkü bazı Next.js chunk'ları buna ihtiyaç duyabiliyor
    const scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval'";
    
    c({
      responseHeaders: {
        ...d.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} file: data: blob: https: wss: http: ws:; script-src ${scriptSrc} file: data: blob: https: http:; img-src 'self' data: blob: https: http:; media-src 'self' data: blob: https: http:; font-src 'self' data: https: http:; style-src 'self' 'unsafe-inline' https: http:;`,
        ],
      },
    });
  });

  // Context menu
  mainWindow.webContents.on("context-menu", (event, params) => {
    const uid = currentUserUidFn(); // Get dynamic UID
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

  if (!app.isPackaged) {
    const port = process.env.PORT || 3000;
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    const indexPath = path.join(__dirname, "../../out/index.html");
    mainWindow.loadFile(indexPath);
  }

  // --- KAPATMA DAVRANIŞI (TRAY) ---
  mainWindow.on("close", (event) => {
    const closeToTray = currentStore.get("settings.closeToTray", true);
    if (!isQuitting) {
        event.preventDefault();
        
        if (closeToTray) {
            mainWindow.hide();
            mainWindow.webContents.send("window-state-changed", "hidden");
        } else {
            // Graceful Exit Flow
            // Send request to renderer to show exit splash and cleanup
            mainWindow.webContents.send("request-exit");
            
            // Show window if hidden so splash is visible
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            mainWindow.focus();
        }
        return false;
    }
  });

  // --- PENCERE DURUMU DEĞİŞİKLİKLERİ ---
  const sendState = (s) => mainWindow?.webContents.send("window-state-changed", s);
  
  mainWindow.on("minimize", () => sendState("minimized"));
  mainWindow.on("restore", () => sendState("restored"));
  mainWindow.on("focus", () => sendState("focused"));
  mainWindow.on("show", () => sendState("shown"));

  // Refocused tracking handled by main.js logic if needed, but 'focus' event covers it.

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
