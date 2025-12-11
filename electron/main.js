const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  systemPreferences,
  dialog,
  desktopCapturer,
  Tray, // EKLENDİ
  Menu, // EKLENDİ
  nativeImage, // EKLENDİ
} = require("electron");
const path = require("path");
const http = require("http");
const url = require("url");
const fs = require("fs");
const Store = require("electron-store");
const { AccessToken } = require("livekit-server-sdk");
const { uIOhook } = require("uiohook-napi");

// --- AUTO UPDATE IMPORTS ---
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// --- LOGLAMA AYARLARI ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

// Ortam Değişkenlerini Yükle (SSL bypass'tan ÖNCE yüklenmeli)
const possibleEnvPaths = [
  path.join(__dirname, ".env.local"),
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

// --- LIVEKIT SSL BYPASS (Kamera/Mikrofon için) ---
// SSL sertifikası olmayan LiveKit sunucuları için güvenli olarak işaretle
const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
if (livekitUrl) {
  // wss:// veya ws:// -> http:// veya https:// dönüşümü
  const httpUrl = livekitUrl
    .replace('wss://', 'https://')
    .replace('ws://', 'http://');
  
  // Ayrıca http versiyonunu da ekle (SSL olmayan sunucular için)
  const insecureUrl = livekitUrl
    .replace('wss://', 'http://')
    .replace('ws://', 'http://');
  
  console.log("🔐 LiveKit SSL bypass URL'leri:", httpUrl, insecureUrl);
  
  // Her iki URL'yi de güvenli olarak işaretle
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', `${httpUrl},${insecureUrl}`);
} else {
  console.warn("⚠️ NEXT_PUBLIC_LIVEKIT_URL tanımlı değil!");
}
// Ortamdan bağımsız çalışması için gerekli olabilir
app.commandLine.appendSwitch('ignore-certificate-errors');

const store = new Store();
let mainWindow;
let splashWindow = null; // Splash penceresi
let exitSplashWindow = null; // Çıkış splash penceresi
let authServer;
let isRecordingMode = false;
let tray = null; // Tray değişkeni
let isQuitting = false; // Gerçekten çıkıyor muyuz kontrolü

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Lock alınamadıysa (zaten çalışıyorsa), uyarı gösterip kapat
  app.whenReady().then(() => {
    const warningWindow = new BrowserWindow({
      width: 400,
      height: 320,
      frame: false,
      transparent: false,
      backgroundColor: "#0a0a0f",
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
      center: true
    });

    warningWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(getAlreadyRunningHtml())}`
    );

    warningWindow.once('ready-to-show', () => {
      warningWindow.show();
      warningWindow.focus();
      
      // 3 saniye sonra kapat ve çık
      setTimeout(() => {
        warningWindow.close();
        app.exit(0);
      }, 3000);
    });
  });
  
} else {
  app.on("second-instance", () => {
    // Biri ikinci bir örneği çalıştırmaya çalıştı, bu pencereye odaklanalım.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (splashWindow) {
      if (splashWindow.isMinimized()) splashWindow.restore();
      splashWindow.focus();
    }
  });
}

// --- MODERN HTML ŞABLONU ---
const getHtmlTemplate = (title, bodyContent, scriptContent = "") => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background-color: #111214; color: #dbdee1; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .card { background-color: #313338; padding: 40px; border-radius: 8px; text-align: center; }
    .btn { display: inline-block; padding: 10px 20px; background: #5865F2; color: white; border-radius: 4px; text-decoration: none; cursor: pointer; border: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">${bodyContent}</div>
  ${scriptContent}
</body>
  </html>
`;

// --- SPLASH SCREEN HTML (Animated SVG Version) ---
const getSplashHtml = (logoPath) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      position: relative;
    }
    
    /* Animated Background */
    .bg-glow {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
      animation: glow-pulse 3s ease-in-out infinite;
    }
    
    .bg-glow-secondary {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%);
      animation: glow-rotate 20s linear infinite;
    }
    
    .grid-pattern {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.1); }
    }
    
    @keyframes glow-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Main Container */
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    
    /* Logo Container */
    .logo-container {
      position: relative;
      width: 140px;
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Glow Ring that rotates */
    .glow-ring {
      position: absolute;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(168, 85, 247, 0.15);
      border-right-color: rgba(99, 102, 241, 0.3);
      animation: spin 4s linear infinite;
    }
    
    .glow-ring-inner {
      position: absolute;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(168, 85, 247, 0.3);
      border-right-color: rgba(99, 102, 241, 0.5);
      animation: spin 3s linear infinite reverse;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* SVG Logo with Draw Animation */
    .logo-svg {
      width: 120px;
      height: 120px;
      filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.4));
    }
    
    .logo-path {
      fill: transparent;
      stroke: #a855f7;
      stroke-width: 50;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 15000;
      stroke-dashoffset: 15000;
      animation: draw-path 2.5s ease-out forwards, fill-path 0.8s ease-out 2.5s forwards;
    }
    
    @keyframes draw-path {
      0% {
        stroke-dashoffset: 15000;
        filter: drop-shadow(0 0 0px rgba(168, 85, 247, 0));
      }
      100% { 
        stroke-dashoffset: 0;
        filter: drop-shadow(0 0 30px rgba(168, 85, 247, 0.8));
      }
    }
    
    @keyframes fill-path {
      0% {
        fill: transparent;
        stroke: #a855f7;
        stroke-width: 50;
      }
      100% { 
        fill: #a855f7;
        stroke: #a855f7;
        stroke-width: 0;
        filter: drop-shadow(0 0 40px rgba(168, 85, 247, 0.6));
      }
    }
    
    /* Text Container */
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      opacity: 0;
      animation: fade-in 0.5s ease-out 0.5s forwards;
    }
    
    @keyframes fade-in {
      to { opacity: 1; }
    }
    
    /* Brand Name */
    .brand-name {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #b5bac1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }
    
    /* Loading Text */
    .loading-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .loading-dots {
      display: flex;
      gap: 4px;
    }
    
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      animation: dot-pulse 1.2s ease-in-out infinite;
    }
    
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }
    
    /* Progress Bar */
    .progress-container {
      width: 180px;
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 3px;
      animation: progress-fill 3s ease-in-out forwards;
    }
    
    @keyframes progress-fill {
      0% { width: 0%; }
      30% { width: 30%; }
      60% { width: 60%; }
      100% { width: 100%; }
    }
    
    /* Version Badge */
    .version {
      position: absolute;
      bottom: 24px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.25);
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <!-- Background Effects -->
  <div class="bg-glow"></div>
  <div class="bg-glow-secondary"></div>
  <div class="grid-pattern"></div>
  
  <!-- Main Content -->
  <div class="main-container">
    <!-- Logo with Draw Animation -->
    <div class="logo-container">
      <div class="glow-ring"></div>
      <div class="glow-ring-inner"></div>
      
      <!-- Netrex Logo SVG -->
      <svg class="logo-svg" viewBox="0 0 256 256">
        <g transform="translate(0,256) scale(0.1,-0.1)">
          <path 
            class="logo-path" 
            d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z"
          />
        </g>
      </svg>
    </div>
    
    <!-- Text -->
    <div class="text-container">
      <div class="brand-name">Netrex</div>
      <div class="loading-text">
        <span id="loadingText">Başlatılıyor</span>
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  
  <!-- Version -->
  <div class="version">v3.0.0</div>
  
  <script>
    // Dynamic loading text
    const messages = [
      'Başlatılıyor',
      'Güncellemeler kontrol ediliyor',
      'Hazırlanıyor'
    ];
    let messageIndex = 0;
    const loadingText = document.getElementById('loadingText');
    
    setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      loadingText.textContent = messages[messageIndex];
    }, 1500);
  </script>
</body>
</html>
`;

// --- EXIT SPLASH SCREEN HTML (Animated SVG Version) ---
const getExitSplashHtml = (logoPath) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex - Kapatılıyor</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      position: relative;
    }
    
    .bg-glow {
      position: absolute;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%);
      animation: glow-fade 2s ease-in-out infinite;
    }
    
    @keyframes glow-fade {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.6; }
    }
    
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    
    .logo-container {
      position: relative;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .glow-ring {
      position: absolute;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 2px solid rgba(168, 85, 247, 0.2);
      animation: pulse-ring 2s ease-in-out infinite;
    }
    
    @keyframes pulse-ring {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    .logo-svg {
      width: 80px;
      height: 80px;
      filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.4));
      animation: logo-fade 2s ease-in-out infinite;
    }
    
    .logo-path {
      fill: #a855f7;
      stroke: none;
    }
    
    @keyframes logo-fade {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }
    
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    
    .loading-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .loading-dots { display: flex; gap: 4px; }
    
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      animation: dot-pulse 1.2s ease-in-out infinite;
    }
    
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  
  <div class="main-container">
    <div class="logo-container">
      <div class="glow-ring"></div>
      <svg class="logo-svg" viewBox="0 0 256 256">
        <g transform="translate(0,256) scale(0.1,-0.1)">
          <path class="logo-path" d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z" />
        </g>
      </svg>
    </div>
    
    <div class="text-container">
      <div class="loading-text">
        <span id="loadingText">Kapatılıyor</span>
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const messages = ['Kapatılıyor', 'Veriler kaydediliyor', 'Bağlantılar kesiliyor'];
    let messageIndex = 0;
    const loadingText = document.getElementById('loadingText');
    setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      loadingText.textContent = messages[messageIndex];
    }, 1000);
  </script>
</body>
</html>
`;

// --- AUTH SERVER ---
const getLoginHtml = (apiKey, authDomain) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex - Giriş Yap</title>
  <link rel="icon" href="/logo.png" type="image/png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg-deep: #0a0a0c;
      --bg-primary: #111214;
      --bg-secondary: #1a1b1e;
      --accent-indigo: #6366f1;
      --accent-purple: #a855f7;
      --accent-cyan: #06b6d4;
      --accent-green: #22c55e;
      --text-primary: #ffffff;
      --text-secondary: #b5bac1;
      --text-muted: #949ba4;
      --text-very-muted: #5c5e66;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-deep);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-x: hidden;
      position: relative;
      padding: 16px;
    }
    
    /* Animated Background */
    .bg-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }
    
    .bg-gradient {
      background: 
        radial-gradient(ellipse 80% 60% at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
        radial-gradient(ellipse 70% 50% at 80% 70%, rgba(168, 85, 247, 0.12) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 50% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
      animation: gradient-morph 12s ease-in-out infinite;
    }
    
    .bg-grid {
      background-image: 
        linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: 40px 40px;
      mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
    }
    
    @keyframes gradient-morph {
      0%, 100% { opacity: 0.8; transform: scale(1) rotate(0deg); }
      33% { opacity: 1; transform: scale(1.02) rotate(1deg); }
      66% { opacity: 0.9; transform: scale(0.98) rotate(-1deg); }
    }
    
    /* Floating Particles */
    .particles {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    
    .particle {
      position: absolute;
      border-radius: 50%;
      animation: float-particle linear infinite;
    }
    
    .particle:nth-child(1) { width: 8px; height: 8px; left: 10%; background: var(--accent-indigo); animation-duration: 18s; animation-delay: 0s; opacity: 0.3; }
    .particle:nth-child(2) { width: 6px; height: 6px; left: 25%; background: var(--accent-purple); animation-duration: 22s; animation-delay: 3s; opacity: 0.25; }
    .particle:nth-child(3) { width: 10px; height: 10px; left: 45%; background: var(--accent-cyan); animation-duration: 20s; animation-delay: 6s; opacity: 0.2; }
    .particle:nth-child(4) { width: 5px; height: 5px; left: 65%; background: var(--accent-indigo); animation-duration: 25s; animation-delay: 9s; opacity: 0.3; }
    .particle:nth-child(5) { width: 7px; height: 7px; left: 80%; background: var(--accent-purple); animation-duration: 19s; animation-delay: 2s; opacity: 0.25; }
    .particle:nth-child(6) { width: 4px; height: 4px; left: 92%; background: var(--accent-cyan); animation-duration: 24s; animation-delay: 5s; opacity: 0.35; }
    
    @keyframes float-particle {
      0% { transform: translateY(100vh) rotate(0deg) scale(0); opacity: 0; }
      10% { opacity: var(--particle-opacity, 0.3); transform: translateY(80vh) rotate(45deg) scale(1); }
      90% { opacity: var(--particle-opacity, 0.3); }
      100% { transform: translateY(-20vh) rotate(360deg) scale(0.5); opacity: 0; }
    }
    
    /* Main Container */
    .container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 440px;
      animation: container-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes container-enter {
      from { opacity: 0; transform: translateY(30px) scale(0.95); filter: blur(10px); }
      to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }
    
    /* Card Glow Effect */
    .card-glow {
      position: absolute;
      inset: -2px;
      background: linear-gradient(135deg, var(--accent-indigo), var(--accent-purple), var(--accent-cyan));
      border-radius: 30px;
      opacity: 0.15;
      filter: blur(20px);
      animation: glow-pulse 4s ease-in-out infinite;
    }
    
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.15; transform: scale(1); }
      50% { opacity: 0.25; transform: scale(1.02); }
    }
    
    /* Glass Card */
    .card {
      position: relative;
      background: linear-gradient(135deg, rgba(26, 27, 30, 0.95) 0%, rgba(17, 18, 20, 0.98) 100%);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 
        0 30px 60px -15px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255, 255, 255, 0.03) inset,
        0 -30px 60px -30px rgba(99, 102, 241, 0.15) inset;
    }
    
    @media (min-width: 480px) {
      .card {
        padding: 48px 44px;
        border-radius: 32px;
      }
    }
    
    /* Top Shine Line */
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 20%;
      right: 20%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      border-radius: 1px;
    }
    
    /* Logo Section */
    .logo-section {
      margin-bottom: 28px;
    }
    
    @media (min-width: 480px) {
      .logo-section {
        margin-bottom: 36px;
      }
    }
    
    .logo-wrapper {
      position: relative;
      display: inline-block;
      margin-bottom: 20px;
    }
    
    .logo-glow {
      position: absolute;
      inset: -15px;
      background: linear-gradient(135deg, var(--accent-indigo), var(--accent-purple));
      border-radius: 28px;
      opacity: 0.4;
      filter: blur(25px);
      animation: logo-glow-pulse 3s ease-in-out infinite;
    }
    
    @keyframes logo-glow-pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.1); }
    }
    
    .logo {
      position: relative;
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-purple) 100%);
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.5);
      overflow: hidden;
    }
    
    @media (min-width: 480px) {
      .logo {
        width: 96px;
        height: 96px;
        border-radius: 26px;
      }
    }
    
    /* Inner shine */
    .logo::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%);
    }
    
    /* Rotating border */
    .logo::after {
      content: '';
      position: absolute;
      inset: -3px;
      background: conic-gradient(from 0deg, var(--accent-indigo), var(--accent-purple), var(--accent-cyan), var(--accent-indigo));
      border-radius: 25px;
      z-index: -1;
      opacity: 0;
      animation: border-rotate 6s linear infinite;
    }
    
    .logo:hover::after {
      opacity: 0.6;
    }
    
    @keyframes border-rotate {
      to { transform: rotate(360deg); }
    }
    
    .logo-img {
      position: relative;
      width: 68px;
      height: 68px;
      object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
    }
    
    @media (min-width: 480px) {
      .logo-img {
        width: 68px;
        height: 68px;
      }
    }
    
    .logo-fallback {
      font-size: 36px;
      font-weight: 800;
      color: white;
      display: none;
    }
    
    /* Sparkle decorations */
    .sparkle {
      position: absolute;
      font-size: 14px;
      animation: sparkle-pulse 2s ease-in-out infinite;
    }
    
    .sparkle-1 { top: -8px; right: -8px; animation-delay: 0s; }
    .sparkle-2 { bottom: -6px; left: -6px; animation-delay: 0.5s; font-size: 10px; }
    
    @keyframes sparkle-pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    
    .title {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 0%, var(--text-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    @media (min-width: 480px) {
      .title {
        font-size: 30px;
      }
    }
    
    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    
    @media (min-width: 480px) {
      .subtitle {
        font-size: 15px;
      }
    }
    
    /* Divider */
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      margin: 28px 0;
    }
    
    @media (min-width: 480px) {
      .divider {
        margin: 32px 0;
      }
    }
    
    /* Google Button */
    .google-btn {
      width: 100%;
      padding: 14px 24px;
      background: #ffffff;
      border: none;
      border-radius: 14px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      position: relative;
      overflow: hidden;
    }
    
    @media (min-width: 480px) {
      .google-btn {
        padding: 16px 28px;
        font-size: 16px;
        border-radius: 16px;
      }
    }
    
    /* Shimmer effect */
    .google-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent);
      transition: left 0.5s;
    }
    
    .google-btn:hover::before {
      left: 100%;
    }
    
    .google-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(99, 102, 241, 0.2);
    }
    
    .google-btn:active {
      transform: translateY(0) scale(0.98);
    }
    
    .google-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }
    
    .google-icon {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    
    @media (min-width: 480px) {
      .google-icon {
        width: 24px;
        height: 24px;
      }
    }
    
    .btn-arrow {
      opacity: 0;
      transform: translateX(-8px);
      transition: all 0.3s;
    }
    
    .google-btn:hover .btn-arrow {
      opacity: 1;
      transform: translateX(0);
    }
    
    /* Loading Spinner */
    .spinner {
      width: 22px;
      height: 22px;
      border: 2.5px solid #e5e7eb;
      border-top-color: var(--accent-indigo);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Error Message */
    .error-msg {
      margin-top: 20px;
      padding: 14px 18px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 12px;
      border-left: 3px solid #ef4444;
      color: #f87171;
      font-size: 13px;
      text-align: left;
      display: none;
      animation: error-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }
    
    .error-msg.show {
      display: block;
    }
    
    @keyframes error-shake {
      0%, 100% { transform: translateX(0); }
      15%, 45%, 75% { transform: translateX(-5px); }
      30%, 60%, 90% { transform: translateX(5px); }
    }
    
    /* Features Grid */
    .features {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    
    @media (min-width: 400px) {
      .features {
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
    }
    
    .feature {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 14px 12px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.04);
      transition: all 0.3s;
    }
    
    @media (max-width: 399px) {
      .feature {
        flex-direction: row;
        justify-content: flex-start;
        gap: 12px;
        padding: 12px 16px;
      }
    }
    
    .feature:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(99, 102, 241, 0.15);
      transform: translateY(-2px);
    }
    
    .feature-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .feature-icon.voice { 
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05)); 
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.15);
    }
    .feature-icon.secure { 
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05)); 
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
    }
    .feature-icon.fast { 
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05)); 
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.15);
    }
    
    .feature-text {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
      text-align: center;
      line-height: 1.3;
    }
    
    @media (max-width: 399px) {
      .feature-text {
        font-size: 13px;
        text-align: left;
      }
    }
    
    /* Footer */
    .footer {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
      color: var(--text-very-muted);
    }
    
    .footer a {
      color: var(--accent-indigo);
      text-decoration: none;
      transition: all 0.2s;
    }
    
    .footer a:hover {
      color: var(--accent-purple);
      text-decoration: underline;
    }
    
    /* Version Badge */
    .version-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      font-size: 10px;
    }
    
    .version-dot {
      width: 6px;
      height: 6px;
      background: var(--accent-green);
      border-radius: 50%;
      animation: pulse-dot 2s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }
    
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .version-text {
      color: var(--text-very-muted);
    }
  </style>
</head>
<body>
  <div class="bg-layer bg-gradient"></div>
  <div class="bg-layer bg-grid"></div>
  
  <div class="particles">
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
  </div>
  
  <div class="container">
    <div class="card-glow"></div>
    <div class="card">
      <div class="logo-section">
        <div class="logo-wrapper">
          <div class="logo-glow"></div>
          <div class="logo">
            <img class="logo-img" src="/logo.png" alt="Netrex" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
            <span class="logo-fallback">N</span>
          </div>
          <span class="sparkle sparkle-1">✨</span>
          <span class="sparkle sparkle-2">⭐</span>
        </div>
        <h1 class="title">Netrex'e Hoş Geldin</h1>
        <p class="subtitle">Güvenli sesli sohbet platformuna<br>Google hesabınla giriş yap</p>
      </div>
      
      <div class="divider"></div>
      
      <button id="loginBtn" class="google-btn">
        <svg class="google-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span id="btnText">Google ile Giriş Yap</span>
        <svg class="btn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
      
      <div id="errorMsg" class="error-msg"></div>
      
      <div class="features">
        <div class="feature">
          <div class="feature-icon voice">🎙️</div>
          <span class="feature-text">Net & Hızlı<br>Sesli Sohbet</span>
        </div>
        <div class="feature">
          <div class="feature-icon secure">🔒</div>
          <span class="feature-text">Uçtan Uca<br>Şifreli Güvenlik</span>
        </div>
        <div class="feature">
          <div class="feature-icon fast">⚡</div>
          <span class="feature-text">Düşük<br>Gecikme</span>
        </div>
      </div>
      
      <div class="footer">
        Giriş yaparak <a href="#">Kullanım Şartları</a>'nı kabul etmiş olursunuz.
        <div class="version-badge">
          <span class="version-dot"></span>
          <span class="version-text">Netrex Client • v3.0.0</span>
        </div>
      </div>
    </div>
  </div>
  
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
    
    const app = initializeApp({ apiKey: "${apiKey}", authDomain: "${authDomain}" });
    const auth = getAuth(app);
    
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const errorMsg = document.getElementById('errorMsg');
    
    loginBtn.onclick = async () => {
      // Show loading state
      loginBtn.disabled = true;
      btnText.innerHTML = '<div class="spinner"></div>';
      errorMsg.classList.remove('show');
      
      try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const cred = GoogleAuthProvider.credentialFromResult(result);
        
        // Success - redirect
        btnText.textContent = 'Yönlendiriliyor...';
        window.location.href = "/oauth/callback?token=" + cred.idToken;
      } catch (error) {
        // Show error
        loginBtn.disabled = false;
        btnText.textContent = 'Google ile Giriş Yap';
        errorMsg.textContent = error.message || 'Giriş yapılırken bir hata oluştu.';
        errorMsg.classList.add('show');
      }
    };
  </script>
</body>
</html>
`;

const getSuccessHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex - Başarılı</title>
  <link rel="icon" href="/logo.png" type="image/png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --accent-green: #22c55e;
      --accent-emerald: #10b981;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #0a0a0c;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      padding: 16px;
    }
    
    /* Animated Background */
    .bg-gradient {
      position: fixed;
      inset: 0;
      background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(34, 197, 94, 0.15) 0%, transparent 60%);
      animation: pulse-bg 3s ease-in-out infinite;
    }
    
    @keyframes pulse-bg {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
    
    /* Confetti */
    .confetti-container {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    
    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      opacity: 0;
      animation: confetti-fall 3s ease-out forwards;
    }
    
    .confetti:nth-child(1) { left: 10%; background: #22c55e; animation-delay: 0s; border-radius: 50%; }
    .confetti:nth-child(2) { left: 25%; background: #6366f1; animation-delay: 0.1s; }
    .confetti:nth-child(3) { left: 40%; background: #a855f7; animation-delay: 0.2s; border-radius: 50%; }
    .confetti:nth-child(4) { left: 55%; background: #06b6d4; animation-delay: 0.15s; }
    .confetti:nth-child(5) { left: 70%; background: #f59e0b; animation-delay: 0.25s; border-radius: 50%; }
    .confetti:nth-child(6) { left: 85%; background: #ec4899; animation-delay: 0.05s; }
    .confetti:nth-child(7) { left: 15%; background: #10b981; animation-delay: 0.3s; }
    .confetti:nth-child(8) { left: 60%; background: #8b5cf6; animation-delay: 0.35s; border-radius: 50%; }
    
    @keyframes confetti-fall {
      0% { transform: translateY(-20vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
    }
    
    /* Card */
    .container {
      position: relative;
      z-index: 10;
      animation: container-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes container-enter {
      from { opacity: 0; transform: translateY(20px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    .card-glow {
      position: absolute;
      inset: -2px;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-emerald));
      border-radius: 30px;
      opacity: 0.2;
      filter: blur(20px);
      animation: glow-pulse 2s ease-in-out infinite;
    }
    
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.2; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(1.02); }
    }
    
    .card {
      position: relative;
      background: linear-gradient(135deg, rgba(26, 27, 30, 0.95) 0%, rgba(17, 18, 20, 0.98) 100%);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px 48px;
      text-align: center;
      box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6);
    }
    
    @media (min-width: 480px) {
      .card {
        padding: 48px 64px;
        border-radius: 28px;
      }
    }
    
    /* Top shine */
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 20%;
      right: 20%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.5), transparent);
    }
    
    /* Success Icon */
    .success-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, var(--accent-green) 0%, var(--accent-emerald) 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 50px rgba(34, 197, 94, 0.5), 0 20px 40px -10px rgba(34, 197, 94, 0.4);
      animation: icon-bounce 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      position: relative;
    }
    
    @media (min-width: 480px) {
      .success-icon {
        width: 96px;
        height: 96px;
      }
    }
    
    /* Checkmark animation */
    .checkmark {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    @media (min-width: 480px) {
      .checkmark {
        width: 48px;
        height: 48px;
      }
    }
    
    .checkmark-path {
      stroke-dasharray: 60;
      stroke-dashoffset: 60;
      animation: checkmark-draw 0.6s ease-out 0.4s forwards;
    }
    
    @keyframes checkmark-draw {
      to { stroke-dashoffset: 0; }
    }
    
    /* Pulse ring */
    .success-icon::after {
      content: '';
      position: absolute;
      inset: -8px;
      border: 2px solid rgba(34, 197, 94, 0.3);
      border-radius: 50%;
      animation: pulse-ring 1.5s ease-out infinite;
    }
    
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    
    @keyframes icon-bounce {
      0% { transform: scale(0) rotate(-45deg); }
      50% { transform: scale(1.15) rotate(5deg); }
      70% { transform: scale(0.95) rotate(-2deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    
    .title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-emerald));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    @media (min-width: 480px) {
      .title {
        font-size: 26px;
      }
    }
    
    .subtitle {
      font-size: 14px;
      color: #949ba4;
      margin-bottom: 24px;
    }
    
    @media (min-width: 480px) {
      .subtitle {
        font-size: 15px;
      }
    }
    
    /* Progress Bar */
    .progress-container {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      overflow: hidden;
      height: 6px;
    }
    
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-green), var(--accent-emerald));
      border-radius: 6px;
      animation: progress-fill 1.5s ease-out forwards;
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
    }
    
    @keyframes progress-fill {
      from { width: 0; }
      to { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  
  <div class="confetti-container">
    <div class="confetti"></div>
    <div class="confetti"></div>
    <div class="confetti"></div>
    <div class="confetti"></div>
    <div class="confetti"></div>
    <div class="confetti"></div>
    <div class="confetti"></div>
    <div class="confetti"></div>
  </div>
  
  <div class="container">
    <div class="card-glow"></div>
    <div class="card">
      <div class="success-icon">
        <svg class="checkmark" viewBox="0 0 24 24">
          <path class="checkmark-path" d="M5 12l5 5L19 7" />
        </svg>
      </div>
      <h1 class="title">Giriş Başarılı!</h1>
      <p class="subtitle">Bu sayfadan ayrılabilirsiniz...</p>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  
  <script>setTimeout(() => window.close(), 1500);</script>
</body>
</html>
`;

const startLocalAuthServer = () => {
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
        // Serve the logo image for the login page
        const logoPath = app.isPackaged
          ? path.join(process.resourcesPath, "logo.png")
          : path.join(__dirname, "../public/logo.png");
        
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

// --- ALREADY RUNNING HTML ---
const getAlreadyRunningHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      position: relative;
    }
    .bg-gradient {
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(circle at 20% 30%, rgba(220, 38, 38, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(239, 68, 68, 0.15) 0%, transparent 50%);
      animation: gradient-shift 8s ease infinite;
    }
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 30px;
    }
    .icon-container {
      position: relative;
      width: 80px;
      height: 80px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 30px rgba(220, 38, 38, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .warning-icon {
      font-size: 40px;
    }
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
    }
    .subtitle {
      font-size: 14px;
      color: #9ca3af;
      max-width: 250px;
      line-height: 1.5;
    }
    @keyframes gradient-shift { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  <div class="main-container">
    <div class="icon-container">
      <div class="warning-icon">⚠️</div>
    </div>
    <div class="text-container">
      <div class="title">Netrex Zaten Çalışıyor</div>
      <div class="subtitle">Uygulamanın başka bir örneği zaten açık durumda. Bu pencere otomatik olarak kapanacak.</div>
    </div>
  </div>
</body>
</html>
`;


// --- TRAY OLUŞTURMA ---
function createTray() {
  // Production (Paketlenmiş) ve Dev (Geliştirme) modları için farklı yollar
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "logo.ico") // Build sonrası buraya kopyalanacak
    : path.join(__dirname, "../public/logo.ico"); // Dev modunda buradan alacak

  // İkonun varlığını kontrol et (Hata ayıklama için terminale basar)
  if (!fs.existsSync(iconPath)) {
    console.error("Tray ikonu bulunamadı:", iconPath);
    return;
  }

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Netrex'i Göster", click: () => mainWindow.show() },
    { type: "separator" },
    {
      label: "Çıkış Yap",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Netrex");
  tray.setContextMenu(contextMenu);

  // Çift tıklama ile aç
  tray.on("double-click", () => mainWindow.show());
}

// --- HOTKEY & INPUT ---
function getKeybinding(action) {
  const stored = store.get(`hotkeys.${action}`);
  return stored || null;
}
function setKeybinding(action, keybinding) {
  store.set(`hotkeys.${action}`, keybinding);
}
function matchesKeybinding(event, keybinding) {
  if (!keybinding) return false;
  if (keybinding.type === "mouse" || keybinding.mouseButton)
    return event.button && keybinding.mouseButton === event.button;
  if ((keybinding.type === "keyboard" || keybinding.keycode) && event.keycode) {
    if (event.keycode !== keybinding.keycode) return false;
    const isModifier = [
      42, 54, 29, 3613, 97, 56, 3640, 3675, 3676, 125, 126,
    ].includes(event.keycode);
    if (isModifier) return true;
    return (
      !!event.ctrlKey === !!keybinding.ctrlKey &&
      !!event.shiftKey === !!keybinding.shiftKey &&
      !!event.altKey === !!keybinding.altKey &&
      !!event.metaKey === !!keybinding.metaKey
    );
  }
  return false;
}
function handleInputEvent(event, type) {
  if (isRecordingMode && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "raw-keydown",
      type === "keyboard"
        ? {
            type: "keyboard",
            keycode: event.keycode,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
          }
        : { type: "mouse", mouseButton: event.button }
    );
    return;
  }

  // Keybinding'leri her seferinde yeniden yükle (güncel olması için)
  const muteKey = getKeybinding("mute");
  const deafenKey = getKeybinding("deafen");
  const cameraKey = getKeybinding("camera");

  if (muteKey && matchesKeybinding(event, muteKey)) {
    mainWindow?.webContents.send("hotkey-triggered", "toggle-mute");
  } else if (deafenKey && matchesKeybinding(event, deafenKey)) {
    mainWindow?.webContents.send("hotkey-triggered", "toggle-deafen");
  } else if (cameraKey && matchesKeybinding(event, cameraKey)) {
    mainWindow?.webContents.send("hotkey-triggered", "toggle-camera");
  }
}

function setupUiohookListeners() {
  uIOhook.on("keydown", (e) => handleInputEvent(e, "keyboard"));
  uIOhook.on("mousedown", (e) => {
    if (e.button !== 1 && e.button !== 2) handleInputEvent(e, "mouse");
  });
}

function createSplashWindow() {
  log.info("Splash penceresi oluşturuluyor...");

  // Splash penceresi oluştur (Discord benzeri - uzun ve dar)
  splashWindow = new BrowserWindow({
    width: 360,
    height: 480,
    backgroundColor: "#0f0f11",
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    center: true, // Ekranın ortasında aç
    show: false, // Önce gizli oluştur, yüklendikten sonra göster
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Logo yolunu hesapla
  const logoPath = app.isPackaged
    ? `file://${path.join(process.resourcesPath, "logo.png").replace(/\\/g, "/")}`
    : `file://${path.join(__dirname, "../public/logo.png").replace(/\\/g, "/")}`;

  // Splash HTML'ini yükle
  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml(logoPath))}`
  );

  // HTML yüklendikten sonra göster
  splashWindow.webContents.once("did-finish-load", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      log.info("Splash penceresi gösteriliyor...");
      splashWindow.show();
      splashWindow.focus();
    }
  });

  // Hata durumunda da göster
  splashWindow.webContents.once(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      log.error("Splash penceresi yüklenemedi:", errorCode, errorDescription);
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.show();
        splashWindow.focus();
      }
    }
  );

  // Splash penceresi kapatıldığında referansı temizle
  splashWindow.on("closed", () => {
    log.info("Splash penceresi kapatıldı");
    splashWindow = null;
  });

  // Splash penceresi kapatılmaya çalışıldığında engelle (sadece programatik olarak kapatılabilir)
  splashWindow.on("close", (event) => {
    // Eğer updateCheckCompleted true ise kapatılabilir
    if (!updateCheckCompleted) {
      log.info(
        "Splash penceresi kapatılmaya çalışıldı ama engellendi (updateCheckCompleted:",
        updateCheckCompleted,
        ")"
      );
      event.preventDefault();
    } else {
      log.info("Splash penceresi kapatılıyor (updateCheckCompleted: true)");
    }
  });
}

function createWindow() {
  const checkUpdatesOnStartup = store.get(
    "settings.checkUpdatesOnStartup",
    true
  );
  const shouldCheckUpdates = app.isPackaged && checkUpdatesOnStartup;

  // Ana pencereyi başlangıçta gizli oluştur
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#1e1e1e",
    show: false, // Başlangıçta her zaman gizli (splash tamamlandığında gösterilecek)
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  if (app.isPackaged) mainWindow.setMenu(null);
  
  // DevTools (Sadece dev ortamında otomatik aç)
  if (!app.isPackaged) {
    // mainWindow.webContents.openDevTools();
  }

  session.defaultSession.webRequest.onHeadersReceived((d, c) => {
    c({
      responseHeaders: {
        ...d.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: wss: http: ws:; img-src 'self' data: blob: https: http:; media-src 'self' data: blob: https: http:;",
        ],
      },
    });
  });

  // Context menu (sağ tık menüsü) - Admin için Inspect Element
  mainWindow.webContents.on("context-menu", (event, params) => {
    // Admin kontrolü - sadece admin için context menu göster
    if (currentUserUid && isAdminUser(currentUserUid)) {
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
    // Admin değilse context menu gösterme
  });

  const startUrl = !app.isPackaged
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../out/index.html")}`;
  mainWindow.loadURL(startUrl);

  // --- KAPATMA DAVRANIŞI (TRAY) ---
  mainWindow.on("close", (event) => {
    const closeToTray = store.get("settings.closeToTray", true); // Varsayılan true
    if (!isQuitting && closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  createTray();

  // Güncelleme kontrolü (periyodik)
  checkForUpdatesPeriodically();

  // Eğer güncelleme kontrolü yoksa direkt göster
  if (!checkUpdatesOnStartup) {
    // Splash penceresi yoksa direkt ana pencereyi göster
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();
  } else {
    // Güncelleme kontrolü varsa, timeout ile göster (5 saniye sonra)
    // Eğer güncelleme kontrolü bu süre içinde tamamlanmazsa pencereyi göster
    setTimeout(() => {
      if (!updateCheckCompleted && mainWindow) {
        updateCheckCompleted = true;
        if (splashWindow) {
          splashWindow.close();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    }, 5000);
  }

  // Renderer'dan splash tamamlandı mesajı geldiğinde pencereyi göster
  ipcMain.handle("splash-complete", () => {
    showMainWindow();
  });
}

// Ana pencereyi göster ve splash'i kapat
function showMainWindow() {
  if (!updateCheckCompleted && mainWindow) {
    updateCheckCompleted = true;
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

// --- AÇILIŞTA GÜNCELLEME KONTROLÜ ---
function checkForUpdatesPeriodically() {
  if (!app.isPackaged) return; // Sadece paketlenmiş uygulamada çalışır

  const checkUpdatesOnStartup = store.get(
    "settings.checkUpdatesOnStartup",
    true
  );
  if (!checkUpdatesOnStartup) return; // Kullanıcı kapattıysa kontrol etme

  // Her açılışta kontrol et
  autoUpdater.checkForUpdates().catch((err) => {
    log.error("Güncelleme kontrolü hatası:", err);
  });
}

// --- UPDATE EVENTS ---
let updateCheckCompleted = false;

autoUpdater.on("checking-for-update", () => {
  mainWindow?.webContents.send("update-status", "checking");
});

autoUpdater.on("update-available", (info) => {
  log.info("Güncelleme mevcut:", info.version);
  mainWindow?.webContents.send("update-status", "available", info);

  // Desktop bildirimi gönder
  if (mainWindow) {
    const { Notification } = require("electron");
    if (Notification.isSupported()) {
      new Notification({
        title: "Netrex Güncellemesi Mevcut",
        body: `Yeni sürüm ${info.version} indirilebilir.`,
        icon: app.isPackaged
          ? path.join(process.resourcesPath, "logo.ico")
          : path.join(__dirname, "../public/logo.ico"),
      }).show();
    }
  }

  // Güncellemeyi otomatik indirmeye başla
  autoUpdater.downloadUpdate();
});
autoUpdater.on("update-not-available", () => {
  mainWindow?.webContents.send("update-status", "not-available");
  // Güncelleme kontrolü tamamlandı, ana pencereyi göster
  setTimeout(() => {
    showMainWindow();
  }, 500);
});

autoUpdater.on("error", (err) => {
  mainWindow?.webContents.send("update-status", "error", err.toString());
  // Hata olsa bile ana pencereyi göster
  setTimeout(() => {
    showMainWindow();
  }, 500);
});
autoUpdater.on("download-progress", (p) =>
  mainWindow?.webContents.send("update-progress", p.percent)
);
autoUpdater.on("update-downloaded", (info) => {
  log.info("Güncelleme indirildi:", info.version);
  mainWindow?.webContents.send("update-status", "downloaded", info);

  // Desktop bildirimi gönder
  if (mainWindow) {
    const { Notification } = require("electron");
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: "Netrex Güncellemesi Hazır",
        body: "Güncelleme indirildi. Uygulamayı yeniden başlatmak için bildirime tıklayın.",
        icon: app.isPackaged
          ? path.join(process.resourcesPath, "logo.ico")
          : path.join(__dirname, "../public/logo.ico"),
      });

      notification.on("click", () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notification.show();
    }
  }
});

app.on("ready", async () => {
  if (!gotTheLock) return; // İkinci instance ise normal başlatmayı yapma

  // Windows'ta bildirim app adını düzgün göstermek için
  if (process.platform === "win32") {
    app.setAppUserModelId("Netrex Client");
  }

  if (process.platform === "darwin") {
    systemPreferences.askForMediaAccess("microphone");
    systemPreferences.askForMediaAccess("camera");
  }

  // Güncelleme kontrolü varsa önce splash penceresini oluştur
  const checkUpdatesOnStartup = store.get(
    "settings.checkUpdatesOnStartup",
    true
  );
  // Dev modunda da test için splash göster (production'da sadece app.isPackaged ise)
  const shouldShowSplash = checkUpdatesOnStartup; // Dev modunda da göster

  log.info(
    "App ready - isPackaged:",
    app.isPackaged,
    "checkUpdatesOnStartup:",
    checkUpdatesOnStartup,
    "shouldShowSplash:",
    shouldShowSplash
  );

  if (shouldShowSplash) {
    createSplashWindow();
    // Splash penceresinin yüklenmesini bekle
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  createWindow();
  try {
    setupUiohookListeners();
    uIOhook.start();
  } catch (e) {
    console.error(e);
  }
});

let isCleaningUp = false;
let cleanupTimeout = null;
let cleanupCompleteHandler = null;

// --- SIGNAL HANDLERS FOR GRACEFUL SHUTDOWN ---
// Handle SIGINT (Ctrl+C) and SIGTERM for proper cleanup
// This is important for preventing ghost participants when the app is force-killed
const handleSignal = (signal) => {
  log.info(`Received ${signal}, initiating graceful shutdown...`);
  
  if (isCleaningUp) {
    log.info("Already cleaning up, forcing exit...");
    process.exit(0);
  }
  
  isQuitting = true;
  app.quit();
};

// Only set up signal handlers in production (dev uses hot reload)
if (app.isPackaged) {
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

// --- EXIT SPLASH WINDOW ---
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  exitSplashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getExitSplashHtml())}`
  );

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

// Splash'in minimum gösterim süresi (ms)
const EXIT_SPLASH_MIN_DURATION = 1500;
let exitSplashShownAt = null;

function closeExitSplashAndQuit() {
  // Minimum gösterim süresini hesapla
  const now = Date.now();
  const elapsed = exitSplashShownAt ? now - exitSplashShownAt : EXIT_SPLASH_MIN_DURATION;
  const remainingTime = Math.max(0, EXIT_SPLASH_MIN_DURATION - elapsed);

  // Minimum süre dolmadıysa bekle
  if (remainingTime > 0) {
    setTimeout(() => {
      actuallyCloseAndQuit();
    }, remainingTime);
  } else {
    actuallyCloseAndQuit();
  }
}

function actuallyCloseAndQuit() {
  // Cleanup state'ini sıfırla
  isCleaningUp = false;
  exitSplashShownAt = null;
  
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
    cleanupTimeout = null;
  }
  
  if (cleanupCompleteHandler) {
    ipcMain.removeListener("cleanup-complete", cleanupCompleteHandler);
    cleanupCompleteHandler = null;
  }

  // Exit splash'i kapat
  if (exitSplashWindow && !exitSplashWindow.isDestroyed()) {
    exitSplashWindow.destroy();
    exitSplashWindow = null;
  }

  // uIOhook'u durdur ve çık
  try {
    uIOhook.stop();
  } catch (e) {
    // Ignore errors
  }
  
  app.exit(0);
}

app.on("before-quit", (event) => {
  // Eğer zaten cleanup yapıyorsak, tekrar başlatma
  if (isCleaningUp) {
    return;
  }

  // Cleanup başlat
  isCleaningUp = true;
  event.preventDefault(); // Kapatmayı geciktir

  // Ana pencereyi gizle ve exit splash'i göster
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  
  // Exit splash ekranını oluştur ve göster
  createExitSplashWindow();
  exitSplashShownAt = Date.now(); // Splash gösterim zamanını kaydet

  // Renderer process'e cleanup mesajı gönder
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app-will-quit");
    
    // Önceki handler'ı temizle (eğer varsa)
    if (cleanupCompleteHandler) {
      ipcMain.removeListener("cleanup-complete", cleanupCompleteHandler);
    }
    
    // Cleanup tamamlandı mesajını dinle
    cleanupCompleteHandler = () => {
      console.log("✅ Cleanup tamamlandı, uygulama kapatılıyor...");
      closeExitSplashAndQuit();
    };
    
    ipcMain.once("cleanup-complete", cleanupCompleteHandler);
    
    // Cleanup tamamlandı mesajını bekle (max 3 saniye)
    cleanupTimeout = setTimeout(() => {
      console.warn("⚠️ Cleanup timeout (3s), zorla kapatılıyor...");
      closeExitSplashAndQuit();
    }, 3000);
  } else {
    // Pencere yoksa direkt kapat (kısa gecikme ile splash görünsün)
    setTimeout(() => {
      closeExitSplashAndQuit();
    }, 500);
  }
});

app.on("will-quit", (event) => {
  // will-quit'te sadece uIOhook'u durdur
  // Cleanup zaten before-quit'te yapıldı
  uIOhook.stop();
});

// --- IPC HANDLERS ---
ipcMain.handle("start-oauth", async () => {
  try {
    const s = await startLocalAuthServer();
    await shell.openExternal(`http://127.0.0.1:${s.address().port}/login`);
  } catch (e) {
    console.error(e);
  }
});
ipcMain.handle("open-external-link", async (e, u) => {
  if (u.startsWith("http")) await shell.openExternal(u);
});
/**
 * LiveKit Token Generation
 * 
 * Parameters:
 * - room: Room name to join
 * - identity: Persistent unique identifier (userId_deviceShort)
 *             This MUST be the same for reconnections to prevent ghost participants
 * - displayName: User-friendly display name (shown in UI)
 * 
 * Why this matters for quota efficiency:
 * - If identity changes on reconnect, LiveKit thinks it's a new participant
 * - This causes "ghost participants" that drain quota until timeout
 * - Using persistent identity forces LiveKit to replace the old connection
 */
ipcMain.handle("get-livekit-token", async (e, room, identity, displayName) => {
  // Fallback for backwards compatibility: if displayName is not provided, use identity
  const name = displayName || identity;
  
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { 
      identity: identity,  // Persistent identifier (userId_deviceShort)
      name: name,          // Display name (shown to other users)
      // Token validity: shorter is better for security, but must allow for reconnects
      ttl: '24h',
    }
  );
  
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
ipcMain.handle("update-hotkey", (e, a, k) => {
  try {
    // null gönderilirse keybinding'i kaldır
    if (k === null || k === undefined) {
      const keyPath = `hotkeys.${a}`;
      try {
        // Keybinding'i sil
        store.delete(keyPath);
        // Silme işleminin başarılı olduğunu kontrol et (silinen key undefined döner)
        const afterDelete = store.get(keyPath);
        // Eğer hala bir değer varsa silme başarısız olmuş demektir
        // Ama undefined dönerse başarılı demektir
        return { success: true };
      } catch (deleteError) {
        console.error("Keybinding silme hatası:", deleteError);
        return {
          success: false,
          error: "Keybinding silinemedi: " + deleteError.message,
        };
      }
    }

  setKeybinding(a, k);
    // Keybinding'in doğru kaydedildiğini kontrol et
    const saved = getKeybinding(a);
    if (!saved || JSON.stringify(saved) !== JSON.stringify(k)) {
      return { success: false, error: "Keybinding kaydedilemedi" };
    }
  return { success: true };
  } catch (error) {
    console.error("Keybinding kaydetme hatası:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("get-hotkey", (e, a) => getKeybinding(a));
ipcMain.handle("set-recording-mode", (e, en) => {
  isRecordingMode = en;
  return { success: true };
});
ipcMain.handle("quit-and-install", () => autoUpdater.quitAndInstall());
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

// --- YENİ AYAR HANDLERLARI (TRAY İÇİN) ---
ipcMain.handle("set-setting", (e, k, v) => {
  store.set(`settings.${k}`, v);
  return true;
});
ipcMain.handle("get-setting", (e, k) => store.get(`settings.${k}`));

// Pencereyi ön plana al (bildirime tıklandığında)
ipcMain.handle("focus-window", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
});

// Path helpers for WASM files
ipcMain.handle("get-app-path", () => app.getAppPath());
ipcMain.handle("get-resources-path", () => {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, "../");
});

// Admin kontrolü ve DevTools
// Environment variable'ları oku (dotenv zaten yüklenmiş)
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";

// Admin UID kontrolü (sadece .env.local'deki UID)
function isAdminUser(userUid) {
  return ADMIN_UID && userUid && userUid === ADMIN_UID;
}

// Kullanıcı bilgilerini sakla (context menu için)
let currentUserUid = null;

ipcMain.handle("is-admin", (event, userUid) => {
  return isAdminUser(userUid);
});

ipcMain.handle("open-devtools", async (event, userUid) => {
  // Admin kontrolü
  if (!isAdminUser(userUid)) {
    log.warn("Unauthorized DevTools access attempt:", { userUid });
    return { success: false, error: "Unauthorized" };
  }

  if (mainWindow) {
    mainWindow.webContents.openDevTools();
    log.info("DevTools opened by admin:", { userUid });
    return { success: true };
  }

  return { success: false, error: "Window not found" };
});

// Kullanıcı UID'sini güncelle (context menu için)
ipcMain.handle("set-current-user-uid", (event, userUid) => {
  currentUserUid = userUid;
  return { success: true };
});
