const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');

let store;
let mainWindow;
let tray;
let isWindowClosed = false;
let server;
let cppProgram;
let latestBmpData = null;

async function initializeStore() {
    const { default: Store } = await import('electron-store');
    store = new Store();
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 550,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
        }
    });

    const isConnected = store.get('VantageMDMScreenCastingConnect', false);
    if (isConnected) {
        mainWindow.loadFile('main.html');
    } else {
        mainWindow.loadFile('index.html');
    }

    mainWindow.on('minimize', function (event) {
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        } else {
            isWindowClosed = true;
            if (server) server.close();
            if (cppProgram) cppProgram.kill();
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('trigger-button-click');
    });

    ipcMain.handle('show-message-box', async (event, options) => {
        const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), options);
        return result;
    });

    ipcMain.on('load-other-html', async (event, htmlFile) => {
        if (mainWindow) {
            mainWindow.loadFile(htmlFile);
        }
    });

    ipcMain.handle('setItem', (event, key, value) => {
        store.set(key, value);
    });

    ipcMain.handle('getItem', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('get-stream', async (event) => {
        return latestBmpData ? latestBmpData : null;
    });

    // const exePath = path.join(__dirname, 'ScreenCapture.exe');
    const exePath = path.join(__dirname, 'SystemLevelScreenCapture.exe');
    if (!fs.existsSync(exePath)) {
        console.error(`Executable not found at: ${exePath}`);
    }

    cppProgram = spawn(exePath);

    cppProgram.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    cppProgram.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    cppProgram.on('close', (code) => {
        console.log(`C++ program exited with code ${code}`);
    });

    server = net.createServer((socket) => {
        let fileBuffer = Buffer.alloc(0);

        socket.on('data', (data) => {
            fileBuffer = Buffer.concat([fileBuffer, data]);

            while (fileBuffer.length >= 54) {
                const fileSize = fileBuffer.readUInt32LE(2);
                if (fileBuffer.length >= fileSize) {
                    const bmpData = fileBuffer.slice(0, fileSize);
                    if (!isWindowClosed && mainWindow) {
                        latestBmpData = bmpData;
                        mainWindow.webContents.send('frame-data', latestBmpData);
                    }
                    fileBuffer = fileBuffer.slice(fileSize);
                    // saveBitmapToFile(bmpData);
                } else {
                    break;
                }
            }
        });

        socket.on('end', () => {
            console.log('Client disconnected');
        });

        socket.on('error', (err) => {
            console.error(`Socket error: ${err}`);
        });
    });

    server.listen(12345, '127.0.0.1', () => {
        console.log(`Server listening on port 12345`);
    });
}

function saveBitmapToFile(bmpData) {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const filepath = path.join(__dirname, `capture_${timestamp}.bmp`);

    fs.writeFile(filepath, bmpData, (err) => {
        if (err) {
            console.error("Failed to save bitmap file: ${err}");
        } else {
            console.log(`Bitmap saved to file: ${filepath}`);
        }
    })
}

app.whenReady().then(async () => {
    await initializeStore();
    createWindow();
    tray = new Tray(path.join(__dirname, 'img', '128x128.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App', click: function () {
                mainWindow.show();
            }
        },
        {
            label: 'Quit', click: function () {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('ScreenShareApp');
    tray.setContextMenu(contextMenu);

    tray.on('click', function () {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
});

app.on("before-quit", async () => {
    if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.send('stop-screensharing');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        await initializeStore();
        createWindow();
    }
});
