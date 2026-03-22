export {}

declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<string>
      openExternal: (url: string) => Promise<boolean>
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
      importProjectFromSource: (sourceRoot: string) => Promise<{ path: string; project: any; canvas: any; importDebugPath?: string; analysisReportPath?: string }>
      analyzeProjectSource: (sourceRoot: string) => Promise<{
        selectedRoot: string
        candidates: Array<{
          root: string
          framework: 'nextjs' | 'react-vite' | 'laravel' | 'mixed' | 'unknown'
          entryFile: string
          pageCount: number
          samplePages: Array<{ route: string; name: string; file: string }>
        }>
        recommendedCandidateIndex: number | null
        logs: string[]
        manualEntryHints: string[]
        diagnostics: {
          rootSignals: Record<string, boolean>
          candidateRoots: string[]
        }
        reportPath?: string
      }>
      importProjectFromSourcePlan: (payload: {
        selectedRoot: string
        root: string
        framework: 'nextjs' | 'react-vite' | 'laravel' | 'mixed' | 'unknown'
        entryFile: string
      }) => Promise<{ path: string; project: any; canvas: any; importDebugPath?: string }>
      importProjectFromSourceWithEntry: (sourceRoot: string, entryFile: string) => Promise<{ path: string; project: any; canvas: any; importDebugPath?: string }>
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
      capturePreviewRoute: (payload: {
        url: string
      }) => Promise<{
        url: string
        title: string
        html: string
        blocks: Array<{ type: 'heading' | 'text' | 'button' | 'link'; text: string }>
      }>
    }
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  }
}
