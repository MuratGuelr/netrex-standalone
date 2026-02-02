const { app, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// MANAGERS
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

const { 
    registerIpcHandlers, 
    getHotkeysCache, 
    getIsRecordingMode, 
    getIsAdminUser,
    getCurrentUserUid
} = require("./managers/ipcHandlers");

const { setupInputListeners } = require("./managers/inputManager");
const { setupUpdateManager, checkForUpdates, quitAndInstall: updateQuitAndInstall } = require("./managers/updateManager");

// --- LOGLAMA AYARLARI ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

// Ortam Değişkenleri
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
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath, override: false });
    console.log("✅ .env.local yüklendi:", envPath);
    break;
  }
}
require("dotenv").config({ override: false });

// SSL Bypass
const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
if (livekitUrl) {
  const httpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const insecureUrl = livekitUrl.replace('wss://', 'http://').replace('ws://', 'http://');
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', `${httpUrl},${insecureUrl}`);
}
app.commandLine.appendSwitch('ignore-certificate-errors');

// 🚀 v5.3 CPU & SES OPTİMİZASYONU:
app.commandLine.appendSwitch('disable-renderer-backgrounding'); // Arka planda CPU kullanımını engelleme
app.commandLine.appendSwitch('disable-background-timer-throttling'); // Timer throttling'i kapat (ses için gerekli)
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows'); // Gizli pencere throttle'ı kapat
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,WebRTC-Audio-Priority,WebRTC-H264-With-OpenH264-FFmpeg'); // Audio priority aktif
app.commandLine.appendSwitch('audio-renderer-threads', '2'); // Ses render'ı için ek thread
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-Audio-Priority/Enabled/');

// GPU Optimizasyonları
if (app.isPackaged) {
  app.commandLine.appendSwitch('enable-gpu-rasterization'); // GPU rasterization (CPU yükünü GPU'ya aktar)
  app.commandLine.appendSwitch('enable-zero-copy'); // Zero-copy GPU memory
}

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  const { getAlreadyRunningHtml } = require('./managers/utils');
  app.whenReady().then(() => {
    // Show warning
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
  
  // --- APP READY ---
  app.on("ready", async () => {
    // Platform Specifics
    if (process.platform === "win32") {
        app.setAppUserModelId("Netrex Client");
        // 🚀 v5.3: Set process priority to 'Above Normal' safely
        try {
            const os = require('os');
            // process.pid is correct, but the function is in 'os' module
            os.setPriority(process.pid, -5); // Windows 'Above Normal'
            console.log("✅ Process priority set to Above Normal");
        } catch (e) {
            console.warn("Could not set process priority:", e);
        }
    }
    if (process.platform === "darwin") {
      const { systemPreferences } = require('electron');
      systemPreferences.askForMediaAccess("microphone");
      systemPreferences.askForMediaAccess("camera");
    }

    // Input Listeners
    // Setup INPUT LISTENER FIRST, so we can pass it to IPC handlers
    const inputManager = setupInputListeners(getMainWindow, getHotkeysCache, getIsRecordingMode);

    // Initialize Managers
    // PASS inputManager to registerIpcHandlers
    // Initialize Managers
    // PASS inputManager and setQuitting to registerIpcHandlers
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

  // --- AUTO UPDATER EVENTS MOVED TO UpdateManager.js ---
}

// --- GRACEFUL EXIT HANDLING ---
let isExitInProgress = false;
let cleanupCompleted = false;

app.on("before-quit", async (event) => {
  // If cleanup already done or splash already shown, let it quit
  if (cleanupCompleted) return;
  
  // Prevent immediate quit
  event.preventDefault();
  
  // Prevent multiple exit attempts
  if (isExitInProgress) return;
  isExitInProgress = true;
  
  const mainWindow = getMainWindow();
  
  // Show exit splash
  const { ipcMain } = require('electron');
  const exitSplash = createExitSplashWindow();
  
  // Hide main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  
  // Setup cleanup completion listener
  const cleanupListener = () => {
    log.info("✅ Cleanup completed signal received");
    cleanupCompleted = true;
  };
  ipcMain.once("cleanup-complete", cleanupListener);
  
  // Request cleanup from renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app-will-quit");
  }
  
  // Wait for cleanup with timeout (max 5 seconds)
  const startTime = Date.now();
  const maxWait = 5000;
  
  const checkAndQuit = () => {
    if (cleanupCompleted || Date.now() - startTime > maxWait) {
      // Cleanup done or timeout
      ipcMain.removeListener("cleanup-complete", cleanupListener);
      cleanupCompleted = true;
      
      // Close exit splash and quit (longer delay to show the animation)
      setTimeout(() => {
        if (exitSplash && !exitSplash.isDestroyed()) {
          exitSplash.close();
        }
        app.exit(0);
      }, 3500); // 3.5 second delay to allow drawing animation to finish
    } else {
      setTimeout(checkAndQuit, 100);
    }
  };
  
  checkAndQuit();
});

app.on("will-quit", () => {
   const { uIOhook } = require("uiohook-napi");
   uIOhook.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
