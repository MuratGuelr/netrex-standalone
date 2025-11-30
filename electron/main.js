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
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "public/logo.ico") // Prod
    : path.join(__dirname, "../public/logo.ico"); // Dev

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Netrex'i göster", click: () => mainWindow.show() },
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
  const muteKey = getKeybinding("mute");
  const deafenKey = getKeybinding("deafen");
  if (muteKey && matchesKeybinding(event, muteKey))
    mainWindow?.webContents.send("hotkey-triggered", "toggle-mute");
  else if (deafenKey && matchesKeybinding(event, deafenKey))
    mainWindow?.webContents.send("hotkey-triggered", "toggle-deafen");
}

function setupUiohookListeners() {
  uIOhook.on("keydown", (e) => handleInputEvent(e, "keyboard"));
  uIOhook.on("mousedown", (e) => {
    if (e.button !== 1 && e.button !== 2) handleInputEvent(e, "mouse");
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
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: wss:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:;",
        ],
      },
    });
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

  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
}

// --- UPDATE EVENTS ---
autoUpdater.on("checking-for-update", () =>
  mainWindow?.webContents.send("update-status", "checking")
);
autoUpdater.on("update-available", () =>
  mainWindow?.webContents.send("update-status", "available")
);
autoUpdater.on("update-not-available", () =>
  mainWindow?.webContents.send("update-status", "not-available")
);
autoUpdater.on("error", (err) =>
  mainWindow?.webContents.send("update-status", "error", err.toString())
);
autoUpdater.on("download-progress", (p) =>
  mainWindow?.webContents.send("update-progress", p.percent)
);
autoUpdater.on("update-downloaded", () =>
  mainWindow?.webContents.send("update-status", "downloaded")
);

app.on("ready", async () => {
  if (process.platform === "darwin") {
    systemPreferences.askForMediaAccess("microphone");
    systemPreferences.askForMediaAccess("camera");
  }
  createWindow();
  try {
    setupUiohookListeners();
    uIOhook.start();
  } catch (e) {
    console.error(e);
  }
});

app.on("will-quit", () => uIOhook.stop());

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
  if (!k) return { success: false };
  setKeybinding(a, k);
  return { success: true };
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
