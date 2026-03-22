const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script executing...')

// API exposed to renderer process
const electronAPI = {
  // App
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Dialog
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:save-file', options),

  // File system
  writeTextFile: (filePath, content) => ipcRenderer.invoke('file:write-text', filePath, content),

  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load'),

  // Projects
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name) => ipcRenderer.invoke('projects:create', name),
  importProjectFromSource: (sourceRoot) => ipcRenderer.invoke('projects:import-source', sourceRoot),
  refreshProjectFromSource: (projectPath) => ipcRenderer.invoke('projects:refresh-from-source', projectPath),
  loadProject: (path) => ipcRenderer.invoke('projects:load', path),
  saveProject: (path, data) => ipcRenderer.invoke('projects:save', path, data),

  // Source sync
  applySourceTextEdit: (payload) => ipcRenderer.invoke('source:apply-text-edit', payload),
  applySourcePageMetadataEdit: (payload) => ipcRenderer.invoke('source:apply-page-metadata-edit', payload),
  syncSourcePage: (payload) => ipcRenderer.invoke('source:sync-page', payload)
}

// Expose API to window
contextBridge.exposeInMainWorld('electron', electronAPI)

console.log('Preload script completed - electron API exposed')
