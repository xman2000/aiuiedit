export {}

declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<string>
      selectDirectory: () => Promise<string | null>
      saveFileDialog: (options: {
        title?: string
        defaultPath?: string
        filters?: Array<{ name: string; extensions: string[] }>
      }) => Promise<string | null>
      writeTextFile: (filePath: string, content: string) => Promise<boolean>
      saveSettings: (settings: any) => Promise<boolean>
      loadSettings: () => Promise<any>
      listProjects: () => Promise<any[]>
      createProject: (name: string) => Promise<any>
      loadProject: (path: string) => Promise<{ project: any; canvas: any }>
      saveProject: (path: string, data: any) => Promise<boolean>
    }
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  }
}
