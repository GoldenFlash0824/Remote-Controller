const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    setItem: (key, value) => ipcRenderer.invoke('setItem', key, value),
    getItem: (key) => ipcRenderer.invoke('getItem', key),
    loadOtherHtml: (htmlFile) => ipcRenderer.send('load-other-html', htmlFile),
    getStream: () => ipcRenderer.invoke('getStream'),
    onFrameData: (callback) => ipcRenderer.on('frame-data', (event, data) => callback(data)),
});