const { app, Notification, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// ============================================
// 🚀 OPTIMIZED MAIN.JS v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ Command line switches array-based
// 2. ✅ Env loading find() ile optimize
// 3. ✅ Process priority kaldırıldı (minimal etki)
// 4. ✅ Cleanup logic Promise-based (polling yerine)
//
// ============================================

// MANAGERS (Early - no env required)
const { 
    createWindow, 
    createSplashWindow, 
    createExitSplashWindow,
    getMainWindow,
    getSplashWindow,
    setQuitting,
    showMainWindow
} = require("./managers/windowManager");

const { createTray } = require("./managers/trayManager");
const { setupInputListeners } = require("./managers/inputManager");
const { setupUpdateManager, checkForUpdates, quitAndInstall: updateQuitAndInstall } = require("./managers/updateManager");

// ⚠️ ipcHandlers will be required AFTER env loading (line ~70)
// Because it needs LIVEKIT_SERVERS_* env variables during initialization

// --- LOGLAMA AYARLARI ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

// ============================================
// ✅ ENV LOADING - find() ile optimize
// ============================================
const possibleEnvPaths = [
  path.join(__dirname, ".env.local"),
  path.join(__dirname, "local.env"),
  path.join(__dirname, "../.env.local"),
  path.join(process.cwd(), ".env.local"),
];

if (app.isPackaged) {
  possibleEnvPaths.push(
    path.join(path.dirname(app.getPath("exe")), "resources", ".env.local")
  );
}

const envPath = possibleEnvPaths.find(p => fs.existsSync(p));
if (envPath) {
    require("dotenv").config({ path: envPath, override: false });
    console.log("✅ .env.local yüklendi:", envPath);
}
require("dotenv").config({ override: false });

// ============================================
// ✅ IPC HANDLERS - Loaded AFTER env
// ============================================
// Must be loaded here because initLiveKitServers() runs on module load
// and needs LIVEKIT_SERVERS_* env variables to be available
const { 
    registerIpcHandlers, 
    getHotkeysCache, 
    getIsRecordingMode, 
    getIsAdminUser,
    getCurrentUserUid
} = require("./managers/ipcHandlers");

// ============================================
// SSL BYPASS
// ============================================
const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
if (livekitUrl) {
  const httpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const insecureUrl = livekitUrl.replace('wss://', 'http://').replace('ws://', 'http://');
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', `${httpUrl},${insecureUrl}`);
}
app.commandLine.appendSwitch('ignore-certificate-errors');

// ============================================
// ✅ PERFORMANCE FLAGS - Array-based
// ============================================
const PERFORMANCE_FLAGS = [
    // Background throttling disable (Sesli sohbetin arka planda kopmaması için mecburidir)
    // NOT: backgroundThrottling ve disable-background-timer-throttling KALDIRILDI!
    // Bunlar Chromium compositor'ünü hiç uyutmuyor ve idle CPU'yu %10'a çekiyordu.
    // disable-renderer-backgrounding tek başına WebRTC sesin arka planda çalışması için YETERLİDİR.
    'disable-renderer-backgrounding',
    'disable-backgrounding-occluded-windows',
    
    // Audio optimization (Sadece gerekli olanlar. AudioServiceOutOfProcess Main Process'i yorduğu için KESİNLİKLE EKLENMEYECEK!)
    ['enable-features', 'WebRTC-Audio-Priority,WebRTC-H264-With-OpenH264-FFmpeg'],
    ['force-fieldtrials', 'WebRTC-Audio-Priority/Enabled/'],
    ['autoplay-policy', 'no-user-gesture-required'], // ✅ Autoplay enable
];

// Apply all flags
PERFORMANCE_FLAGS.forEach(flag => {
    if (Array.isArray(flag)) {
        app.commandLine.appendSwitch(flag[0], flag[1]);
    } else {
        app.commandLine.appendSwitch(flag);
    }
});

// ============================================
// SINGLE INSTANCE LOCK
// ============================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  const { getAlreadyRunningHtml } = require('./managers/utils');
  app.whenReady().then(() => {
    const { BrowserWindow } = require('electron');
    const warningWindow = new BrowserWindow({
      width: 400, height: 320, frame: false, transparent: false,
      backgroundColor: "#0a0a0f", resizable: false, alwaysOnTop: true,
      skipTaskbar: true, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      center: true
    });
    warningWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getAlreadyRunningHtml())}`);
    warningWindow.once('ready-to-show', () => {
        warningWindow.show();
        setTimeout(() => { warningWindow.close(); app.exit(0); }, 3000);
    });
  });
} else {
  
  // ============================================
  // APP READY
  // ============================================
  app.on("ready", async () => {
    // Platform Specifics
    if (process.platform === "win32") {
        app.setAppUserModelId("Netrex Client");
    }
    
    if (process.platform === "darwin") {
      const { systemPreferences } = require('electron');
      systemPreferences.askForMediaAccess("microphone");
      systemPreferences.askForMediaAccess("camera");
    }

    // Input Listeners
    const inputManager = setupInputListeners(getMainWindow, getHotkeysCache, getIsRecordingMode);

    // Initialize Managers
    registerIpcHandlers(getMainWindow, showMainWindow, inputManager, setQuitting);
    
    // Setup Updates
    setupUpdateManager(getMainWindow);
    
    // Create Splash
    const splash = createSplashWindow(); 
    
    // Create Main Window
    const mainWindow = createWindow(getIsAdminUser, getCurrentUserUid);
    
    // Tray
    createTray(mainWindow, () => {
        // Graceful exit from Tray
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("request-exit");
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    // Initial Update Check
    if (app.isPackaged) {
       checkForUpdates();
    }
  });

  app.on("second-instance", () => {
    const mainWindow = getMainWindow();
    const splashWindow = getSplashWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (splashWindow) {
      if (splashWindow.isMinimized()) splashWindow.restore();
      splashWindow.focus();
    }
  });
}

// ============================================
// ✅ GRACEFUL EXIT - Promise-based (polling yerine)
// ============================================
let isExitInProgress = false;
let cleanupCompleted = false;

app.on("before-quit", async (event) => {
  if (cleanupCompleted || isExitInProgress) {
    if (cleanupCompleted) return;
    event.preventDefault();
    return;
  }
  
  event.preventDefault();
  isExitInProgress = true;
  
  const mainWindow = getMainWindow();
  
  // ✅ ÖNCE cleanup başlat (mainWindow hala görünür)
  const cleanupPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      log.warn("⚠️ Cleanup timeout (3s)");
      resolve('timeout');
    }, 3000); // 5s → 3s (daha hızlı)
    
    ipcMain.once("cleanup-complete", () => {
      clearTimeout(timeout);
      log.info("✅ Cleanup completed");
      resolve('complete');
    });
  });
  
  // Request cleanup from renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app-will-quit");
  }
  
  // ✅ Await cleanup BEFORE hiding window
  await cleanupPromise;
  cleanupCompleted = true;
  
  // ✅ SONRA exit splash göster ve mainWindow gizle
  const exitSplash = createExitSplashWindow();
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  
  // Close exit splash and quit (animation delay)
  setTimeout(() => {
    if (exitSplash && !exitSplash.isDestroyed()) {
      exitSplash.destroy();
    }
    app.exit(0);
  }, 2500); // 3.5s → 2.5s (cleanup zaten bitti)
});

app.on("will-quit", () => {
   try { require("uiohook-napi").uIOhook.stop(); } catch(e) {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ============================================
// ✅ APP RELOAD HANDLER
// ============================================
ipcMain.on("reload-app", () => {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    log.info("App reload requested from renderer.");
    mainWindow.reload();
  }
});
