export {}

declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<string>
      selectDirectory: () => Promise<string | null>
      selectEntryFile: (sourceRoot?: string) => Promise<string | null>
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
      importProjectFromSource: (sourceRoot: string) => Promise<{ path: string; project: any; canvas: any }>
      importProjectFromSourceWithEntry: (sourceRoot: string, entryFile: string) => Promise<{ path: string; project: any; canvas: any }>
      refreshProjectFromSource: (projectPath: string) => Promise<{ project: any; canvas: any }>
      loadProject: (path: string) => Promise<{ project: any; canvas: any }>
      saveProject: (path: string, data: any) => Promise<boolean>
      applySourceTextEdit: (payload: {
        projectPath: string
        nodeId: string
        text: string
      }) => Promise<{ success: boolean; sourceFile: string }>
      applySourcePageMetadataEdit: (payload: {
        projectPath: string
        pageId: string
        title?: string
        description?: string
      }) => Promise<{ success: boolean; sourceFile: string }>
      syncSourcePage: (payload: {
        projectPath: string
        page: {
          id: string
          name: string
          route: string
          title?: string
          description?: string
        }
      }) => Promise<{ success: boolean; sourceFile: string; route: string }>
    }
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  }
}
