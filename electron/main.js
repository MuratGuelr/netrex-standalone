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
    if (process.platform === "win32") app.setAppUserModelId("Netrex Client");
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
    registerIpcHandlers(getMainWindow, showMainWindow, inputManager);
    
    // Create Splash
    const splash = createSplashWindow(); 
    
    // Create Main Window
    const mainWindow = createWindow(getIsAdminUser, getCurrentUserUid);
    
    // Tray
    createTray(mainWindow, () => {
        setQuitting(true);
        app.quit();
    });

    // Update Check
    if (app.isPackaged) {
       autoUpdater.checkForUpdates().catch(e => log.error(e));
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

  // --- AUTO UPDATER EVENTS ---
  autoUpdater.on("checking-for-update", () => getMainWindow()?.webContents.send("update-status", "checking"));
  autoUpdater.on("update-available", (info) => {
    getMainWindow()?.webContents.send("update-status", "available", info);
    if (Notification.isSupported() && getMainWindow()) {
        new Notification({ title: "Netrex Güncellemesi Mevcut", body: `Yeni sürüm ${info.version}`, icon: require('./managers/windowManager').getIconPath }).show();
    }
    autoUpdater.downloadUpdate();
  });
  autoUpdater.on("update-not-available", () => getMainWindow()?.webContents.send("update-status", "not-available"));
  autoUpdater.on("error", (err) => getMainWindow()?.webContents.send("update-status", "error", err.toString()));
  autoUpdater.on("download-progress", (p) => getMainWindow()?.webContents.send("update-progress", p.percent));
  autoUpdater.on("update-downloaded", (info) => {
    getMainWindow()?.webContents.send("update-status", "downloaded", info);
    if (Notification.isSupported() && getMainWindow()) {
        const n = new Notification({ title: "Netrex Güncellemesi Hazır", body: "Yeniden başlatmak için tıklayın." });
        n.on("click", () => showMainWindow());
        n.show();
    }
  });
}

app.on("before-quit", () => {});

app.on("will-quit", () => {
   const { uIOhook } = require("uiohook-napi");
   uIOhook.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
