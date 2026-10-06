const { Notification, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindowGetter = null;
let updateStatus = 'idle';
let updateInfo = null;

/**
 * ✅ OPTIMIZED UpdateManager v2.0
 * 
 * IMPROVEMENTS:
 * - Auto-download when update available
 * - Desktop notifications for all states
 * - Better user feedback
 * - Detailed logging
 */

function setupUpdateManager(getMainWindow) {
    mainWindowGetter = getMainWindow;

    autoUpdater.on("checking-for-update", () => {
        log.info("🔍 Checking for updates...");
        updateStatus = 'checking';
        sendToRenderer("update-status", "checking");
    });

    autoUpdater.on("update-available", (info) => {
        log.info("✅ Update available:", info.version);
        updateStatus = 'available';
        updateInfo = info;
        sendToRenderer("update-status", "available", info);
        
        // ✅ FIX #1: Show desktop notification when update is found
        if (Notification.isSupported()) {
            const n = new Notification({ 
                title: "Yeni Netrex Güncellemesi!", 
                body: `Sürüm ${info.version} bulundu. İndirme başlatılıyor...`,
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
        
        // ✅ FIX #2: Auto-download immediately
        log.info("📥 Starting automatic download...");
        autoUpdater.downloadUpdate();
    });

    autoUpdater.on("update-not-available", () => {
        log.info("ℹ️ No updates available");
        updateStatus = 'not-available';
        sendToRenderer("update-status", "not-available");
    });

    autoUpdater.on("error", (err) => {
        log.error("❌ Update error:", err);
        updateStatus = 'error';
        sendToRenderer("update-status", "error", err.toString());
        
        // ✅ FIX #3: Show error notification
        if (Notification.isSupported()) {
            new Notification({ 
                title: "Güncelleme Hatası", 
                body: "Güncelleme kontrol edilirken bir hata oluştu. Daha sonra tekrar denenecek.",
                silent: false
            }).show();
        }
    });

    autoUpdater.on("download-progress", (p) => {
        updateStatus = 'downloading';
        const percent = Math.round(p.percent);
        log.info(`📥 Download progress: ${percent}% (${p.transferred}/${p.total})`);
        sendToRenderer("update-progress", percent);
        
        // ✅ FIX #4: Show notification at key milestones
        if (percent === 50) {
            log.info("📥 Download 50% complete");
        }
    });

    autoUpdater.on("update-downloaded", (info) => {
        log.info("✅ Update downloaded:", info.version);
        updateStatus = 'downloaded';
        updateInfo = info;
        sendToRenderer("update-status", "downloaded", info);
        
        // Desktop notification for completed download
        if (Notification.isSupported()) {
            const n = new Notification({ 
                title: "Netrex Güncellemesi Hazır!", 
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
        if (updateStatus === 'downloading' || updateStatus === 'downloaded') return; // zaten indiriliyor / hazır
        log.info("🔄 Manually checking for updates...");
        autoUpdater.checkForUpdates().catch(e => log.error("Check for updates failed:", e));
    } else {
        log.info("ℹ️ Skipping update check (not packaged)");
    }
}

function quitAndInstall() {
    log.info("🔄 Quitting and installing update...");
    sendToRenderer("update-restarting");
    
    if (!app.isPackaged) {
        log.info("ℹ️ Simulating update restart in development mode...");
        setTimeout(() => {
            sendToRenderer("update-restart-failed", "Geliştirme modunda gerçek güncellenme yapılamaz. Simülasyon tamamlandı.");
        }, 4000);
        return;
    }

    // Give UI time to show restart splash
    setTimeout(() => {
        try {
            autoUpdater.quitAndInstall(false, true); // Don't wait, force restart
        } catch (err) {
            log.error("❌ Installation failed:", err);
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
