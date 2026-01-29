const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;

function createTray(mainWindow, onQuit) {
  if (tray) return tray;

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "logo.ico")
    : path.join(__dirname, "../../public/logo.ico");

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
        onQuit(); // Trigger application quit sequence
      },
    },
  ]);

  tray.setToolTip("Netrex");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => mainWindow.show());
  
  return tray;
}

module.exports = { createTray };
