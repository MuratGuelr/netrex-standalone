const { ipcMain, desktopCapturer, shell, autoUpdater, app } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { AccessToken } = require("livekit-server-sdk");
const log = require('electron-log');

// Local imports
const { getLoginHtml, getSuccessHtml } = require('./utils');
const http = require('http');
const url = require('url');
const fs = require('fs');

const store = new Store();
let authServer = null;
let isRecordingMode = false;
let currentUserUid = null;

// Helper to check admin status
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
function isAdminUser(userUid) {
    return ADMIN_UID && userUid && userUid === ADMIN_UID;
}

// Global Hotkey Cache
let hotkeysCache = {
  mute: store.get("hotkeys.mute") || null,
  deafen: store.get("hotkeys.deafen") || null,
  camera: store.get("hotkeys.camera") || null,
};

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

// Local Auth Server Logic
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
        res.end(getLoginHtml(apiKey, authDomain));
      } else if (parsedUrl.pathname === "/logo.png") {
        const logoPath = app.isPackaged
          ? path.join(process.resourcesPath, "logo.png")
          : path.join(__dirname, "../../public/logo.png");
        
        if (fs.existsSync(logoPath)) {
          res.writeHead(200, { "Content-Type": "image/png" });
          const logoData = fs.readFileSync(logoPath);
          res.end(logoData);
        } else {
          res.writeHead(404);
          res.end("Logo not found");
        }
      } else if (parsedUrl.pathname === "/oauth/callback") {
        const token = parsedUrl.query.token;
        if (token && mainWindow)
          mainWindow.webContents.send("oauth-success", token);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getSuccessHtml());
      } else {
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

function registerIpcHandlers(mainWindowFn, showMainWindowFn, inputManager) {
  
  // Auth
  ipcMain.handle("start-oauth", async () => {
    try {
      const mainWindow = mainWindowFn();
      const s = await startLocalAuthServer(mainWindow);
      await shell.openExternal(`http://127.0.0.1:${s.address().port}/login`);
    } catch (e) {
      console.error(e);
    }
  });

  // Utils
  ipcMain.handle("open-external-link", async (e, u) => {
    if (u.startsWith("http")) await shell.openExternal(u);
  });

  // Hotkeys
  ipcMain.handle("update-hotkey", (e, a, k) => {
    try {
      if (k === null || k === undefined) {
        store.delete(`hotkeys.${a}`);
        updateHotkeyCache(a, null);
        return { success: true };
      }
      setKeybinding(a, k);
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

  // LiveKit Token
  ipcMain.handle("get-livekit-token", async (e, room, identity, displayName, serverIndex = 0) => {
    const name = displayName || identity;
    let apiKey = process.env[`LIVEKIT_SERVERS_${serverIndex}_KEY`] || process.env.LIVEKIT_API_KEY;
    let apiSecret = process.env[`LIVEKIT_SERVERS_${serverIndex}_SECRET`] || process.env.LIVEKIT_API_SECRET;
    
    if (!apiKey || !apiSecret) {
        console.warn(`⚠️ LiveKit server ${serverIndex} credentials not found, using default`);
        apiKey = process.env.LIVEKIT_API_KEY;
        apiSecret = process.env.LIVEKIT_API_SECRET;
    }
    
    const at = new AccessToken(apiKey, apiSecret, { 
        identity: identity,
        name: name,
        ttl: '24h',
    });
    
    at.addGrant({
        roomJoin: true,
        room: room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
    });
    
    return await at.toJwt();
  });

  ipcMain.handle("get-livekit-server-info", async (e, serverIndex = 0) => {
    let serverCount = 0;
    for (let i = 0; i < 20; i++) {
        if (process.env[`LIVEKIT_SERVERS_${i}_URL`]) serverCount++;
        else break;
    }
    
    if (serverCount === 0) {
        return {
          url: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
          serverCount: 1,
          serverIndex: 0,
          poolMode: false,
        };
    }
    
    const actualIndex = Math.min(serverIndex, serverCount - 1);
    const url = process.env[`LIVEKIT_SERVERS_${actualIndex}_URL`] || process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
    
    return {
        url,
        serverCount,
        serverIndex: actualIndex,
        poolMode: true,
    };
  });

  // Auto Updater
  ipcMain.handle("quit-and-install", () => autoUpdater.quitAndInstall());

  ipcMain.handle("splash-complete", () => {
    showMainWindowFn();
  });

  // Screen Share
  ipcMain.handle("get-desktop-sources", async () => {
    const s = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 400, height: 400 },
    });
    return s.map((src) => ({
        id: src.id,
        name: src.name,
        thumbnail: src.thumbnail.toDataURL(),
        appIcon: src.appIcon?.toDataURL(),
    }));
  });

  // Settings
  ipcMain.handle("set-setting", (e, k, v) => { store.set(`settings.${k}`, v); return true; });
  ipcMain.handle("get-setting", (e, k) => store.get(`settings.${k}`));

  // App Path
  ipcMain.handle("get-app-path", () => app.getAppPath());
  ipcMain.handle("get-resources-path", () => app.isPackaged ? process.resourcesPath : path.join(__dirname, "../../"));

  ipcMain.handle("focus-window", () => {
     const mw = mainWindowFn();
     if (mw) {
         if (mw.isMinimized()) mw.restore();
         mw.show();
         mw.focus();
     }
  });

  ipcMain.handle("cleanup-complete", () => {});

  // DevTools / Admin
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
  
  // --- INPUT LISTENER HANDLERS ---
  // Added these back to fix "No handler registered" errors
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

// Export getters for Input Manager to use
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
