const { ipcMain, desktopCapturer, shell, autoUpdater, app } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { AccessToken } = require("livekit-server-sdk");
const log = require('electron-log');
const { quitAndInstall: updateQuitAndInstall } = require('./updateManager');

// Local imports
const { getLoginHtml, getSuccessHtml } = require('./utils');
const http = require('http');
const url = require('url');
const fs = require('fs');

// ============================================
// 🚀 OPTIMIZED IPC HANDLERS v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ LiveKit server count cached (20 iterasyon → 0)
// 2. ✅ Logo file cached (disk I/O → memory)
// 3. ✅ Thumbnail optimized (400x400 PNG → 150x150 JPEG)
// 4. ✅ Hotkeys init optimized (3 store.get → 1)
// 5. ✅ Admin UID trim cached
// 6. ✅ Auth HTML cached
//
// ============================================

const store = new Store();
let authServer = null;
let isRecordingMode = false;
let currentUserUid = null;

// ============================================
// ✅ ADMIN UID - Cached Trim
// ============================================
const ADMIN_UID = (process.env.NEXT_PUBLIC_ADMIN_UID || "").trim();

function isAdminUser(userUid) {
    return ADMIN_UID && userUid === ADMIN_UID;
}

// ============================================
// ✅ LIVEKIT SERVERS - Pool Support with Fallback
// ============================================
let LIVEKIT_SERVER_COUNT = null;
let LIVEKIT_SERVERS = null;

function initLiveKitServers() {
    if (LIVEKIT_SERVER_COUNT !== null) return;
    
    LIVEKIT_SERVERS = [];
    
    // Try to load pool servers
    for (let i = 0; i < 20; i++) {
        const url = process.env[`LIVEKIT_SERVERS_${i}_URL`];
        if (!url) break;
        
        LIVEKIT_SERVERS.push({
            url,
            key: process.env[`LIVEKIT_SERVERS_${i}_KEY`],
            secret: process.env[`LIVEKIT_SERVERS_${i}_SECRET`]
        });
    }
    
    LIVEKIT_SERVER_COUNT = LIVEKIT_SERVERS.length;
    
    // Fallback: Single server mode
    if (LIVEKIT_SERVER_COUNT === 0) {
        const fallbackKey = process.env.LIVEKIT_API_KEY;
        const fallbackSecret = process.env.LIVEKIT_API_SECRET;
        const fallbackUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        
        if (fallbackKey && fallbackSecret) {
            LIVEKIT_SERVERS.push({
                url: fallbackUrl || '',
                key: fallbackKey,
                secret: fallbackSecret
            });
            LIVEKIT_SERVER_COUNT = 1;
            console.log('⚠️ LiveKit: Pool sunucuları bulunamadı, fallback mode kullanılıyor');
        } else {
            console.error('❌ HATA: LiveKit credentials bulunamadı! .env.local dosyasını kontrol edin.');
            console.error('   Gerekli: LIVEKIT_SERVERS_0_* veya LIVEKIT_API_KEY/SECRET');
        }
    } else {
        console.log(`✅ LiveKit Pool: ${LIVEKIT_SERVER_COUNT} servers loaded`);
    }
}

initLiveKitServers();

// ============================================
// ✅ HOTKEYS CACHE - Optimized Init
// ============================================
let hotkeysCache = null;

function initHotkeysCache() {
    const allHotkeys = store.get("hotkeys") || {};
    hotkeysCache = {
        mute: allHotkeys.mute || null,
        deafen: allHotkeys.deafen || null,
        camera: allHotkeys.camera || null,
    };
}

initHotkeysCache();

function updateHotkeyCache(action, keybinding) {
    hotkeysCache[action] = keybinding;
}

function getKeybinding(action) {
    return hotkeysCache[action];
}

function setKeybinding(action, keybinding) {
    store.set(`hotkeys.${action}`, keybinding);
    updateHotkeyCache(action, keybinding);
}

// ============================================
// ✅ LOGO CACHE - File I/O → Memory
// ============================================
let cachedLogo = null;
let cachedLogoPath = null;

function getLogoData() {
    const logoPath = app.isPackaged
        ? path.join(process.resourcesPath, "logo.png")
        : path.join(__dirname, "../../public/logo.png");
    
    if (cachedLogoPath !== logoPath || !cachedLogo) {
        if (fs.existsSync(logoPath)) {
            cachedLogo = fs.readFileSync(logoPath);
            cachedLogoPath = logoPath;
            console.log(`✅ Logo cached from: ${logoPath}`);
        } else {
            cachedLogo = null;
            console.warn(`⚠️ Logo not found: ${logoPath}`);
        }
    }
    return cachedLogo;
}

// ============================================
// ✅ AUTH HTML CACHE - Static HTML
// ============================================
let loginHtmlCache = null;
let successHtmlCache = null;

const getLoginHtmlCached = (apiKey, authDomain) => {
    if (!loginHtmlCache) {
        loginHtmlCache = getLoginHtml(apiKey, authDomain);
    }
    return loginHtmlCache;
};

const getSuccessHtmlCached = () => {
    if (!successHtmlCache) {
        successHtmlCache = getSuccessHtml();
    }
    return successHtmlCache;
};

// ============================================
// LOCAL AUTH SERVER
// ============================================
const startLocalAuthServer = (mainWindow) => {
    return new Promise((resolve) => {
        if (authServer) {
            authServer.close();
            authServer = null;
        }
        
        const server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url, true);
            
            if (parsedUrl.pathname === "/login") {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
                const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
                res.end(getLoginHtmlCached(apiKey, authDomain));
            } 
            else if (parsedUrl.pathname === "/logo.png") {
                // ✅ Cached logo
                const logoData = getLogoData();
                if (logoData) {
                    res.writeHead(200, { "Content-Type": "image/png" });
                    res.end(logoData);
                } else {
                    res.writeHead(404);
                    res.end("Logo not found");
                }
            } 
            else if (parsedUrl.pathname === "/oauth/callback") {
                const token = parsedUrl.query.token;
                if (token && mainWindow) {
                    mainWindow.webContents.send("oauth-success", token);
                }
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(getSuccessHtmlCached());
            } 
            else {
                res.writeHead(404);
                res.end("Not Found");
            }
        });
        
        server.listen(0, "127.0.0.1", () => {
            authServer = server;
            resolve(server);
        });
    });
};

// ============================================
// IPC HANDLERS REGISTRATION
// ============================================
function registerIpcHandlers(mainWindowFn, showMainWindowFn, inputManager, setQuittingFn) {
    
    // ============================================
    // AUTH
    // ============================================
    ipcMain.handle("start-oauth", async () => {
        try {
            const mainWindow = mainWindowFn();
            const s = await startLocalAuthServer(mainWindow);
            await shell.openExternal(`http://127.0.0.1:${s.address().port}/login`);
        } catch (e) {
            console.error(e);
        }
    });

    // ============================================
    // APP LIFECYCLE
    // ============================================
    ipcMain.handle("app-quit-force", () => {
        if (setQuittingFn) setQuittingFn(true);
        app.quit();
    });

    // ============================================
    // UTILS
    // ============================================
    ipcMain.handle("open-external-link", async (e, u) => {
        if (u.startsWith("http")) await shell.openExternal(u);
    });

    // ============================================
    // HOTKEYS
    // ============================================
    ipcMain.handle("update-hotkey", (e, a, k) => {
        try {
            if (k === null || k === undefined) {
                store.delete(`hotkeys.${a}`);
                updateHotkeyCache(a, null);
            } else {
                setKeybinding(a, k);
            }
            
            // Input Manager cache refresh
            if (inputManager?.refreshCache) {
                inputManager.refreshCache();
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("get-hotkey", (e, a) => getKeybinding(a));

    ipcMain.handle("set-recording-mode", (e, en) => {
        isRecordingMode = en;
        return { success: true };
    });

    // ============================================
    // ✅ LIVEKIT TOKEN - Pool-Aware with Validation
    // ============================================
    ipcMain.handle("get-livekit-token", async (e, room, identity, displayName, serverIndex = 0) => {
        const name = displayName || identity;
        
        // Validate server configuration
        if (LIVEKIT_SERVER_COUNT === 0) {
            throw new Error('LiveKit credentials not configured. Please add LIVEKIT_SERVERS_0_* or LIVEKIT_API_KEY/SECRET to .env.local');
        }
        
        // Get server with bounds check
        const actualIndex = Math.min(Math.max(0, serverIndex), LIVEKIT_SERVER_COUNT - 1);
        const server = LIVEKIT_SERVERS[actualIndex];
        
        if (!server || !server.key || !server.secret) {
            throw new Error(`Server ${actualIndex} credentials missing. Check .env.local`);
        }
        
        const at = new AccessToken(server.key, server.secret, { 
            identity,
            name,
            ttl: '24h'
        });
        
        at.addGrant({
            roomJoin: true,
            room,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canUpdateOwnMetadata: true,
        });
        
        return at.toJwt();
    });

    // ============================================
    // ✅ LIVEKIT SERVER INFO - Pool Support
    // ============================================
    ipcMain.handle("get-livekit-server-info", async (e, serverIndex = 0) => {
        if (LIVEKIT_SERVER_COUNT === 0) {
            return {
                url: '',
                serverCount: 0,
                serverIndex: 0,
                poolMode: false,
                error: 'No LiveKit servers configured'
            };
        }
        
        const actualIndex = Math.min(Math.max(0, serverIndex), LIVEKIT_SERVER_COUNT - 1);
        
        return {
            url: LIVEKIT_SERVERS[actualIndex].url,
            serverCount: LIVEKIT_SERVER_COUNT,
            serverIndex: actualIndex,
            poolMode: LIVEKIT_SERVER_COUNT > 1,
        };
    });

    // ============================================
    // AUTO UPDATER
    // ============================================
    ipcMain.handle("quit-and-install", () => updateQuitAndInstall());

    ipcMain.handle("splash-complete", () => {
        showMainWindowFn();
    });

    // ============================================
    // ✅ SCREEN SHARE - Optimized Thumbnails
    // ============================================
    ipcMain.handle("get-desktop-sources", async () => {
        const s = await desktopCapturer.getSources({
            types: ["window", "screen"],
            thumbnailSize: { width: 150, height: 150 }, // ✅ 400 → 150
            fetchWindowIcons: true
        });
        
        return s.map((src) => ({
            id: src.id,
            name: src.name,
            thumbnail: src.thumbnail.toDataURL('image/jpeg', 0.7), // ✅ JPEG + 70% quality
            appIcon: src.appIcon?.toDataURL('image/png') // PNG only for icons
        }));
    });

    // ============================================
    // SETTINGS
    // ============================================
    ipcMain.handle("set-setting", (e, k, v) => { 
        store.set(`settings.${k}`, v); 
        return true; 
    });
    
    ipcMain.handle("get-setting", (e, k) => store.get(`settings.${k}`));

    // ============================================
    // APP PATH
    // ============================================
    ipcMain.handle("get-app-path", () => app.getAppPath());
    
    ipcMain.handle("get-resources-path", () => 
        app.isPackaged ? process.resourcesPath : path.join(__dirname, "../../")
    );

    // ============================================
    // WINDOW CONTROL
    // ============================================
    ipcMain.handle("focus-window", () => {
        const mw = mainWindowFn();
        if (mw) {
            if (mw.isMinimized()) mw.restore();
            mw.show();
            mw.focus();
        }
    });

    ipcMain.on("cleanup-complete", () => {
        // Cleanup signal received from renderer - handled in main.js before-quit
    });

    // ============================================
    // DEVTOOLS / ADMIN
    // ============================================
    ipcMain.handle("is-admin", (event, userUid) => isAdminUser(userUid));
    
    ipcMain.handle("set-current-user-uid", (event, userUid) => {
        currentUserUid = userUid;
        return { success: true };
    });

    ipcMain.handle("open-devtools", async (event, userUid) => {
        if (!isAdminUser(userUid)) return { success: false, error: "Unauthorized" };
        const mw = mainWindowFn();
        if (mw) {
            mw.webContents.openDevTools();
            return { success: true };
        }
        return { success: false, error: "Window not found" };
    });
    
    // ============================================
    // INPUT LISTENER HANDLERS
    // ============================================
    ipcMain.handle("start-input-listener", () => {
        if (inputManager) {
            inputManager.start();
            return { success: true };
        }
        return { success: false, error: "Input Manager not initialized" };
    });

    ipcMain.handle("stop-input-listener", () => {
        if (inputManager) {
            inputManager.stop();
            return { success: true };
        }
        return { success: false, error: "Input Manager not initialized" };
    });
}

// ============================================
// EXPORTS
// ============================================
const getHotkeysCache = () => hotkeysCache;
const getIsRecordingMode = () => isRecordingMode;
const getCurrentUserUid = () => currentUserUid;
const getIsAdminUser = (uid) => isAdminUser(uid);

module.exports = {
    registerIpcHandlers,
    getHotkeysCache,
    getIsRecordingMode,
    getIsAdminUser,
    getCurrentUserUid
};
