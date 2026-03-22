import { contextBridge, ipcRenderer } from 'electron'

console.log('Preload script executing...')

// API exposed to renderer process
const electronAPI = {
  // App
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Dialog
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

  // Settings
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load'),

  // Projects
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name: string) => ipcRenderer.invoke('projects:create', name),
  loadProject: (path: string) => ipcRenderer.invoke('projects:load', path),
  saveProject: (path: string, data: any) => ipcRenderer.invoke('projects:save', path, data)
}

// Expose API to window
contextBridge.exposeInMainWorld('electron', electronAPI)

console.log('Preload script completed - electron API exposed')
