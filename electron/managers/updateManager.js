const { Notification, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindowGetter = null;
let updateStatus = 'idle';
let updateInfo = null;

function setupUpdateManager(getMainWindow) {
    mainWindowGetter = getMainWindow;

    autoUpdater.on("checking-for-update", () => {
        updateStatus = 'checking';
        sendToRenderer("update-status", "checking");
    });

    autoUpdater.on("update-available", (info) => {
        log.info("Update available:", info.version);
        updateStatus = 'available';
        updateInfo = info;
        sendToRenderer("update-status", "available", info);
        
        // Background download is usually automatic, but we can be explicit
        // autoUpdater.downloadUpdate();
    });

    autoUpdater.on("update-not-available", () => {
        updateStatus = 'not-available';
        sendToRenderer("update-status", "not-available");
    });

    autoUpdater.on("error", (err) => {
        log.error("Update error:", err);
        updateStatus = 'error';
        sendToRenderer("update-status", "error", err.toString());
    });

    autoUpdater.on("download-progress", (p) => {
        updateStatus = 'downloading';
        sendToRenderer("update-progress", p.percent);
    });

    autoUpdater.on("update-downloaded", (info) => {
        log.info("Update downloaded:", info.version);
        updateStatus = 'downloaded';
        updateInfo = info;
        sendToRenderer("update-status", "downloaded", info);
        
        // Desktop notification for completed download
        if (Notification.isSupported()) {
            const n = new Notification({ 
                title: "Netrex Güncellemesi Hazır", 
                body: `Sürüm ${info.version} yüklendi. Yeniden başlatmak için tıklayın.`,
                silent: false
            });
            n.on("click", () => {
                const mw = mainWindowGetter();
                if (mw) {
                    mw.show();
                    mw.focus();
                }
            });
            n.show();
        }
    });
}

function sendToRenderer(channel, ...args) {
    const mw = mainWindowGetter ? mainWindowGetter() : null;
    if (mw && !mw.isDestroyed()) {
        mw.webContents.send(channel, ...args);
    }
}

function checkForUpdates() {
    if (app.isPackaged) {
        autoUpdater.checkForUpdates().catch(e => log.error("Check for updates failed:", e));
    }
}

function quitAndInstall() {
    log.info("Quitting and installing update...");
    // We should tell the renderer we're about to restart so it can show a splash
    sendToRenderer("update-restarting");
    
    if (!app.isPackaged) {
        log.info("Simulating update restart in development mode...");
        setTimeout(() => {
            sendToRenderer("update-restart-failed", "Geliştirme modunda gerçek güncellenme yapılamaz. Simülasyon tamamlandı.");
        }, 4000);
        return;
    }

    // Give it a tiny moment to show the splash before killing process
    setTimeout(() => {
        try {
            autoUpdater.quitAndInstall();
        } catch (err) {
            log.error("Installation failed:", err);
            sendToRenderer("update-restart-failed", err.message || "Kurulum başlatılamadı.");
        }
    }, 1500);
}

module.exports = {
    setupUpdateManager,
    checkForUpdates,
    quitAndInstall,
    getUpdateStatus: () => updateStatus,
    getUpdateInfo: () => updateInfo
};
