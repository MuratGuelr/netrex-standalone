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

// --- LIVEKIT SSL BYPASS (Kamera/Mikrofon için) ---
// Bu komut, belirtilen HTTP adresini "Güvenli" (HTTPS gibi) kabul ettirir.
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://130.61.138.162:7880');
// Ortamdan bağımsız çalışması için gerekli olabilir
app.commandLine.appendSwitch('ignore-certificate-errors');

// Ortam Değişkenlerini Yükle
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
    break;
  }
}
require("dotenv").config({ override: false });

const store = new Store();
let mainWindow;
let splashWindow = null; // Splash penceresi
let exitSplashWindow = null; // Çıkış splash penceresi
let authServer;
let isRecordingMode = false;
let tray = null; // Tray değişkeni
let isQuitting = false; // Gerçekten çıkıyor muyuz kontrolü

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

// --- SPLASH SCREEN HTML ---
const getSplashHtml = () => `
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
        radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.15) 0%, transparent 50%);
      animation: gradient-shift 8s ease infinite;
    }
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
    }
    .logo-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 160px;
      height: 160px;
    }
    .logo-3d {
      position: relative;
      width: 120px;
      height: 120px;
    }
    .glow-ring {
      position: absolute;
      inset: -15px;
      border: 2px solid transparent;
      border-top-color: #6366f1;
      border-right-color: #a855f7;
      border-radius: 50%;
      animation: spin 3s linear infinite;
    }
    .logo-center {
      position: relative;
      width: 90px;
      height: 90px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(168, 85, 247, 0.9) 100%);
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.5);
      margin: 15px;
    }
    .logo-letter {
      color: white;
      font-weight: 900;
      font-size: 42px;
      text-shadow: 0 2px 20px rgba(255, 255, 255, 0.5);
    }
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .loading-text {
      font-size: 15px;
      color: #b5bac1;
      font-weight: 500;
    }
    .progress-wrapper {
      width: 200px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1);
      background-size: 200% 100%;
      animation: progress-move 1.5s linear infinite;
      border-radius: 4px;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    @keyframes gradient-shift { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
    @keyframes progress-move { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  <div class="main-container">
    <div class="logo-container">
      <div class="logo-3d">
        <div class="glow-ring"></div>
        <div class="logo-center">
          <div class="logo-letter">N</div>
        </div>
      </div>
    </div>
    <div class="text-container">
      <div class="loading-text" id="loadingText">Güncellemeler kontrol ediliyor</div>
      <div class="progress-wrapper">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  <script>
    let dots = '';
    const loadingText = document.getElementById('loadingText');
    setInterval(() => {
      dots = dots === '...' ? '' : dots + '.';
      loadingText.textContent = 'Güncellemeler kontrol ediliyor' + dots;
    }, 500);
  </script>
</body>
</html>
`;

// --- EXIT SPLASH SCREEN HTML ---
const getExitSplashHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex - Kapatılıyor</title>
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
        radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.15) 0%, transparent 50%);
      animation: gradient-shift 8s ease infinite;
    }
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
    }
    .logo-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 160px;
      height: 160px;
    }
    .logo-3d {
      position: relative;
      width: 120px;
      height: 120px;
    }
    .glow-ring {
      position: absolute;
      inset: -15px;
      border: 2px solid transparent;
      border-top-color: #6366f1;
      border-right-color: #a855f7;
      border-radius: 50%;
      animation: spin 3s linear infinite;
    }
    .logo-center {
      position: relative;
      width: 90px;
      height: 90px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(168, 85, 247, 0.9) 100%);
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.5);
      margin: 15px;
    }
    .logo-letter {
      color: white;
      font-weight: 900;
      font-size: 42px;
      text-shadow: 0 2px 20px rgba(255, 255, 255, 0.5);
    }
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .loading-text {
      font-size: 15px;
      color: #b5bac1;
      font-weight: 500;
    }
    .progress-wrapper {
      width: 200px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1);
      background-size: 200% 100%;
      animation: progress-move 1.5s linear infinite;
      border-radius: 4px;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    @keyframes gradient-shift { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
    @keyframes progress-move { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  <div class="main-container">
    <div class="logo-container">
      <div class="logo-3d">
        <div class="glow-ring"></div>
        <div class="logo-center">
          <div class="logo-letter">N</div>
        </div>
      </div>
    </div>
    <div class="text-container">
      <div class="loading-text" id="loadingText">Veriler kaydediliyor</div>
      <div class="progress-wrapper">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  <script>
    let dots = '';
    const loadingText = document.getElementById('loadingText');
    setInterval(() => {
      dots = dots === '...' ? '' : dots + '.';
      loadingText.textContent = 'Veriler kaydediliyor' + dots;
    }, 500);
  </script>
</body>
</html>
`;

// --- AUTH SERVER ---
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
        res.end(
          getHtmlTemplate(
            "Giriş Yap",
            `
          <h1>Netrex'e Hoşgeldin!</h1>
          <button id="loginBtn" class="btn">Google ile Giriş Yap</button>
          <div id="msg" style="margin-top:10px;color:red;"></div>
        `,
            `
          <script type="module">
            import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
            import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
            const app = initializeApp({ apiKey: "${apiKey}", authDomain: "${authDomain}" });
            const auth = getAuth(app);
            document.getElementById('loginBtn').onclick = () => {
              signInWithPopup(auth, new GoogleAuthProvider()).then(res => {
                 const cred = GoogleAuthProvider.credentialFromResult(res);
                 window.location.href = "/oauth/callback?token=" + cred.idToken;
              }).catch(e => document.getElementById('msg').innerText = e.message);
            };
          </script>
        `
          )
        );
      } else if (parsedUrl.pathname === "/oauth/callback") {
        const token = parsedUrl.query.token;
        if (token && mainWindow)
          mainWindow.webContents.send("oauth-success", token);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          getHtmlTemplate(
            "Başarılı",
            "<h1>Giriş Başarılı!</h1><p>Bu sekmeyi kapatabilirsiniz.</p>",
            "<script>setTimeout(()=>window.close(), 1000)</script>"
          )
        );
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

  // Splash HTML'ini yükle
  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml())}`
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
ipcMain.handle("get-livekit-token", async (e, r, u) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: u, name: u }
  );
  at.addGrant({
    roomJoin: true,
    room: r,
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
