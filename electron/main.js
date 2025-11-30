const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  systemPreferences,
} = require("electron");
const path = require("path");
const http = require("http");
const url = require("url");
const fs = require("fs");
const Store = require("electron-store");
const { AccessToken } = require("livekit-server-sdk");
const { uIOhook } = require("uiohook-napi");

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
let authServer;
let isRecordingMode = false;

// --- MODERN HTML ŞABLONU ---
const getHtmlTemplate = (title, bodyContent, scriptContent = "") => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #313338;
      --bg-secondary: #2b2d31;
      --text-normal: #dbdee1;
      --text-header: #f2f3f5;
      --brand: #5865F2;
      --brand-hover: #4752c4;
      --danger: #da373c;
      --success: #23a559;
    }
    
    body {
      background-color: #111214;
      color: var(--text-normal);
      font-family: 'Inter', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      overflow: hidden;
      user-select: none;
    }

    .bg-shape {
      position: absolute;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(88, 101, 242, 0.15) 0%, rgba(0,0,0,0) 70%);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: -1;
      animation: pulse 10s infinite ease-in-out;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1); }
    }
    
    .card {
      background-color: var(--bg-primary);
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      width: 100%;
      max-width: 420px;
      text-align: center;
      animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      position: relative;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    h1 { margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: var(--text-header); }
    p { margin: 0 0 28px 0; color: #949ba4; font-size: 15px; line-height: 1.5; }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 4px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      box-sizing: border-box;
    }

    .btn-google { background-color: #ffffff; color: #1f1f1f; border: 1px solid #e5e5e5; }
    .btn-google:hover { background-color: #f2f2f2; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    
    .btn-primary { background-color: var(--brand); color: white; }
    .btn-primary:hover { background-color: var(--brand-hover); }

    .btn:disabled { opacity: 0.6; cursor: not-allowed; filter: grayscale(0.5); }

    .loader {
      width: 18px; height: 18px; border: 2px solid #ccc; border-bottom-color: transparent;
      border-radius: 50%; display: inline-block; box-sizing: border-box;
      animation: rotation 1s linear infinite; margin-right: 8px; display: none;
    }

    @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .success-icon {
      width: 64px; height: 64px; background-color: rgba(35, 165, 89, 0.1); color: var(--success);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px auto; font-size: 32px;
    }

    .error-msg {
      color: var(--danger); font-size: 13px; margin-top: 15px;
      background: rgba(218, 55, 60, 0.1); padding: 10px; border-radius: 4px; display: none;
    }
  </style>
</head>
<body>
  <div class="bg-shape"></div>
  <div class="card">
    ${bodyContent}
  </div>
  ${scriptContent}
</body>
</html>
`;

// --- Auth Sunucusu ---
const startLocalAuthServer = () => {
  return new Promise((resolve) => {
    if (authServer) {
      authServer.close();
      authServer = null;
    }

    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);

      // 1. LOGIN SAYFASI
      if (parsedUrl.pathname === "/login") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

        const bodyContent = `
          <h1>Netrex'e Hoşgeldin!</h1>
          <p>Hesabına güvenli bir şekilde giriş yapmak için aşağıya tıkla.</p>
          
          <button id="loginBtn" class="btn btn-google">
            <span class="loader" id="loader"></span>
            <svg id="gIcon" width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Google ile Giriş Yap</span>
          </button>
          
          <div id="errorMsg" class="error-msg"></div>
        `;

        const scriptContent = `
          <script type="module">
            import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
            import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
            
            const app = initializeApp({ apiKey: "${apiKey}", authDomain: "${authDomain}" });
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();

            const btn = document.getElementById('loginBtn');
            const loader = document.getElementById('loader');
            const gIcon = document.getElementById('gIcon');
            const btnText = btn.querySelector('span:last-child');
            const errDiv = document.getElementById('errorMsg');

            btn.onclick = () => {
              btn.disabled = true;
              loader.style.display = 'inline-block';
              gIcon.style.display = 'none';
              btnText.innerText = "Bağlanılıyor...";
              errDiv.style.display = 'none';
              
              signInWithPopup(auth, provider)
                .then((result) => {
                   btnText.innerText = "Yönlendiriliyor...";
                   const credential = GoogleAuthProvider.credentialFromResult(result);
                   window.location.href = "/oauth/callback?token=" + credential.idToken;
                })
                .catch((error) => {
                   btn.disabled = false;
                   loader.style.display = 'none';
                   gIcon.style.display = 'block';
                   btnText.innerText = "Tekrar Dene";
                   errDiv.innerText = "Hata: " + error.message;
                   errDiv.style.display = 'block';
                });
            };
          </script>
        `;

        res.end(
          getHtmlTemplate("Giriş Yap - Netrex", bodyContent, scriptContent)
        );
      }

      // 2. CALLBACK SAYFASI (BAŞARILI)
      else if (parsedUrl.pathname === "/oauth/callback") {
        const token = parsedUrl.query.token;
        if (token) {
          if (mainWindow) mainWindow.webContents.send("oauth-success", token);

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

          const bodyContent = `
            <div class="success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1>Giriş Başarılı!</h1>
            <p>Netrex uygulamasına başarıyla giriş yaptınız. Artık bu sekmeyi kapatabilir ve uygulamaya dönebilirsiniz.</p>
            <button onclick="window.close()" class="btn btn-primary" style="margin-top: 10px;">Sekmeyi Kapat</button>
          `;

          const scriptContent = `
            <script>
              setTimeout(() => {
                try { window.close(); } catch(e){}
              }, 1000);
            </script>
          `;

          res.end(
            getHtmlTemplate("Başarılı - Netrex", bodyContent, scriptContent)
          );
        } else {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Hata: Token bulunamadı.");
        }
      } else {
        res.writeHead(404);
        res.end("Sayfa Bulunamadı");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      authServer = server;
      resolve(server);
    });
  });
};

// --- Keybinding Helper Functions ---
function getKeybinding(action) {
  const stored = store.get(`hotkeys.${action}`);
  if (!stored) return null; // String kontrolü kaldırıldı (Mouse objesi olabilir)
  return stored;
}

function setKeybinding(action, keybinding) {
  store.set(`hotkeys.${action}`, keybinding);
}

// --- GÜNCELLENMİŞ: Mouse Destekli Eşleşme Kontrolü ---
function matchesKeybinding(event, keybinding) {
  if (!keybinding) return false;

  // 1. MOUSE TUŞU KONTROLÜ
  if (keybinding.type === "mouse" || keybinding.mouseButton) {
    if (!event.button) return false; // Event mouse event'i değilse
    return keybinding.mouseButton === event.button;
  }

  // 2. KLAVYE TUŞU KONTROLÜ
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

// --- GÜNCELLENMİŞ: Ortak Olay İşleyici ---
function handleInputEvent(event, type) {
  // EĞER KAYIT MODUNDAYSA (Ayarlar ekranı açıksa)
  if (isRecordingMode && mainWindow && !mainWindow.isDestroyed()) {
    if (type === "keyboard") {
      mainWindow.webContents.send("raw-keydown", {
        type: "keyboard",
        keycode: event.keycode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
    } else if (type === "mouse") {
      mainWindow.webContents.send("raw-keydown", {
        type: "mouse",
        mouseButton: event.button, // 3=Middle, 4=Back, 5=Forward
      });
    }
    return;
  }

  // EĞER NORMAL KULLANIMDAYSA (Hotkey kontrolü)
  const muteKeybinding = getKeybinding("mute");
  const deafenKeybinding = getKeybinding("deafen");

  // Event'e type bilgisini eklemediğimiz için matchesKeybinding içinde ayrıştırdık
  // Ancak event.button mouse eventlerinde gelir, event.keycode klavye eventlerinde gelir.

  if (muteKeybinding && matchesKeybinding(event, muteKeybinding)) {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("hotkey-triggered", "toggle-mute");
  } else if (deafenKeybinding && matchesKeybinding(event, deafenKeybinding)) {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("hotkey-triggered", "toggle-deafen");
  }
}

// --- GÜNCELLENMİŞ: uIOhook Listeners ---
function setupUiohookListeners() {
  // 1. KLAVYE DİNLEYİCİSİ
  uIOhook.on("keydown", (event) => {
    handleInputEvent(event, "keyboard");
  });

  // 2. MOUSE DİNLEYİCİSİ (YENİ)
  uIOhook.on("mousedown", (event) => {
    // Sol Tık (1) ve Sağ Tık (2) atamayı engelle (Uygulama kilitlenmesin diye)
    if (event.button === 1 || event.button === 2) return;

    handleInputEvent(event, "mouse");
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // --- MENU AYARI ---
  // Sadece Production (Paketlenmiş) moddaysa menüyü kaldır
  if (app.isPackaged) {
    mainWindow.setMenu(null);
  }
  // Geliştirici (Dev) modunda varsayılan menü kalır
  // -----------------

  session.defaultSession.webRequest.onHeadersReceived((d, c) => {
    c({
      responseHeaders: {
        ...d.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: wss:;",
        ],
      },
    });
  });

  const startUrl = !app.isPackaged
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../out/index.html")}`;
  mainWindow.loadURL(startUrl);
}

app.on("ready", async () => {
  if (process.platform === "darwin")
    systemPreferences.askForMediaAccess("microphone");
  createWindow();

  try {
    setupUiohookListeners();
    uIOhook.start();
  } catch (error) {
    console.error("uIOhook Hatası:", error);
  }
});

app.on("will-quit", () => uIOhook.stop());

// --- IPC Handlers ---

// Google Login Başlat
ipcMain.handle("start-oauth", async () => {
  try {
    const server = await startLocalAuthServer();
    const port = server.address().port;
    const loginUrl = `http://127.0.0.1:${port}/login`;
    console.log("Tarayıcı açılıyor:", loginUrl);
    await shell.openExternal(loginUrl);
  } catch (err) {
    console.error("OAuth sunucusu başlatılamadı:", err);
  }
});

// Dış Link Açma
ipcMain.handle("open-external-link", async (event, url) => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    await shell.openExternal(url);
  }
});

// LiveKit Token
ipcMain.handle("get-livekit-token", async (e, room, user) => {
  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: user, name: user }
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
  } catch (error) {
    console.error("Token Hatası:", error);
    throw error;
  }
});

// Hotkeys (Güncellendi: Validation gevşetildi çünkü mouse objesi gelebilir)
ipcMain.handle("update-hotkey", (event, action, keybinding) => {
  if (!keybinding) return { success: false, error: "Geçersiz tuş." };

  setKeybinding(action, keybinding);
  return { success: true };
});

ipcMain.handle("get-hotkey", (e, action) => getKeybinding(action));
ipcMain.handle("set-recording-mode", (event, enabled) => {
  isRecordingMode = enabled;
  return { success: true };
});
