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
import { useKeyboardShortcuts } from '@/utils/shortcuts'
import { Button } from '@/components/common/Button'
import { Plus } from 'lucide-react'
import { createCanvasNode } from '@/core/canvasNodeFactory'
import type { CanvasNode } from '@/types'

export function MainLayout() {
  const { currentProject, setDirty } = useProjectStore()
  const { addNode } = useCanvasStore()
  const [activeLeftPanel, setActiveLeftPanel] = useState<'library' | 'pages' | 'design' | 'settings'>('library')
  
  useKeyboardShortcuts()

  const handleAddComponent = (type: string) => {
    const newNode = createCanvasNode(type)
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
  const { setCurrentProject } = useProjectStore()
  const { setNodes, setZoom, setViewport, deselectAll } = useCanvasStore()
  const [isCreating, setIsCreating] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [workspace, setWorkspace] = useState<string>('')
  const [existingProjects, setExistingProjects] = useState<Array<{ id: string; name: string; path: string; updatedAt?: string }>>([])

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

      const nodes = new Map<string, CanvasNode>((loaded.canvas?.nodes || []).map((node: CanvasNode) => [node.id, node]))
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

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Plus className="h-10 w-10 text-primary" />
        </div>
        
        <h2 className="mb-2 text-2xl font-bold">No Project Open</h2>
        
        {!workspace ? (
          <>
            <p className="mb-4 text-muted-foreground">
              You need to set up a workspace directory first. This is where all your projects will be stored.
            </p>
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>No workspace configured.</strong><br/>
                Please restart the app and complete the welcome wizard, or set a workspace in Settings.
              </p>
            </div>
          </>
        ) : (
          <p className="mb-6 text-muted-foreground">
            Create a new project in <code className="text-xs bg-muted px-1 py-0.5 rounded">{workspace}</code>
          </p>
        )}

        <Button 
          onClick={handleCreateProject}
          disabled={isCreating || !workspace}
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          {isCreating ? 'Creating...' : 'Create New Project'}
        </Button>

        {existingProjects.length > 0 && (
          <div className="mt-6 text-left">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recent Projects</p>
            <div className="space-y-2">
              {existingProjects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleOpenProject(project.path)}
                  disabled={isOpening}
                  className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
                >
                  <div className="text-sm font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground break-all">{project.path}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
