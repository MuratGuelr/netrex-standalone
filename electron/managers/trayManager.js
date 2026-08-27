const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================
// 🚀 OPTIMIZED TRAY MANAGER v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ Icon cache (disk I/O eliminated)
// 2. ✅ Window validation (safety)
// 3. ✅ Code reuse (showWindow helper)
// 4. ✅ Memory leak prevention (destroyTray)
//
// ============================================

let tray = null;
let cachedIcon = null;
let cachedIconPath = null;

const { getIconPath } = require("./utils");

// ============================================
// ✅ ICON CACHE - Disk I/O → Memory
// ============================================
function getOrCreateIcon() {
    const iconPath = getIconPath();

    // ✅ Cache hit - aynı path ve icon varsa kullan
    if (cachedIconPath === iconPath && cachedIcon) {
        return cachedIcon;
    }

    // ✅ Icon yoksa hata
    if (!fs.existsSync(iconPath)) {
        console.error("❌ Tray ikonu bulunamadı:", iconPath);
        return null;
    }

    // ✅ Cache miss - yükle ve cache'le
    cachedIcon = nativeImage.createFromPath(iconPath);
    cachedIconPath = iconPath;
    console.log("✅ Tray icon cached:", iconPath);
    
    return cachedIcon;
}

// ============================================
// CREATE TRAY
// ============================================
function createTray(mainWindow, onQuit) {
    // ✅ Tray zaten varsa return
    if (tray) return tray;

    const icon = getOrCreateIcon();
    if (!icon) return null;

    tray = new Tray(icon);

    // ============================================
    // ✅ WINDOW VALIDATION HELPER - Code Reuse
    // ============================================
    const showWindow = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    };

    // ============================================
    // CONTEXT MENU
    // ============================================
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: "Netrex'i Göster", 
            click: showWindow  // ✅ Helper kullan
        },
        { type: "separator" },
        { 
            label: "Çıkış Yap", 
            click: onQuit 
        }
    ]);

    tray.setToolTip("Netrex");
    tray.setContextMenu(contextMenu);

    // ✅ Double-click da aynı helper'ı kullanır
    tray.on("double-click", showWindow);

    return tray;
}

// ============================================
// ✅ DESTROY TRAY - Memory Leak Prevention
// ============================================
function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
        console.log("✅ Tray destroyed");
    }
    
    // ✅ Icon cache temizleme (isteğe bağlı - app quit'te gereksiz)
    // Ama re-init senaryoları için güvenli
    cachedIcon = null;
    cachedIconPath = null;
}

module.exports = { createTray, destroyTray };
