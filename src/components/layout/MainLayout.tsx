import { useState, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Toolbar } from '@/components/panels/Toolbar'
import { ComponentLibrary } from '@/components/library/ComponentLibrary'
import { DesignSystemPanel } from '@/components/panels/DesignSystemPanel'
import { PagesPanel } from '@/components/panels/PagesPanel'
import { SettingsPanel } from '@/components/panels/SettingsPanel'
import { Canvas } from '@/components/canvas/engine/Canvas'
import { ChatPanel } from '@/components/panels/ChatPanel'
import { useProjectStore } from '@/store/useProjectStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useAppStore } from '@/store/useAppStore'
import { useKeyboardShortcuts } from '@/utils/shortcuts'
import { Button } from '@/components/common/Button'
import { AlertTriangle, CheckCircle2, FolderOpen, FolderUp, Loader2, Plus, RotateCcw } from 'lucide-react'
import { createCanvasNode } from '@/core/canvasNodeFactory'
import type { CanvasNode } from '@/types'

export function MainLayout() {
  const { currentProject, currentPage, setDirty } = useProjectStore()
  const { addNode } = useCanvasStore()
  const [activeLeftPanel, setActiveLeftPanel] = useState<'library' | 'pages' | 'design' | 'settings'>('library')
  
  useKeyboardShortcuts()

  const handleAddComponent = (type: string) => {
    if (!currentPage) return

    const newNode = createCanvasNode(type, currentPage.id)
    if (!newNode) return

    addNode(newNode)
    setDirty(true)
  }

  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar />
      
      <div className="flex-1 overflow-hidden">
        {currentProject ? (
          <PanelGroup direction="horizontal">
            {/* Left Sidebar */}
            <Panel defaultSize={20} minSize={15} maxSize={30}>
              <div className="flex h-full flex-col border-r bg-card">
                <div className="flex border-b">
                  <button
                    onClick={() => setActiveLeftPanel('library')}
                    className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                      activeLeftPanel === 'library'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Library
                  </button>
                  <button
                    onClick={() => setActiveLeftPanel('pages')}
                    className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                      activeLeftPanel === 'pages'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Pages
                  </button>
                  <button
                    onClick={() => setActiveLeftPanel('design')}
                    className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                      activeLeftPanel === 'design'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Design
                  </button>
                  <button
                    onClick={() => setActiveLeftPanel('settings')}
                    className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                      activeLeftPanel === 'settings'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Settings
                  </button>
                </div>
                
                <div className="flex-1 min-h-0 overflow-hidden">
                  {activeLeftPanel === 'library' && <ComponentLibrary onAddComponent={handleAddComponent} />}
                  {activeLeftPanel === 'pages' && <PagesPanel />}
                  {activeLeftPanel === 'design' && <DesignSystemPanel />}
                  {activeLeftPanel === 'settings' && <SettingsPanel />}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50" />

            {/* Canvas */}
            <Panel defaultSize={80} minSize={50}>
              <Canvas />
            </Panel>
          </PanelGroup>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* AI Chat - Bottom Panel */}
      {currentProject && <ChatPanel />}
    </div>
  )
}

function EmptyState() {
  const { setSettings } = useAppStore()
  const { setCurrentProject } = useProjectStore()
  const { setNodes, setZoom, setViewport, deselectAll } = useCanvasStore()
  const [isCreating, setIsCreating] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false)
  const [importRoot, setImportRoot] = useState('')
  const [importAnalysis, setImportAnalysis] = useState<null | {
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
  }>(null)
  const [selectedImportCandidateIndex, setSelectedImportCandidateIndex] = useState<number>(0)
  const [manualEntryFile, setManualEntryFile] = useState<string>('')
  const [workspace, setWorkspace] = useState<string>('')
  const [existingProjects, setExistingProjects] = useState<Array<{ id: string; name: string; path: string; updatedAt?: string }>>([])

  const refreshProjects = async () => {
    const projects = await window.electron.listProjects()
    setExistingProjects((projects || []).sort((a: any, b: any) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    }))
  }

  useEffect(() => {
    // Load workspace path and existing projects
    Promise.all([
      window.electron?.loadSettings(),
      window.electron?.listProjects()
    ]).then(([s, projects]) => {
      setWorkspace(s?.workspacePath || '')
      setExistingProjects((projects || []).sort((a: any, b: any) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return bTime - aTime
      }))
    }).catch(() => {
      setWorkspace('')
      setExistingProjects([])
    })
  }, [])

  const handleCreateProject = async () => {
    if (!workspace) {
      window.showToast('Please set a workspace directory first in Settings', 'error')
      return
    }
    
    setIsCreating(true)
    try {
      const name = `Project-${Date.now()}`
      const project = await window.electron.createProject(name)
      setCurrentProject(project, `${workspace}/projects/${name}.canvas`)
      window.showToast('Project created!', 'success')
    } catch (error) {
      console.error('Failed to create project:', error)
      window.showToast('Failed to create project: ' + error, 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenProject = async (projectPath: string) => {
    setIsOpening(true)
    try {
      const loaded = await window.electron.loadProject(projectPath)
      setCurrentProject(loaded.project, projectPath)

      const fallbackPageId = loaded.project?.pages?.[0]?.id || 'page-1'
      const nodes = new Map<string, CanvasNode>((loaded.canvas?.nodes || []).map((node: CanvasNode) => [
        node.id,
        {
          ...node,
          pageId: node.pageId || fallbackPageId
        }
      ]))
      setNodes(nodes)
      setZoom(loaded.canvas?.zoom ?? 1)
      setViewport(loaded.canvas?.viewport ?? { x: 0, y: 0 })
      deselectAll()

      window.showToast('Project opened!', 'success')
    } catch (error) {
      console.error('Failed to open project:', error)
      window.showToast('Failed to open project', 'error')
    } finally {
      setIsOpening(false)
    }
  }

  const handleImportProject = async () => {
    try {
      const sourcePath = await window.electron.selectDirectory()
      if (!sourcePath) return

      setImportRoot(sourcePath)
      setImportAnalysis(null)
      setManualEntryFile('')
      setSelectedImportCandidateIndex(0)
      setIsImportWizardOpen(true)
      await analyzeImportRoot(sourcePath)
    } catch (error) {
      console.error('Failed to start import:', error)
      window.showToast('Failed to start import', 'error')
    }
  }

  const analyzeImportRoot = async (sourceRoot: string) => {
    setIsImporting(true)
    try {
      const analysis = await window.electron.analyzeProjectSource(sourceRoot)
      setImportAnalysis(analysis)
      setSelectedImportCandidateIndex(analysis.recommendedCandidateIndex ?? 0)
      if (analysis.reportPath) {
        window.showToast(`Analysis report saved: ${analysis.reportPath}`, 'info')
      }
    } catch (error) {
      console.error('Failed to analyze import root:', error)
      window.showToast(`Import analysis failed: ${error}`, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const hydrateImportedProject = async (imported: { path: string; project: any; canvas: any }) => {
    setCurrentProject(imported.project, imported.path)

    const fallbackPageId = imported.project?.pages?.[0]?.id || 'page-1'
    const nodes = new Map<string, CanvasNode>((imported.canvas?.nodes || []).map((node: CanvasNode) => [
      node.id,
      {
        ...node,
        pageId: node.pageId || fallbackPageId
      }
    ]))
    setNodes(nodes)
    setZoom(imported.canvas?.zoom ?? 1)
    setViewport(imported.canvas?.viewport ?? { x: 0, y: 0 })
    deselectAll()

    await refreshProjects()
  }

  const executeImportFromWizard = async () => {
    if (!importRoot) return

    setIsImporting(true)
    try {
      let imported: { path: string; project: any; canvas: any; importDebugPath?: string; analysisReportPath?: string }
      const candidate = importAnalysis?.candidates[selectedImportCandidateIndex]

      if (candidate) {
        imported = await window.electron.importProjectFromSourcePlan({
          selectedRoot: importRoot,
          root: candidate.root,
          framework: candidate.framework,
          entryFile: candidate.entryFile
        })
      } else if (manualEntryFile) {
        imported = await window.electron.importProjectFromSourceWithEntry(importRoot, manualEntryFile)
      } else {
        window.showToast('Select a detected app target or choose an entry file', 'error')
        return
      }

      await hydrateImportedProject(imported)
      setIsImportWizardOpen(false)
      setImportAnalysis(null)
      setManualEntryFile('')
      if (imported.importDebugPath) {
        window.showToast(`Import complete. Debug report: ${imported.importDebugPath}`, 'success')
      } else {
        window.showToast('Project imported. Round-trip mapping initialized.', 'success')
      }
    } catch (error) {
      console.error('Failed to import project:', error)
      window.showToast(`Import failed: ${error}`, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const handleChooseManualEntryFile = async () => {
    const selected = await window.electron.selectEntryFile(importRoot)
    if (selected) {
      setManualEntryFile(selected)
    }
  }

  const handleChangeWorkspace = async () => {
    try {
      const selected = await window.electron.selectDirectory()
      if (!selected) return

      const current = await window.electron.loadSettings()
      const nextSettings = { ...current, workspacePath: selected }
      await window.electron.saveSettings(nextSettings)
      setSettings({ workspacePath: selected })
      setWorkspace(selected)
      await refreshProjects()
      window.showToast('Workspace updated', 'success')
    } catch (error) {
      console.error('Failed to change workspace:', error)
      window.showToast('Failed to change workspace', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <FolderOpen className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Start a Project</h2>
          {!workspace ? (
            <p className="text-sm text-muted-foreground">
              Choose a workspace folder to store and discover your aiuiedit projects.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground break-all">
              Workspace: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{workspace}</code>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleCreateProject}
            disabled={isCreating || !workspace}
            size="lg"
            className="w-full"
          >
            <Plus className="mr-2 h-5 w-5" />
            {isCreating ? 'Creating Project...' : 'Create New Project'}
          </Button>

          <Button
            variant="outline"
            onClick={handleImportProject}
            disabled={isImporting || !workspace}
            size="lg"
            className="w-full"
          >
            <FolderUp className="mr-2 h-5 w-5" />
            {isImporting ? 'Importing Website...' : 'Import Existing Website'}
          </Button>

          <Button
            variant="outline"
            onClick={handleChangeWorkspace}
            size="lg"
            className="w-full"
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            {workspace ? 'Change Workspace Folder' : 'Choose Workspace Folder'}
          </Button>
        </div>

        {existingProjects.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recent Projects</p>
            <div className="space-y-2">
              {existingProjects.slice(0, 5).map((project) => (
                <Button
                  key={project.id}
                  variant="outline"
                  onClick={() => handleOpenProject(project.path)}
                  disabled={isOpening}
                  className="h-auto w-full justify-start px-3 py-2"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground">{project.name}</div>
                    <div className="text-xs text-muted-foreground break-all">{project.path}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isImportWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-xl border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Import Wizard</h3>
                <p className="text-sm text-muted-foreground">
                  We scan your project root, detect app targets, and import pages into a browsable tree.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIsImportWizardOpen(false)}>Close</Button>
            </div>

            <div className="mb-4 rounded-md border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Selected Root</p>
              <p className="mt-1 break-all text-sm">{importRoot}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const selected = await window.electron.selectDirectory()
                    if (!selected) return
                    setImportRoot(selected)
                    setImportAnalysis(null)
                    setManualEntryFile('')
                    await analyzeImportRoot(selected)
                  }}
                >
                  Change Root Folder
                </Button>
                <Button variant="outline" size="sm" onClick={() => analyzeImportRoot(importRoot)} disabled={isImporting}>
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Re-scan
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detected App Targets</p>

                {isImporting && !importAnalysis ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning project structure...
                  </div>
                ) : importAnalysis && importAnalysis.candidates.length > 0 ? (
                  <div className="space-y-2">
                    {importAnalysis.candidates.map((candidate, index) => (
                      <label key={`${candidate.root}-${candidate.entryFile}`} className="block cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="import-candidate"
                            checked={selectedImportCandidateIndex === index}
                            onChange={() => setSelectedImportCandidateIndex(index)}
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{candidate.framework} - {candidate.pageCount} pages</p>
                            <p className="truncate text-xs text-muted-foreground">root: {candidate.root}</p>
                            <p className="truncate text-xs text-muted-foreground">entry: {candidate.entryFile}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                    <div className="mb-1 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      No import targets were auto-detected.
                    </div>
                    <p className="text-xs">Use manual entry selection below.</p>
                  </div>
                )}

                <div className="mt-3 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={handleChooseManualEntryFile}>
                    Choose Entry File Manually
                  </Button>
                  {manualEntryFile && (
                    <p className="mt-2 break-all text-xs text-muted-foreground">Manual entry: {manualEntryFile}</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detection Log</p>
                <div className="h-52 overflow-auto rounded-md border bg-muted/20 p-2 text-xs">
                  {(importAnalysis?.logs?.length ? importAnalysis.logs : ['Waiting for scan...']).map((line, index) => (
                    <div key={`${line}-${index}`} className="mb-1 font-mono">
                      {line}
                    </div>
                  ))}
                </div>

                {importAnalysis?.reportPath && (
                  <p className="mt-2 break-all text-[11px] text-muted-foreground">
                    Analysis report: {importAnalysis.reportPath}
                  </p>
                )}

                {importAnalysis?.diagnostics && (
                  <div className="mt-2 rounded-md border bg-muted/20 p-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Root Signals</p>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      {Object.entries(importAnalysis.diagnostics.rootSignals).map(([signal, value]) => (
                        <div key={signal}>{signal}: {value ? 'yes' : 'no'}</div>
                      ))}
                    </div>
                  </div>
                )}

                {importAnalysis?.manualEntryHints?.length ? (
                  <div className="mt-2 rounded-md border bg-muted/20 p-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hints</p>
                    <div className="max-h-24 overflow-auto text-xs text-muted-foreground">
                      {importAnalysis.manualEntryHints.slice(0, 12).map((hint) => (
                        <div key={hint} className="truncate">{hint}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setIsImportWizardOpen(false)} disabled={isImporting}>Cancel</Button>
              <Button onClick={executeImportFromWizard} disabled={isImporting || (!manualEntryFile && !(importAnalysis?.candidates?.length))}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Import Project
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
