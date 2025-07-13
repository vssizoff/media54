import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {format, pathToFileURL} from "node:url";
import * as mm from "music-metadata";
import * as Path from "node:path";

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
      sandbox: false
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

function createWindow(): void {
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  ipcMain.handle("displays", () => {
    return screen.getAllDisplays();
  });

  ipcMain.handle("presentation", (_, index: number) => {
    createPresentationWindow(index);
  });

  ipcMain.handle("open", async () => {
    const { dialog } = await import('electron');
    return await Promise.all((await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }]
    })).filePaths.map(async path => ({
      file: pathToFileURL(path).href,
      meta: (await mm.parseFile(path)).common,
      path,
      filename: Path.parse(path).name + Path.parse(path).ext
    })));
  });

  // ipcMain.on("selectFile", async event => {
  //   let file = await dialog.showOpenDialog({
  //     properties: ['openFile'],
  //     title: "Выберите XLSX таблицу",
  //     filters: [
  //       {name: 'Excel Files', extensions: ["xlsx"]},
  //       {name: 'All Files', extensions: ["*"]}
  //     ],
  //   });
  //   if (file.canceled) return;
  //   setEmails(file.filePaths[0], event.sender);
  // });
  //
  // ipcMain.handle("sendAll", async event => {
  //   await sendEmails(event.sender);
  // });
  //
  // ipcMain.handle("send", async (event, email: string) => {
  //   await sendEmail(email, event.sender);
  // });
  //
  // ipcMain.handle("rmAll", event => {
  //   rmAll(event.sender);
  // });
  //
  // ipcMain.handle("rm", (event, email: string) => {
  //   rm(email, event.sender);
  // });
  //
  // ipcMain.handle("getEmails", () => {
  //   return getEmails();
  // });
  //
  // ipcMain.handle("addEmail", (event, entry: EmailConfig) => {
  //   addEmail(entry, event.sender);
  // });
  //
  // ipcMain.handle("removeEmail", (event, index: number) => {
  //   removeEmail(index, event.sender);
  // });
  //
  // ipcMain.handle("editEmail", (event, index: number, entry: EmailConfig) => {
  //   editEmail(index, entry, event.sender);
  // });
  //
  // ipcMain.handle("selectEmail", (event, index: number) => {
  //   selectEmail(index, event.sender);
  // });
  //
  // ipcMain.handle("getTemplate", (_, index: number) => {
  //   return getTemplate(index);
  // });
  //
  // ipcMain.handle("getTemplates", () => {
  //   return getTemplates();
  // });
  //
  // ipcMain.handle("addTemplate", (event, name: string, sender: string, subject: string, data: string) => {
  //   addTemplate(name, sender, subject, data, event.sender);
  // });
  //
  // ipcMain.handle("removeTemplate", (event, index: number) => {
  //   removeTemplate(index, event.sender);
  // });
  //
  // ipcMain.handle("editTemplate", (event, index: number, name: string, sender: string, subject: string, data: string) => {
  //   editTemplate(index, name, sender, subject, data, event.sender);
  // });
  //
  // ipcMain.handle("selectTemplate", (event, index: number) => {
  //   selectTemplate(index, event.sender);
  // });
  //
  // ipcMain.on("readFile", async (_, title: string, filters: Array<FileFilter>) => {
  //   let file = await dialog.showOpenDialog({
  //     properties: ['openFile'],
  //     title, filters
  //   });
  //   if (file.canceled) return;
  //   return fs.readFileSync(file.filePaths[0]);
  // });

  createWindow()

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
