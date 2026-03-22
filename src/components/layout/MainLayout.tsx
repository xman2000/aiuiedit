import { useState, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Toolbar } from '@/components/panels/Toolbar'
import { ComponentLibrary } from '@/components/library/ComponentLibrary'
import { DesignSystemPanel } from '@/components/panels/DesignSystemPanel'
import { Canvas } from '@/components/canvas/engine/Canvas'
import { PropertiesPanel } from '@/components/panels/PropertiesPanel'
import { ChatPanel } from '@/components/panels/ChatPanel'
import { useProjectStore } from '@/store/useProjectStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useAppStore } from '@/store/useAppStore'
import { useKeyboardShortcuts } from '@/utils/shortcuts'
import { Button } from '@/components/common/Button'
import { Plus } from 'lucide-react'
import type { CanvasNode } from '@/types'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'

export function MainLayout() {
  const { currentProject } = useProjectStore()
  const { addNode, pushHistory } = useCanvasStore()
  const [activeLeftPanel, setActiveLeftPanel] = useState<'library' | 'design'>('library')
  
  useKeyboardShortcuts()

  const handleAddComponent = (type: string) => {
    const component = BUILT_IN_COMPONENTS.find(c => c.type === type)
    if (!component) return

    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      type,
      parentId: null,
      position: { 
        x: 100 + Math.random() * 50, 
        y: 100 + Math.random() * 50 
      },
      size: { 
        width: type === 'container' ? 300 : type === 'button' ? 120 : type === 'input' ? 200 : 200, 
        height: type === 'container' ? 200 : type === 'input' ? 40 : type === 'button' ? 40 : 'auto' as any
      },
      style: component.defaultStyle,
      props: component.defaultProps,
      children: [],
      name: component.name,
      locked: false,
      visible: true
    }

    addNode(newNode)
    pushHistory()
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
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeLeftPanel === 'library'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Library
                  </button>
                  <button
                    onClick={() => setActiveLeftPanel('design')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeLeftPanel === 'design'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Design
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto">
                  {activeLeftPanel === 'library' ? <ComponentLibrary onAddComponent={handleAddComponent} /> : <DesignSystemPanel />}
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
  const { settings } = useAppStore()
  const [isCreating, setIsCreating] = useState(false)
  const [workspace, setWorkspace] = useState<string>('')

  useEffect(() => {
    // Load workspace path
    window.electron?.loadSettings().then(s => {
      setWorkspace(s?.workspacePath || '')
    }).catch(() => setWorkspace(''))
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
      </div>
    </div>
  )
}
