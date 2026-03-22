import { useState, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Toolbar } from '@/components/panels/Toolbar'
import { ComponentLibrary } from '@/components/library/ComponentLibrary'
import { DesignSystemPanel } from '@/components/panels/DesignSystemPanel'
import { PagesPanel } from '@/components/panels/PagesPanel'
import { SettingsPanel } from '@/components/panels/SettingsPanel'
import { Canvas } from '@/components/canvas/engine/Canvas'
import { PropertiesPanel } from '@/components/panels/PropertiesPanel'
import { ChatPanel } from '@/components/panels/ChatPanel'
import { useProjectStore } from '@/store/useProjectStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useAppStore } from '@/store/useAppStore'
import { useKeyboardShortcuts } from '@/utils/shortcuts'
import { Button } from '@/components/common/Button'
import { FolderOpen, FolderUp, Plus } from 'lucide-react'
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
                
                <div className="flex-1 overflow-auto">
                  {activeLeftPanel === 'library' && <ComponentLibrary onAddComponent={handleAddComponent} />}
                  {activeLeftPanel === 'pages' && <PagesPanel />}
                  {activeLeftPanel === 'design' && <DesignSystemPanel />}
                  {activeLeftPanel === 'settings' && <SettingsPanel />}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50" />

            {/* Canvas */}
            <Panel defaultSize={55} minSize={30}>
              <Canvas />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50" />

            {/* Right Sidebar */}
            <Panel defaultSize={25} minSize={20} maxSize={35}>
              <div className="flex h-full flex-col border-l bg-card">
                <PropertiesPanel />
              </div>
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
    setIsImporting(true)
    try {
      const sourcePath = await window.electron.selectDirectory()
      if (!sourcePath) return

      let imported: { path: string; project: any; canvas: any }

      try {
        imported = await window.electron.importProjectFromSource(sourcePath)
      } catch (error) {
        const message = String(error)
        const detectionFailed = message.includes('Could not detect an entry file')

        if (!detectionFailed) {
          throw error
        }

        const selectedEntry = await window.electron.selectEntryFile(sourcePath)
        if (!selectedEntry) {
          window.showToast('Import canceled: no entry file selected', 'info')
          return
        }

        imported = await window.electron.importProjectFromSourceWithEntry(sourcePath, selectedEntry)
      }

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

      window.showToast('Project imported. Round-trip mapping initialized.', 'success')
    } catch (error) {
      console.error('Failed to import project:', error)
      window.showToast(`Import failed: ${error}`, 'error')
    } finally {
      setIsImporting(false)
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
    </div>
  )
}
