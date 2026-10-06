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
      
      const resolvedRootDir = path.resolve(rootDir);
      const safeRootDir = resolvedRootDir.endsWith(path.sep) ? resolvedRootDir : resolvedRootDir + path.sep;
      const filePath = path.resolve(resolvedRootDir, '.' + urlPath);
      
      // Güvenlik: rootDir dışına çıkmayı engelle
      if (!filePath.startsWith(safeRootDir)) {
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
let pointerOverlayWindow = null;
let voiceOverlayWindow = null;
let voiceOverlaySettings = null;
let antiCheatCheckInterval = null;
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
    "script-src 'self' 'unsafe-inline' file: data: blob: https: http:",
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
// 🖱️ CREATE POINTER OVERLAY WINDOW
// ============================================
// Overlay HTML'i ayrı dosyada: electron/overlays/pointer-overlay.html
let pointerOverlayReady = false;
let pointerOverlayLastPayload = null;
let pointerOverlayWidgetRect = null;
let pointerOverlayInteractive = false;
let pointerOverlayHoverTimer = null;
let pointerOverlayTopTimer = null;
let pointerOverlayKnownRequests = new Set();

function stopPointerOverlayTimers() {
  if (pointerOverlayHoverTimer) { clearInterval(pointerOverlayHoverTimer); pointerOverlayHoverTimer = null; }
  if (pointerOverlayTopTimer) { clearInterval(pointerOverlayTopTimer); pointerOverlayTopTimer = null; }
}

function createPointerOverlayWindow() {
  if (pointerOverlayWindow && !pointerOverlayWindow.isDestroyed()) {
    return pointerOverlayWindow;
  }

  const { screen } = require('electron');
  // Fare konumu (get-mouse-position) da birincil ekranın TAM sınırlarını kullanır; ikisi aynı olmalı
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  pointerOverlayReady = false;
  pointerOverlayWidgetRect = null;
  pointerOverlayInteractive = false;

  pointerOverlayWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: getIconPath(),
  });

  const win = pointerOverlayWindow;

  // Oyunların / tam ekran uygulamaların üstünde kalsın (ses overlay'i ile aynı seviye)
  try { win.setAlwaysOnTop(true, 'screen-saver'); } catch (e) {}
  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}

  // Başlangıçta click-through
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, '../overlays/pointer-overlay.html'));

  win.webContents.on('did-finish-load', () => {
    pointerOverlayReady = true;
    // Pencere yüklenmeden gelen son veri kaybolmasın
    if (pointerOverlayLastPayload && !win.isDestroyed()) {
      win.webContents.send("update-pointer-overlay-data", pointerOverlayLastPayload);
    }
  });

  // Hover algısı: Windows'ta `focusable:false` pencerede mouseenter/leave (forward) güvenilmez.
  // Bu yüzden imleç widget'ın üstündeyken tıklamayı açıp dışındayken geçirgen yapıyoruz.
  pointerOverlayHoverTimer = setInterval(() => {
    try {
      if (!win || win.isDestroyed() || !win.isVisible() || !pointerOverlayWidgetRect) return;
      const pt = screen.getCursorScreenPoint();
      const b = win.getBounds();
      const lx = pt.x - b.x;
      const ly = pt.y - b.y;
      const r = pointerOverlayWidgetRect;
      const pad = 6;
      const inside =
        r.dragging ||
        (lx >= r.x - pad && lx <= r.x + r.width + pad && ly >= r.y - pad && ly <= r.y + r.height + pad);
      if (inside !== pointerOverlayInteractive) {
        pointerOverlayInteractive = inside;
        win.setIgnoreMouseEvents(!inside, { forward: true });
      }
    } catch (e) {}
  }, 50);

  // Başka pencereler/oyunlar öne geçerse overlay'i tekrar en üste al
  pointerOverlayTopTimer = setInterval(() => {
    try {
      if (!win || win.isDestroyed() || !win.isVisible()) return;
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    } catch (e) {}
  }, 2500);

  win.on('closed', () => {
    stopPointerOverlayTimers();
    pointerOverlayWindow = null;
    pointerOverlayReady = false;
    pointerOverlayWidgetRect = null;
    pointerOverlayInteractive = false;
    pointerOverlayLastPayload = null;
    pointerOverlayKnownRequests = new Set();
  });

  return win;
}

// Yeni gelen izin istekleri için işletim sistemi bildirimi.
// Tarayıcı Notification iznine / uygulamadaki bildirim ayarına bağlı DEĞİLDİR (kullanıcıdan bir karar bekleyen istektir).
function notifyNewPointerRequests(requests) {
  try {
    const { Notification } = require('electron');
    const ids = new Set(requests.map((r) => String(r.id)));
    const fresh = requests.filter((r) => !pointerOverlayKnownRequests.has(String(r.id)));
    pointerOverlayKnownRequests = ids;
    if (fresh.length === 0 || !Notification.isSupported()) return;
    const names = fresh.map((r) => r.name || 'Bir kullanıcı').join(', ');
    new Notification({
      title: 'Netrex - İşaretçi İsteği',
      body: `${names} ekranınızda bir şey göstermek istiyor`,
      silent: true,
    }).show();
  } catch (e) {}
}

function updatePointerOverlay(payload, forceShow = false) {
  // Eski biçim: sadece dizi. Yeni biçim: { pointers, requests }
  const data = Array.isArray(payload)
    ? { pointers: payload, requests: [] }
    : { pointers: payload?.pointers || [], requests: payload?.requests || [] };
  const hasContent = data.pointers.length > 0 || data.requests.length > 0;

  const exists = pointerOverlayWindow && !pointerOverlayWindow.isDestroyed();
  if (!hasContent && !forceShow && !exists) return;

  notifyNewPointerRequests(data.requests);
  pointerOverlayLastPayload = data;

  const win = exists ? pointerOverlayWindow : createPointerOverlayWindow();
  if (!win.isVisible()) win.showInactive();

  // Yükleme bitmediyse did-finish-load son veriyi gönderir
  if (pointerOverlayReady) {
    win.webContents.send("update-pointer-overlay-data", data);
  }
}

// Yayıncının uygulamasından overlay'e tıklama dalgası / çizim olayı iletir
function sendPointerOverlayEvent(evt) {
  if (!pointerOverlayWindow || pointerOverlayWindow.isDestroyed() || !pointerOverlayReady) return;
  pointerOverlayWindow.webContents.send("pointer-overlay-event-data", evt);
}

// Overlay widget'ının ekrandaki konumu (hover algısı için)
function setPointerOverlayWidgetRect(rect) {
  if (!rect || typeof rect !== 'object') return;
  const n = (v) => (Number.isFinite(v) ? v : 0);
  pointerOverlayWidgetRect = {
    x: n(rect.x), y: n(rect.y), width: n(rect.width), height: n(rect.height), dragging: !!rect.dragging,
  };
}

function setPointerOverlayInteractive(interactive) {
  if (pointerOverlayWindow && !pointerOverlayWindow.isDestroyed()) {
    pointerOverlayInteractive = !!interactive;
    pointerOverlayWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  }
}

function closePointerOverlay() {
  if (pointerOverlayWindow && !pointerOverlayWindow.isDestroyed()) {
    pointerOverlayWindow.close();
  }
}

// ============================================
// 💬 KAYAN MESAJ OVERLAY (ticker)
// ============================================
// Mikrofonu kapalı bir izleyicinin yazdığı kısa mesajı, yayıncının ekranında en üstte, kayan yazı olarak gösterir.
// Tıklamayı geçirir (oyunu/uygulamayı engellemez); yalnızca sağ uçtaki küçük ✕ düğmesinin üstündeyken tıklanabilir.
let tickerWindow = null;
let tickerReady = false;
let tickerPending = [];
let tickerButtonRect = null;
let tickerInteractive = false;
let tickerHoverTimer = null;
let tickerTopTimer = null;
let antiCheatCache = { at: 0, detected: false };

// Anti-cheat süreci çalışıyor mu? (ses overlay'i ile aynı koruma; 20 sn önbellek)
function detectAntiCheat() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    if (Date.now() - antiCheatCache.at < 20000) return resolve(antiCheatCache.detected);
    const { exec } = require('child_process');
    exec('tasklist /FO CSV /NH', { timeout: 5000 }, (err, stdout) => {
      const detected = !err && !!stdout && ANTICHEAT_PROCESSES.some((p) => stdout.toLowerCase().includes(p.toLowerCase()));
      antiCheatCache = { at: Date.now(), detected };
      resolve(detected);
    });
  });
}

function stopTickerTimers() {
  if (tickerHoverTimer) { clearInterval(tickerHoverTimer); tickerHoverTimer = null; }
  if (tickerTopTimer) { clearInterval(tickerTopTimer); tickerTopTimer = null; }
}

function createTickerWindow() {
  if (tickerWindow && !tickerWindow.isDestroyed()) return tickerWindow;

  const { screen } = require('electron');
  const b = screen.getPrimaryDisplay().bounds;
  const height = 76;
  const y = b.y + Math.round(b.height * 0.06); // üst kenara yakın, başlık çubuklarının hemen altı

  tickerReady = false;
  tickerButtonRect = null;
  tickerInteractive = false;

  tickerWindow = new BrowserWindow({
    x: b.x,
    y,
    width: b.width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: getIconPath(),
  });

  const win = tickerWindow;
  try { win.setAlwaysOnTop(true, 'screen-saver'); } catch (e) {}
  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, '../overlays/ticker-overlay.html'));

  win.webContents.on('did-finish-load', () => {
    tickerReady = true;
    const queued = tickerPending;
    tickerPending = [];
    queued.forEach((m) => { if (!win.isDestroyed()) win.webContents.send('ticker-message-data', m); });
  });

  // Yalnızca ✕ düğmesinin üstündeyken tıklanabilir (hover algısı ana süreçte)
  tickerHoverTimer = setInterval(() => {
    try {
      if (!win || win.isDestroyed() || !win.isVisible() || !tickerButtonRect || !tickerButtonRect.width) return;
      const pt = screen.getCursorScreenPoint();
      const wb = win.getBounds();
      const lx = pt.x - wb.x;
      const ly = pt.y - wb.y;
      const r = tickerButtonRect;
      const pad = 6;
      const inside = lx >= r.x - pad && lx <= r.x + r.width + pad && ly >= r.y - pad && ly <= r.y + r.height + pad;
      if (inside !== tickerInteractive) {
        tickerInteractive = inside;
        win.setIgnoreMouseEvents(!inside, { forward: true });
      }
    } catch (e) {}
  }, 50);

  // Başka pencereler öne geçerse tekrar en üste al
  tickerTopTimer = setInterval(() => {
    try {
      if (!win || win.isDestroyed() || !win.isVisible()) return;
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    } catch (e) {}
  }, 2500);

  win.on('closed', () => {
    stopTickerTimers();
    tickerWindow = null;
    tickerReady = false;
    tickerPending = [];
    tickerButtonRect = null;
    tickerInteractive = false;
  });

  return win;
}

/**
 * Kayan mesajı gösterir. { shown: boolean, reason? } döner; shown=false ise çağıran (arayüz) kendi
 * uygulama içi bildirimine düşer.
 */
async function showTickerMessage(msg, { checkAntiCheat = true } = {}) {
  const text = String(msg?.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) return { shown: false, reason: 'empty' };

  if (checkAntiCheat && (await detectAntiCheat())) {
    return { shown: false, reason: 'anticheat' };
  }

  const opacity = Math.max(0.3, Math.min(1, Number(msg?.opacity) || 0.8));
  const payload = { text, name: String(msg?.name ?? '').slice(0, 40), opacity };

  const win = tickerWindow && !tickerWindow.isDestroyed() ? tickerWindow : createTickerWindow();
  if (!win.isVisible()) win.showInactive();

  if (tickerReady) win.webContents.send('ticker-message-data', payload);
  else tickerPending.push(payload);
  return { shown: true };
}

// Sıra bitti: pencereyi gizle (yok etme; sonraki mesaj hızlı açılsın)
function hideTicker() {
  if (tickerWindow && !tickerWindow.isDestroyed() && tickerWindow.isVisible()) tickerWindow.hide();
}

// Kullanıcı ✕ ile kapattı: tüm sırayı temizle ve gizle
function closeTicker() {
  tickerPending = [];
  if (tickerWindow && !tickerWindow.isDestroyed()) {
    tickerWindow.webContents.send('ticker-clear');
    tickerWindow.hide();
  }
}

function setTickerButtonRect(rect) {
  if (!rect || typeof rect !== 'object') return;
  const n = (v) => (Number.isFinite(v) ? v : 0);
  tickerButtonRect = { x: n(rect.x), y: n(rect.y), width: n(rect.width), height: n(rect.height) };
}

// ============================================
// 🎮 VOICE OVERLAY WINDOW — Discord Style
// ============================================
const ANTICHEAT_PROCESSES = ['vgc.exe', 'BEService.exe', 'EasyAntiCheat.exe', 'EasyAntiCheat_EOS.exe', 'mhyprot2.sys'];

function createVoiceOverlayWindow(settings) {
  if (voiceOverlayWindow && !voiceOverlayWindow.isDestroyed()) {
    return voiceOverlayWindow;
  }

  voiceOverlaySettings = settings || {};

  const { screen: electronScreen } = require('electron');
  const primaryDisplay = electronScreen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.bounds;

  const W = 350;
  const H = 600;

  const posPresets = {
    'top-right':    { x: screenW - W - 12, y: 28 },
    'top-left':     { x: 12, y: 28 },
    'bottom-right': { x: screenW - W - 12, y: screenH - H - 48 },
    'bottom-left':  { x: 12, y: screenH - H - 48 },
  };
  const posKey = settings?.position || 'top-right';
  let startPos;
  if (posKey === 'custom' && settings?.customPosition) {
    startPos = { x: settings.customPosition.x, y: settings.customPosition.y };
  } else {
    startPos = posPresets[posKey] || posPresets['top-right'];
  }

  voiceOverlayWindow = new BrowserWindow({
    width: W,
    height: H,
    maxWidth: W,
    maxHeight: H,
    minWidth: W,
    minHeight: H,
    x: startPos.x,
    y: startPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: getIconPath(),
  });

  voiceOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
  voiceOverlayWindow.setIgnoreMouseEvents(true, { forward: true });

  const controlMute = settings?.controlMute ?? true;
  const controlLeave = settings?.controlLeave ?? true;

  const overlayHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    overflow: hidden;
    background: transparent;
    font-family: 'Segoe UI', system-ui, sans-serif;
    user-select: none;
  }

  #root {
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ═══ USER ROW ═══ */
  .ur {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 12px 3px 3px;
    height: 34px;
    border-radius: 17px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    width: max-content;
    max-width: 100%;
  }

  /* Avatar container */
  .ac {
    position: relative;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .ac img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
  }
  .ac .fl {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
  }

  /* Speaking green ring — Discord style */
  .ac::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    pointer-events: none;
  }
  .ur.spk .ac::after {
    border-color: #23a559;
    box-shadow: 0 0 8px rgba(35, 165, 89, 0.4);
  }

  /* Name */
  .nm {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5);
  }
  .ur.spk .nm {
    color: #fff;
  }
  .ur:not(.spk) .nm {
    color: rgba(255, 255, 255, 0.55);
  }

  /* Status icons (mute/deafen) */
  .si {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
  }

  /* Overflow text */
  .ov {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
    text-align: center;
    padding: 2px 0;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }

  /* Controls bar */
  #cb {
    display: none;
    gap: 4px;
    padding: 4px 0 2px;
    pointer-events: auto;
  }
  .btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.12s ease;
    background: rgba(0,0,0,0.5);
    color: rgba(255,255,255,0.7);
    backdrop-filter: blur(4px);
  }
  .btn:hover {
    transform: scale(1.15);
    background: rgba(0,0,0,0.7);
    color: #fff;
  }
  .btn.on {
    background: rgba(239,68,68,0.7);
    color: #fff;
  }
  .btn.lv {
    background: rgba(239,68,68,0.5);
    color: #fff;
  }
  .btn.lv:hover {
    background: rgba(239,68,68,0.9);
  }

  svg { display: block; }
</style>
</head>
<body>
<div id="root"></div>
<div id="cb">
  ${controlMute ? '<button class="btn" id="bm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg></button>' : ''}
  ${settings?.controlDeafen ? '<button class="btn" id="bd"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-4h3v2zM3 19a2 2 0 0 0 2 2h1v-4H3v2z"/></svg></button>' : ''}
  ${controlLeave ? '<button class="btn lv" id="bl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg></button>' : ''}
</div>

<script>
  const $r = document.getElementById('root');
  const $cb = document.getElementById('cb');
  const $bm = document.getElementById('bm');
  const $bd = document.getElementById('bd');
  const $bl = document.getElementById('bl');

  const MIC_OFF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ed4245" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  const DEAF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ed4245" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const MIC_ON_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  const MIC_OFF_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  const DEAF_ON_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-4h3v2zM3 19a2 2 0 0 0 2 2h1v-4H3v2z"/></svg>';
  const DEAF_OFF_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-4h3v2zM3 19a2 2 0 0 0 2 2h1v-4H3v2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  // Interactive toggle on hover
  const interactIn = () => { if (window.netrex?.setVoiceOverlayInteractive) window.netrex.setVoiceOverlayInteractive(true); };
  const interactOut = () => { if (window.netrex?.setVoiceOverlayInteractive) window.netrex.setVoiceOverlayInteractive(false); };
  
  $r.addEventListener('mouseenter', interactIn);
  $r.addEventListener('mouseleave', interactOut);
  $cb.addEventListener('mouseenter', interactIn);
  $cb.addEventListener('mouseleave', interactOut);

  // Controls
  if ($bm) $bm.addEventListener('click', () => window.netrex?.voiceOverlayAction?.('toggle-mute', {}));
  if ($bd) $bd.addEventListener('click', () => window.netrex?.voiceOverlayAction?.('toggle-deafen', {}));
  if ($bl) $bl.addEventListener('click', () => window.netrex?.voiceOverlayAction?.('leave', {}));

  function ini(n) { return n ? n.trim().charAt(0).toUpperCase() : '?'; }

  function render(d) {
    if (!d) return;
    const pp = d.participants || [];
    const max = d.settings?.maxVisibleUsers || 5;
    const selfOk = d.settings?.showSelf !== false;
    const silOk = d.settings?.showSilentUsers !== false;
    const spkOnly = d.settings?.showOnlySpeaking || false;

    let list = pp.slice();
    if (!selfOk) list = list.filter(p => !p.isLocal);
    if (spkOnly || !silOk) list = list.filter(p => p.isSpeaking || p.isLocal);

    list.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
      return 0;
    });

    const vis = list.slice(0, max);
    const over = list.length - vis.length;

    if (vis.length === 0) {
      $r.innerHTML = '';
      if (d.settings?.visibilityMode === 'always') {
        $cb.style.display = 'flex';
      } else {
        $cb.style.display = 'none';
        return; // strictly stop processing if entirely invisible and not 'always' mode
      }
    } else {
      $cb.style.display = 'flex';
    }

    // Scale
    let scale = 1;
    if (d.settings?.size === 'small') scale = 0.85;
    else if (d.settings?.size === 'large') scale = 1.15;
    document.body.style.zoom = scale;

    // Opacity
    const baseOpacity = d.settings?.opacity ?? 1;
    document.body.style.opacity = baseOpacity;
    document.body.style.transition = 'opacity 0.2s';
    
    if (d.settings?.fullOpacityOnHover) {
      document.body.onmouseenter = () => document.body.style.opacity = '1';
      document.body.onmouseleave = () => document.body.style.opacity = baseOpacity;
    } else {
      document.body.onmouseenter = null;
      document.body.onmouseleave = null;
    }

    // Update mute/deafen button states
    if ($bm && d.localState) {
      const m = d.localState.isMuted;
      $bm.className = 'btn' + (m ? ' on' : '');
      $bm.innerHTML = m ? MIC_OFF_BTN : MIC_ON_BTN;
    }
    if ($bd && d.localState) {
      const df = d.localState.isDeafened;
      $bd.className = 'btn' + (df ? ' on' : '');
      $bd.innerHTML = df ? DEAF_OFF_BTN : DEAF_ON_BTN;
    }

    // DOM Reconciliation for smooth CSS transitions
    const existingMap = new Map();
    Array.from($r.children).forEach(el => {
      if (el.className === 'ov') el.remove();
      else existingMap.set(el.id, el);
    });

    vis.forEach((p) => {
      const spkClass = p.isSpeaking ? 'ur spk' : 'ur';
      const c = p.profileColor || '#5865f2';
      
      let icons = '';
      if (p.isMuted) icons += '<div class="si">' + MIC_OFF + '</div>';
      if (p.isDeafened) icons += '<div class="si">' + DEAF + '</div>';

      let el = existingMap.get('p_' + p.id);
      
      if (!el) {
        // Create new element smoothly
        el = document.createElement('div');
        el.id = 'p_' + p.id;
        el.className = spkClass;
        el.style.opacity = '0';
        el.style.transform = 'translateY(4px)';
        el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        
        const av = p.avatar
          ? '<img src="' + p.avatar + '" referrerpolicy="no-referrer" onerror="this.style.display=\\'none\\';this.nextSibling.style.display=\\'flex\\'"/>' +
            '<div class="fl" style="display:none;background:' + c + '">' + ini(p.name) + '</div>'
          : '<div class="fl" style="background:' + c + '">' + ini(p.name) + '</div>';

        el.innerHTML = 
          '<div class="ac">' + av + '</div>' +
          '<div class="nm">' + (p.name || '?') + '</div>' +
          '<div class="ics" style="display:flex;gap:4px;">' + icons + '</div>';
          
        $r.appendChild(el);
        
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
      } else {
        // Update existing element
        el.className = spkClass;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        
        const nmEl = el.querySelector('.nm');
        if (nmEl && nmEl.innerText !== (p.name || '?')) nmEl.innerText = (p.name || '?');
        
        const icsEl = el.querySelector('.ics');
        if (icsEl && icsEl.innerHTML !== icons) icsEl.innerHTML = icons;
        
        existingMap.delete('p_' + p.id);
      }
    });

    // Remove old elements that shouldn't be visible anymore smoothly
    existingMap.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.95)';
      setTimeout(() => el.remove(), 250);
    });

    if (over > 0) {
      const ovEl = document.createElement('div');
      ovEl.className = 'ov';
      ovEl.innerText = '+' + over;
      $r.appendChild(ovEl);
    }
  }

  if (window.netrex?.onVoiceOverlayUpdate) {
    window.netrex.onVoiceOverlayUpdate((data) => render(data));
  }
</script>
</body>
</html>`;

  voiceOverlayWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHtml));

  voiceOverlayWindow.on('closed', () => {
    voiceOverlayWindow = null;
    stopAntiCheatCheck();
  });

  return voiceOverlayWindow;
}

function updateVoiceOverlay(data) {
  if (!voiceOverlayWindow || voiceOverlayWindow.isDestroyed()) return;

  if (!voiceOverlayWindow.isVisible()) {
    voiceOverlayWindow.showInactive();
  }

  voiceOverlayWindow.webContents.send('voice-overlay-data', data);
}

function setVoiceOverlayInteractive(interactive) {
  if (voiceOverlayWindow && !voiceOverlayWindow.isDestroyed()) {
    voiceOverlayWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  }
}

function closeVoiceOverlay() {
  if (voiceOverlayWindow && !voiceOverlayWindow.isDestroyed()) {
    voiceOverlayWindow.hide();
  }
}

function destroyVoiceOverlay() {
  if (voiceOverlayWindow && !voiceOverlayWindow.isDestroyed()) {
    voiceOverlayWindow.close();
  }
  stopAntiCheatCheck();
}

function moveVoiceOverlay(dx, dy) {
  if (!voiceOverlayWindow || voiceOverlayWindow.isDestroyed()) return;
  const [x, y] = voiceOverlayWindow.getPosition();
  voiceOverlayWindow.setPosition(x + dx, y + dy);
}

function getVoiceOverlayPosition() {
  if (!voiceOverlayWindow || voiceOverlayWindow.isDestroyed()) return null;
  const [x, y] = voiceOverlayWindow.getPosition();
  return { x, y };
}

// ============================================
// 🛡️ ANTI-CHEAT DETECTION
// ============================================
function startAntiCheatCheck() {
  if (antiCheatCheckInterval) return;
  if (process.platform !== 'win32') return;

  const { exec } = require('child_process');

  antiCheatCheckInterval = setInterval(() => {
    exec('tasklist /FO CSV /NH', { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return;
      const lower = stdout.toLowerCase();
      const detected = ANTICHEAT_PROCESSES.some(p => lower.includes(p.toLowerCase()));

      if (detected) {
        if (voiceOverlayWindow && !voiceOverlayWindow.isDestroyed() && voiceOverlayWindow.isVisible()) {
          voiceOverlayWindow.hide();
          log.info('🛡️ Anti-cheat detected, overlay hidden');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('voice-overlay-anticheat', true);
          }
        }
      }
    });
  }, 30000);
}

function stopAntiCheatCheck() {
  if (antiCheatCheckInterval) {
    clearInterval(antiCheatCheckInterval);
    antiCheatCheckInterval = null;
  }
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

  // Dış linkleri (ör. iframe içindeki YouTube linkleri veya target="_blank" etiketleri) varsayılan tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
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
    setUpdateCheckCompleted,
    updatePointerOverlay,
    setPointerOverlayInteractive,
    sendPointerOverlayEvent,
    setPointerOverlayWidgetRect,
    closePointerOverlay,
    // Kayan mesaj (ticker)
    showTickerMessage,
    hideTicker,
    closeTicker,
    setTickerButtonRect,
    // Voice Overlay
    createVoiceOverlayWindow,
    updateVoiceOverlay,
    setVoiceOverlayInteractive,
    closeVoiceOverlay,
    destroyVoiceOverlay,
    moveVoiceOverlay,
    getVoiceOverlayPosition,
    startAntiCheatCheck,
    stopAntiCheatCheck
};
