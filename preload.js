// Electron preload script
// contextIsolation is enabled; expose only what the renderer actually needs via contextBridge.
// Currently the renderer is a pure Vue 3 app that communicates over HTTP and does not
// require any Node.js APIs, so nothing is exposed here.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform
})
