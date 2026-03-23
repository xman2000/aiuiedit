const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script executing...')

// API exposed to renderer process
const electronAPI = {
  // App
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // Dialog
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  selectEntryFile: (sourceRoot) => ipcRenderer.invoke('dialog:select-entry-file', sourceRoot),
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
  analyzeProjectSource: (sourceRoot) => ipcRenderer.invoke('projects:analyze-source', sourceRoot),
  importProjectFromSourcePlan: (payload) => ipcRenderer.invoke('projects:import-source-plan', payload),
  importProjectFromSourceWithEntry: (sourceRoot, entryFile) => ipcRenderer.invoke('projects:import-source-with-entry', sourceRoot, entryFile),
  refreshProjectFromSource: (projectPath) => ipcRenderer.invoke('projects:refresh-from-source', projectPath),
  loadProject: (path) => ipcRenderer.invoke('projects:load', path),
  saveProject: (path, data) => ipcRenderer.invoke('projects:save', path, data),

  // Source sync
  applySourceTextEdit: (payload) => ipcRenderer.invoke('source:apply-text-edit', payload),
  applySourcePageMetadataEdit: (payload) => ipcRenderer.invoke('source:apply-page-metadata-edit', payload),
  syncSourcePage: (payload) => ipcRenderer.invoke('source:sync-page', payload),
  applyRenderedTextEdit: (payload) => ipcRenderer.invoke('source:apply-rendered-text-edit', payload),
  applyRenderedElementEdit: (payload) => ipcRenderer.invoke('source:apply-rendered-element-edit', payload),
  applyRenderedElementDelete: (payload) => ipcRenderer.invoke('source:apply-rendered-element-delete', payload),

  // Preview
  capturePreviewRoute: (payload) => ipcRenderer.invoke('preview:capture-route', payload)
}

// Expose API to window
contextBridge.exposeInMainWorld('electron', electronAPI)

console.log('Preload script completed - electron API exposed')
