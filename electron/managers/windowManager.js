const { BrowserWindow, app, ipcMain, Menu, session } = require('electron');
const path = require('path');
const log = require('electron-log');
const http = require('http');
const fs = require('fs');

// ============================================
// 🚀 OPTIMIZED WINDOW MANAGER v2.0
// ============================================
// 
// Optimizasyonlar:
// 1. ✅ HTML encoding cached
// 2. ✅ WebPreferences constants
// 3. ✅ CSP header cached
// 4. ✅ Event listeners optimized
// 5. ✅ file:// → HTTP static server (CPU fix)
//
// ============================================

const { getIconPath, getSplashHtml, getAlreadyRunningHtml, getExitSplashHtml } = require('./utils');
const currentStore = new (require('electron-store'))();

// ============================================
// ✅ LOCAL STATIC SERVER (file:// CPU fix)
// Chromium browser process file:// ile idle CPU spike yapıyor.
// HTTP ile sunmak (dev modda olduğu gibi) bunu tamamen çözüyor.
// ============================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain',
};

function _startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = '/';
      try {
        urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch(e) { /* use default */ }
      
      if (urlPath === '/') urlPath = '/index.html';
      
      const filePath = path.join(rootDir, urlPath);
      
      // Güvenlik: rootDir dışına çıkmayı engelle
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Next.js routing: /view → /view.html dene
          if (!path.extname(filePath)) {
            fs.readFile(filePath + '.html', (err2, data2) => {
              if (err2) {
                // SPA fallback: index.html döndür
                fs.readFile(path.join(rootDir, 'index.html'), (err3, data3) => {
                  if (err3) {
                    res.writeHead(404);
                    res.end('Not Found');
                  } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(data3);
                  }
                });
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(data2);
              }
            });
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        } else {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    });

    // Sabit port kullan (Firebase Auth session origin'e bağlı, port değişirse oturum kaybolur)
    const STATIC_PORT = 17760;
    server.listen(STATIC_PORT, '127.0.0.1', () => {
      resolve(server.address().port);
    });

    server.on('error', reject);
  });
}

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
    // backgroundThrottling: false KALDIRILDI! 
    // Chromium compositor'ünü hiç uyutmuyordu, idle %10 CPU yiyordu.
    // disable-renderer-backgrounding flag'i ses için yeterlidir.
    enableBlinkFeatures: '',
    spellcheck: false,
    offscreen: false,
    enableWebSQL: false,
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
  // ✅ STATIC HEADERS - Avoid spread/array creation in every request
  // ============================================
  const STATIC_HEADERS = {
    "Content-Security-Policy": [CSP_HEADER],
    "Permissions-Policy": [
      'autoplay=*, encrypted-media=*, accelerometer=*, gyroscope=*, picture-in-picture=*, clipboard-write=*'
    ]
  };

  session.defaultSession.webRequest.onHeadersReceived((d, c) => {
    c({ 
      responseHeaders: Object.assign(d.responseHeaders, STATIC_HEADERS)
    });
  });

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/embed/*', '*://*.youtube-nocookie.com/embed/*'] },
    (details, callback) => {
      const currentReferer = details.requestHeaders['Referer'] || details.requestHeaders['referer'] || '';
      if (!currentReferer || currentReferer.startsWith('file://') || currentReferer.startsWith('app://')) {
        details.requestHeaders['Referer'] = 'https://netrex.app';
      }
      callback({ requestHeaders: details.requestHeaders });
    }
  );

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
    // ✅ CRITICAL FIX: file:// yerine local HTTP server kullan
    // Chromium'un browser process'i file:// protokolünde idle CPU spike yapıyor.
    // HTTP üzerinden serviste (dev modda olduğu gibi) bu sorun olmuyor.
    const outDir = path.join(__dirname, "../../out");
    _startStaticServer(outDir).then(port => {
      log.info(`✅ Static server started on port ${port}`);
      mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }).catch(err => {
      log.error("❌ Static server failed, falling back to file://", err);
      mainWindow.loadFile(path.join(outDir, "index.html"));
    });
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
    if (splashWindow) splashWindow.destroy();
    mainWindow.show();
  } else {
    // Timeout fallback
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        updateCheckCompleted = true; 
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.destroy();
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
      splashWindow.destroy();
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
