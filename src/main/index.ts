import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {format, pathToFileURL} from "node:url";
import * as mm from "music-metadata";
import * as Path from "node:path";
import * as fs from "node:fs";
import {homedir} from "node:os";

let secondaryWindows: Array<BrowserWindow> = [];

function createPresentationWindow(screenId: number): void {
  const targetDisplay = screen.getAllDisplays()[screenId];

  // Create the browser window.
  const window = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    title: "Media54 presentation"
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  // if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  //   window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  // } else {
  //   window.loadFile(join(__dirname, '../renderer/index.html'))
  // }

  const route = "presentation";

  const url = is.dev && process.env.ELECTRON_RENDERER_URL
      ? `${process.env.ELECTRON_RENDERER_URL}#${route}`
      : format({
        pathname: join(__dirname, '../renderer/index.html'),
        protocol: 'file:',
        hash: route,
        slashes: true,
      })

  window.loadURL(url)

  secondaryWindows.push(window);
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    title: "Media54"
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    secondaryWindows.forEach(window => {
      try {
        window.close();
      } catch {}
    });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow;
}

const supportedFormats = {
  audio: ['mp3', 'wav', 'ogg'],
  video: ['mp4', 'mkv', 'mov', 'avi'],
  image: ['svg', 'ico', 'jpg', 'png', 'jpeg', 'gif', 'bmp', 'tiff', 'avif']
}
const DATA_DIR = Path.join(homedir(), '.media54');

async function initCollection(collectionDir: string) {
  await fs.promises.mkdir(collectionDir);
  await fs.promises.writeFile(Path.join(collectionDir, "collection.json"), JSON.stringify({title: "New collection", file: []}), {encoding: "utf8"});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  let collectionDir = Path.join(DATA_DIR, `${fs.readdirSync(DATA_DIR).length}`);

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  const mainWindow = createWindow();

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  ipcMain.handle("displays", () => {
    console.log(screen.getAllDisplays());
    return screen.getAllDisplays();
  });

  ipcMain.handle("presentation", (_, index: number) => {
    createPresentationWindow(index);
  });

  ipcMain.handle("open", async () => {
    const { dialog } = await import('electron');
    if (!fs.existsSync(collectionDir)) await initCollection(collectionDir);
    let filePaths = (await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {name: 'All supported formats', extensions: [...supportedFormats.audio, ...supportedFormats.video, ...supportedFormats.image]},
        {name: 'Audio Files', extensions: supportedFormats.audio},
        {name: 'Video Files', extensions: supportedFormats.video},
        {name: 'Image Files', extensions: supportedFormats.image},
        {name: 'All files', extensions: ['*']}
      ]
    })).filePaths;
    let ret: Array<any> = [];
    for (const path of filePaths) {
      let ext = Path.parse(path).ext.substring(1).toLowerCase();
      let newPath = Path.join(collectionDir, `${(await fs.promises.readdir(collectionDir)).length}.${ext}`);
      await fs.promises.cp(path, newPath);
      ret.push({
        type: supportedFormats.audio.includes(ext) ? "audio" :
            supportedFormats.video.includes(ext) ? "video" :
                supportedFormats.image.includes(ext) ? "image" : "other",
        file: pathToFileURL(newPath).href,
        meta: [...supportedFormats.audio, ...supportedFormats.video].includes(ext)
            ? (await mm.parseFile(path)).common : undefined,
        path: newPath,
        filename: Path.parse(path).name + Path.parse(path).ext
      });
    }
    return ret;
  });

  ipcMain.handle("slide", (_, ...data) => {
    [...secondaryWindows, mainWindow].forEach(window => {
      if (!window.isDestroyed()) window.webContents.send("slide", ...data)
    });
  });

  ipcMain.handle("saveCollection", async (_, collection) => {
    if (!fs.existsSync(collectionDir)) await initCollection(collectionDir);
    await fs.promises.writeFile(Path.join(collectionDir, "collection.json"), collection, {encoding: "utf8"});
  });

  ipcMain.handle("collections", async (_) => {
    return Promise.all((await fs.promises.readdir(DATA_DIR)).map(collection => [Path.join(DATA_DIR, collection), Path.join(DATA_DIR, collection, "collection.json")]).map(async ([collectionDir, collection]) => [collectionDir, JSON.parse(await fs.promises.readFile(collection, {encoding: "utf8"})).title]));
  });

  ipcMain.handle("collection", async (_, collectionDir) => {
    return JSON.parse(await fs.promises.readFile(Path.join(collectionDir, "collection.json"), {encoding: "utf8"}));
  });

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
