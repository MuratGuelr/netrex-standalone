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
function createPointerOverlayWindow() {
  if (pointerOverlayWindow && !pointerOverlayWindow.isDestroyed()) {
    return pointerOverlayWindow;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  pointerOverlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
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

  // Başlangıçta click-through
  pointerOverlayWindow.setIgnoreMouseEvents(true, { forward: true });

  const overlayHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          overflow: hidden; 
          background: transparent; 
          font-family: 'Segoe UI', -apple-system, system-ui, sans-serif;
          user-select: none;
        }

        /* ═══════════ CURSOR RENDERING ═══════════ */
        .ptr {
          position: absolute;
          pointer-events: none;
          z-index: 10;
          transition: left 60ms linear, top 60ms linear;
          transform: translate(-2px, -2px);
        }
        .ptr svg { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5)); }
        .ptr-name {
          position: absolute;
          top: 22px; left: 12px;
          background: rgba(17,18,20,0.92);
          color: #fff;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.12);
          letter-spacing: 0.01em;
          pointer-events: none;
        }

        /* ═══════════ WIDGET (small floating panel) ═══════════ */
        #widget {
          position: absolute;
          top: 12px; right: 12px;
          pointer-events: auto;
          z-index: 9999;
          opacity: 0.35;
          transition: opacity 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        #widget:hover { opacity: 1; }

        /* --- Pill (collapsed) --- */
        #pill {
          display: flex;
          align-items: center;
          width: 170px;
          box-sizing: border-box;
          gap: 5px;
          background: rgba(17,18,20,0.55);
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 14px;
          padding: 3px 9px;
          cursor: pointer;
          backdrop-filter: blur(8px);
          box-shadow: 0 1px 6px rgba(0,0,0,0.25);
          transition: background 0.15s, border-color 0.15s;
        }
        #pill:hover { background: rgba(17,18,20,0.88); border-color: rgba(99,102,241,0.45); }
        .dot { width: 4px; height: 4px; border-radius: 50%; background: #6366f1; box-shadow: 0 0 4px #6366f1; }
        .dot.off { background: #666; box-shadow: none; }
        #pill-text { color: rgba(255,255,255,0.8); font-size: 9px; font-weight: 600; letter-spacing: 0.02em; }
        #pill-count {
          margin-left: auto;
          background: rgba(99,102,241,0.25);
          color: #a5b4fc;
          font-size: 8px;
          font-weight: 700;
          padding: 0px 4px;
          border-radius: 6px;
          min-width: 12px;
          text-align: center;
          line-height: 14px;
        }

        /* --- Panel (expanded) --- */
        #panel {
          display: none;
          flex-direction: column;
          width: 170px;
          background: rgba(17,18,20,0.78);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          backdrop-filter: blur(12px);
          box-shadow: 0 2px 16px rgba(0,0,0,0.4);
          overflow: hidden;
        }

        /* Panel Header */
        .ph {
          display: flex; align-items: center; justify-content: space-between;
          padding: 5px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          cursor: grab;
        }
        .ph:active { cursor: grabbing; }
        .ph-left { display: flex; align-items: center; gap: 5px; }
        .ph-left .dot { width: 5px; height: 5px; }
        .ph-title { color: rgba(255,255,255,0.7); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .ph-btns { display: flex; gap: 3px; }
        .ph-btn {
          background: none; border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.45); border-radius: 4px; padding: 2px 5px;
          font-size: 9px; cursor: pointer; transition: all 0.12s; font-weight: 600;
        }
        .ph-btn:hover { color: #fff; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); }
        .ph-btn.danger { color: #f87171; border-color: rgba(248,113,113,0.2); }
        .ph-btn.danger:hover { background: #f87171; color: #fff; }

        /* Panel Body */
        .pb { padding: 6px 8px; display: flex; flex-direction: column; gap: 5px; }
        .row { display: flex; align-items: center; justify-content: space-between; }
        .row-label { color: rgba(255,255,255,0.65); font-size: 10px; }

        /* Toggle */
        .tgl { position: relative; display: inline-block; width: 26px; height: 14px; }
        .tgl input { opacity: 0; width: 0; height: 0; }
        .tgl-s { position: absolute; cursor: pointer; inset: 0; background: rgba(255,255,255,0.1); border-radius: 14px; transition: .2s; }
        .tgl-s::before { content: ''; position: absolute; width: 10px; height: 10px; left: 2px; bottom: 2px; background: #fff; border-radius: 50%; transition: .2s; }
        .tgl input:checked + .tgl-s { background: #6366f1; }
        .tgl input:checked + .tgl-s::before { transform: translateX(12px); }

        /* Slider */
        .rng { display: flex; align-items: center; gap: 5px; }
        .rng-val { font-size: 9px; color: rgba(255,255,255,0.45); width: 24px; text-align: right; font-variant-numeric: tabular-nums; }
        input[type=range] { -webkit-appearance: none; width: 60px; background: transparent; cursor: pointer; }
        input[type=range]::-webkit-slider-runnable-track { height: 3px; background: rgba(255,255,255,0.1); border-radius: 3px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 9px; height: 9px; border-radius: 50%; background: #a5b4fc; margin-top: -3px; }

        /* Users */
        .sep { font-size: 8px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.05); }
        .ulist { display: flex; flex-direction: column; gap: 3px; max-height: 120px; overflow-y: auto; }
        .ulist::-webkit-scrollbar { width: 3px; }
        .ulist::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .ui {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255,255,255,0.03);
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 10px;
          color: rgba(255,255,255,0.8);
        }
        .ui-left { display: flex; align-items: center; gap: 5px; }
        .ui-dot { width: 5px; height: 5px; border-radius: 50%; }
        .ui-rm {
          background: rgba(248,113,113,0.08); color: #f87171; border: 1px solid rgba(248,113,113,0.15);
          border-radius: 3px; padding: 1px 4px; font-size: 8px; cursor: pointer; font-weight: 600; transition: all 0.12s;
        }
        .ui-rm:hover { background: #f87171; color: #fff; }
        .empty { color: rgba(255,255,255,0.25); font-size: 9px; font-style: italic; padding: 2px 0; }
      </style>
    </head>
    <body>
      <div id="cursor-layer"></div>

      <div id="widget">
        <div id="pill">
          <div class="dot" id="status-dot"></div>
          <span id="pill-text">İmleç</span>
          <span id="pill-count">0</span>
        </div>

        <div id="panel">
          <div class="ph" id="drag-handle">
            <div class="ph-left">
              <div class="dot"></div>
              <span class="ph-title">İmleç Paylaşımı</span>
            </div>
            <div class="ph-btns">
              <button class="ph-btn" id="btn-min">─</button>
              <button class="ph-btn danger" id="btn-close">✕</button>
            </div>
          </div>
          <div class="pb">
            <div class="row">
              <span class="row-label">İmleçleri Göster</span>
              <label class="tgl">
                <input type="checkbox" id="chk-vis" checked>
                <span class="tgl-s"></span>
              </label>
            </div>
            <div class="row">
              <span class="row-label">İmleç Opaklık</span>
              <div class="rng">
                <input type="range" id="rng-opacity" min="10" max="100" value="100">
                <span class="rng-val" id="val-opacity">100</span>
              </div>
            </div>
            <div class="sep">Aktif Kullanıcılar</div>
            <div class="ulist" id="ulist">
              <div class="empty">Henüz kimse yok</div>
            </div>
          </div>
        </div>
      </div>

      <script>
        // ══════ STATE ══════
        let cursorsVisible = true;
        let cursorOpacity = 1.0;
        let expanded = false;

        // ══════ DOM ══════
        const cursorLayer = document.getElementById('cursor-layer');
        const widget = document.getElementById('widget');
        const pill = document.getElementById('pill');
        const panel = document.getElementById('panel');
        const pillText = document.getElementById('pill-text');
        const pillCount = document.getElementById('pill-count');
        const statusDot = document.getElementById('status-dot');
        const chkVis = document.getElementById('chk-vis');
        const rngOpacity = document.getElementById('rng-opacity');
        const valOpacity = document.getElementById('val-opacity');
        const ulist = document.getElementById('ulist');

        // ══════ EXPAND / COLLAPSE ══════
        let didDrag = false;
        pill.addEventListener('click', () => { 
          if (!didDrag) { 
            expanded = true; 
            pill.style.display = 'none'; 
            panel.style.display = 'flex'; 
          } 
        });
        document.getElementById('btn-min').addEventListener('click', () => { expanded = false; panel.style.display = 'none'; pill.style.display = 'flex'; });
        document.getElementById('btn-close').addEventListener('click', () => {
          if (window.netrex?.revokeAllPointers) window.netrex.revokeAllPointers();
          if (window.netrex?.closePointerOverlay) window.netrex.closePointerOverlay();
        });

        // ══════ CLICK-THROUGH ══════
        widget.addEventListener('mouseenter', () => { if (window.netrex?.setOverlayInteractive) window.netrex.setOverlayInteractive(true); });
        widget.addEventListener('mouseleave', () => { if (window.netrex?.setOverlayInteractive) window.netrex.setOverlayInteractive(false); });

        // ══════ DRAG (both pill + panel header) ══════
        let dragging = false, dx = 0, dy = 0, dragStartX = 0, dragStartY = 0;
        function startDrag(e) {
          if (e.target.closest('.ph-btn') || e.target.closest('.ui-rm') || e.target.closest('.tgl') || e.target.tagName === 'INPUT') return;
          dragging = true; didDrag = false;
          const r = widget.getBoundingClientRect();
          dx = e.clientX - r.left; dy = e.clientY - r.top;
          dragStartX = e.clientX; dragStartY = e.clientY;
          widget.style.right = 'auto';
          widget.style.left = r.left + 'px';
          e.preventDefault();
        }
        document.getElementById('drag-handle').addEventListener('mousedown', startDrag);
        pill.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) didDrag = true;
          const mw = window.innerWidth - widget.offsetWidth;
          const mh = window.innerHeight - widget.offsetHeight;
          widget.style.left = Math.max(0, Math.min(mw, e.clientX - dx)) + 'px';
          widget.style.top = Math.max(0, Math.min(mh, e.clientY - dy)) + 'px';
        });
        document.addEventListener('mouseup', () => { dragging = false; });

        // ══════ CONTROLS ══════
        chkVis.addEventListener('change', (e) => {
          cursorsVisible = e.target.checked;
          cursorLayer.style.display = cursorsVisible ? 'block' : 'none';
          statusDot.className = cursorsVisible ? 'dot' : 'dot off';
        });
        rngOpacity.addEventListener('input', (e) => {
          cursorOpacity = e.target.value / 100;
          valOpacity.textContent = e.target.value;
          cursorLayer.style.opacity = cursorOpacity;
        });

        // ══════ SVG CURSOR ══════
        const mkSvg = (c) => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-5.07a.5.5 0 0 1 .36-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" fill="' + c + '" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';

        // ══════ UPDATE ══════
        function updatePointers(data) {
          const n = data.length;
          pillCount.textContent = n;
          pillText.textContent = 'İMLEÇ PAYLAŞIMI';

          // Users list
          if (n === 0) {
            ulist.innerHTML = '<div class="empty">Henüz kimse yok</div>';
          } else {
            ulist.innerHTML = data.map(p => {
              const c = p.color || '#6366f1';
              const nm = p.name || 'Kullanıcı';
              const eid = p.id.replace(/'/g, "\\\\'");
              return '<div class="ui"><div class="ui-left"><div class="ui-dot" style="background:' + c + '"></div>' + nm + '</div><button class="ui-rm" onclick="revoke(\\'' + eid + '\\')">Kaldır</button></div>';
            }).join('');
          }

          // Cursor elements
          const ids = new Set(data.map(p => p.id));
          Array.from(cursorLayer.children).forEach(ch => { if (!ids.has(ch.id)) cursorLayer.removeChild(ch); });
          data.forEach(p => {
            let el = document.getElementById(p.id);
            const c = p.color || '#6366f1';
            if (!el) {
              el = document.createElement('div');
              el.id = p.id;
              el.className = 'ptr';
              el.innerHTML = mkSvg(c) + '<div class="ptr-name">' + (p.name || '?') + '</div>';
              cursorLayer.appendChild(el);
            }
            el.style.left = (p.x * 100) + '%';
            el.style.top = (p.y * 100) + '%';
          });
        }

        // Revoke global
        window.revoke = (id) => { if (window.netrex?.revokePointer) window.netrex.revokePointer(id); };

        // IPC
        if (window.netrex?.onPointerOverlayUpdate) {
          window.netrex.onPointerOverlayUpdate((data) => updatePointers(data));
        }
      </script>
    </body>
    </html>
  `;

  pointerOverlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);
  
  pointerOverlayWindow.on('closed', () => {
    pointerOverlayWindow = null;
  });

  return pointerOverlayWindow;
}

function updatePointerOverlay(pointerData, forceShow = false) {
  const hasPointers = Array.isArray(pointerData) && pointerData.length > 0;
  
  if (!hasPointers && !forceShow) {
    if (!pointerOverlayWindow || pointerOverlayWindow.isDestroyed()) {
      return;
    }
  }

  if (!pointerOverlayWindow || pointerOverlayWindow.isDestroyed()) {
    createPointerOverlayWindow().show();
  }
  
  if (!pointerOverlayWindow.isVisible()) {
    pointerOverlayWindow.showInactive();
  }

  // ✅ IPC send instead of heavy executeJavaScript parsing
  pointerOverlayWindow.webContents.send("update-pointer-overlay-data", pointerData);
}

function setPointerOverlayInteractive(interactive) {
  if (pointerOverlayWindow && !pointerOverlayWindow.isDestroyed()) {
    // Dinamik olarak click-through veya etkileşimli yap
    pointerOverlayWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  }
}

function closePointerOverlay() {
  if (pointerOverlayWindow && !pointerOverlayWindow.isDestroyed()) {
    pointerOverlayWindow.close();
  }
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
    closePointerOverlay,
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
