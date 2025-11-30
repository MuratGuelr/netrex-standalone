const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  systemPreferences,
  dialog,
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
    /* ... (CSS Kodları aynen kalacak) ... */
    :root { --bg-primary: #313338; --bg-secondary: #2b2d31; --text-normal: #dbdee1; --text-header: #f2f3f5; --brand: #5865F2; --brand-hover: #4752c4; --danger: #da373c; --success: #23a559; }
    body { background-color: #111214; color: var(--text-normal); font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; overflow: hidden; user-select: none; }
    /* ... (Diğer stiller aynen kalacak, yer kaplamaması için kısalttım) ... */
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
          <button id="loginBtn" class="btn btn-google">Google ile Giriş Yap</button>
          <div id="errorMsg" class="error-msg"></div>
        `;
        // ... (Script içeriği aynen kalacak)
        const scriptContent = `
          <script type="module">
            import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
            import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
            const app = initializeApp({ apiKey: "${apiKey}", authDomain: "${authDomain}" });
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();
            document.getElementById('loginBtn').onclick = () => {
              signInWithPopup(auth, provider).then((result) => {
                   const credential = GoogleAuthProvider.credentialFromResult(result);
                   window.location.href = "/oauth/callback?token=" + credential.idToken;
                }).catch((error) => { document.getElementById('errorMsg').innerText = error.message; });
            };
          </script>
        `;
        res.end(
          getHtmlTemplate("Giriş Yap - Netrex", bodyContent, scriptContent)
        );
      }
      // 2. CALLBACK SAYFASI
      else if (parsedUrl.pathname === "/oauth/callback") {
        const token = parsedUrl.query.token;
        if (token) {
          if (mainWindow) mainWindow.webContents.send("oauth-success", token);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            getHtmlTemplate(
              "Başarılı",
              "<h1>Giriş Başarılı!</h1><p>Sekmeyi kapatabilirsiniz.</p>",
              "<script>setTimeout(() => window.close(), 1000);</script>"
            )
          );
        } else {
          res.writeHead(400);
          res.end("Token yok.");
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

// ... (Keybinding Helper Functions - getKeybinding, setKeybinding, matchesKeybinding, handleInputEvent - AYNI KALACAK) ...
function getKeybinding(action) {
  const stored = store.get(`hotkeys.${action}`);
  return stored || null;
}
function setKeybinding(action, keybinding) {
  store.set(`hotkeys.${action}`, keybinding);
}
function matchesKeybinding(event, keybinding) {
  if (!keybinding) return false;
  if (keybinding.type === "mouse" || keybinding.mouseButton) {
    if (!event.button) return false;
    return keybinding.mouseButton === event.button;
  }
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
        mouseButton: event.button,
      });
    }
    return;
  }
  const muteKeybinding = getKeybinding("mute");
  const deafenKeybinding = getKeybinding("deafen");
  if (muteKeybinding && matchesKeybinding(event, muteKeybinding)) {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("hotkey-triggered", "toggle-mute");
  } else if (deafenKeybinding && matchesKeybinding(event, deafenKeybinding)) {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("hotkey-triggered", "toggle-deafen");
  }
}

function setupUiohookListeners() {
  uIOhook.on("keydown", (event) => handleInputEvent(event, "keyboard"));
  uIOhook.on("mousedown", (event) => {
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

  if (app.isPackaged) mainWindow.setMenu(null);

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

  // --- AUTO UPDATE CHECK ---
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// --- AUTO UPDATER EVENTS ---
autoUpdater.on("checking-for-update", () => {
  log.info("Checking for update...");
  if (mainWindow) mainWindow.webContents.send("update-status", "checking");
});
autoUpdater.on("update-available", (info) => {
  log.info("Update available.");
  if (mainWindow) mainWindow.webContents.send("update-status", "available");
});
autoUpdater.on("update-not-available", (info) => {
  log.info("Update not available.");
  if (mainWindow) mainWindow.webContents.send("update-status", "not-available");
});
autoUpdater.on("error", (err) => {
  log.error("Error in auto-updater. " + err);
  if (mainWindow)
    mainWindow.webContents.send("update-status", "error", err.toString());
});
autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow)
    mainWindow.webContents.send("update-progress", progressObj.percent);
});
autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded");
  if (mainWindow) mainWindow.webContents.send("update-status", "downloaded");
});

app.on("ready", async () => {
  if (process.platform === "darwin")
    systemPreferences.askForMediaAccess("microphone");
  createWindow();
  try {
    setupUiohookListeners();
    uIOhook.start();
  } catch (error) {
    console.error("uIOhook Error:", error);
  }
});

app.on("will-quit", () => uIOhook.stop());

// --- IPC Handlers ---
ipcMain.handle("start-oauth", async () => {
  try {
    const server = await startLocalAuthServer();
    const port = server.address().port;
    const loginUrl = `http://127.0.0.1:${port}/login`;
    await shell.openExternal(loginUrl);
  } catch (err) {
    console.error("OAuth Error:", err);
  }
});

ipcMain.handle("open-external-link", async (event, url) => {
  if (url.startsWith("http://") || url.startsWith("https://"))
    await shell.openExternal(url);
});

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
    console.error("Token Error:", error);
    throw error;
  }
});

ipcMain.handle("update-hotkey", (event, action, keybinding) => {
  if (!keybinding) return { success: false, error: "Invalid key." };
  setKeybinding(action, keybinding);
  return { success: true };
});

ipcMain.handle("get-hotkey", (e, action) => getKeybinding(action));
ipcMain.handle("set-recording-mode", (event, enabled) => {
  isRecordingMode = enabled;
  return { success: true };
});

// -- UPDATE IPC --
ipcMain.handle("quit-and-install", () => {
  autoUpdater.quitAndInstall();
});
