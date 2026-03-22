import { useAppStore } from '@/store/useAppStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { Button } from '@/components/common/Button'
import { Moon, Sun, Monitor, Save, Undo, Redo, ZoomIn, ZoomOut, FileCode, FileText, Group, Ungroup, Lock, Unlock, Eye, EyeOff, RefreshCcw } from 'lucide-react'
import { exportAsHtml, exportAsReact, exportAsVue } from '@/services/export'

export function Toolbar() {
  const { settings, setSettings } = useAppStore()
  const { currentProject, projectPath, isDirty, saveProject, setCurrentProject, setDirty } = useProjectStore()
  const {
    nodes,
    selectedIds,
    zoom,
    setZoom,
    setNodes,
    setViewport,
    deselectAll,
    undo,
    redo,
    canUndo,
    canRedo,
    alignSelected,
    distributeSelected,
    groupSelected,
    ungroupSelected,
    toggleLockSelected,
    toggleVisibilitySelected
  } = useCanvasStore()

  const selectedCount = selectedIds.size
  const selectedNodes = Array.from(selectedIds).map((id) => nodes.get(id)).filter(Boolean)
  const hasUnlockedSelected = selectedNodes.some((node) => !node?.locked)
  const hasHiddenSelected = selectedNodes.some((node) => !node?.visible)

  const toggleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(settings.theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setSettings({ theme: nextTheme })
    window.electron.saveSettings({ ...settings, theme: nextTheme })
  }

  const handleSave = async () => {
    if (!currentProject) return
    try {
      await saveProject()
      window.showToast('Project saved!', 'success')
    } catch (error) {
      window.showToast('Failed to save', 'error')
    }
  }

  const handleExport = async (format: 'html' | 'react' | 'vue') => {
    if (!currentProject) return

    try {
      const sortedNodes = Array.from(nodes.values()).sort((a, b) => {
        if (a.position.y === b.position.y) return a.position.x - b.position.x
        return a.position.y - b.position.y
      })

      const content = format === 'html'
        ? exportAsHtml(currentProject, sortedNodes)
        : format === 'react'
          ? exportAsReact(currentProject, sortedNodes)
          : exportAsVue(currentProject, sortedNodes)

      const extension = format === 'html' ? 'html' : format === 'react' ? 'tsx' : 'vue'
      const savePath = await window.electron.saveFileDialog({
        title: `Export ${format.toUpperCase()} File`,
        defaultPath: `${currentProject.name}.${extension}`,
        filters: [
          {
            name: format === 'html' ? 'HTML' : format === 'react' ? 'TypeScript React' : 'Vue Single File Component',
            extensions: [extension]
          }
        ]
      })

      if (!savePath) return

      await window.electron.writeTextFile(savePath, content)
      window.showToast(`${format.toUpperCase()} export completed`, 'success')
    } catch (error) {
      console.error('Export failed:', error)
      window.showToast('Export failed', 'error')
    }
  }

  const handleAlign = (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedCount === 0) return
    alignSelected(mode)
    setDirty(true)
  }

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    if (selectedCount < 3) return
    distributeSelected(axis)
    setDirty(true)
  }

  const handleGroup = () => {
    if (selectedCount < 2) return
    groupSelected()
    setDirty(true)
  }

  const handleUngroup = () => {
    if (selectedCount === 0) return
    ungroupSelected()
    setDirty(true)
  }

  const handleToggleLock = () => {
    if (selectedCount === 0) return
    toggleLockSelected()
    setDirty(true)
  }

  const handleToggleVisibility = () => {
    if (selectedCount === 0) return
    toggleVisibilitySelected()
    setDirty(true)
  }

  const handleRefreshFromSource = async () => {
    if (!currentProject?.source?.roundTrip || !projectPath) return

    try {
      const refreshed = await window.electron.refreshProjectFromSource(projectPath)
      setCurrentProject(refreshed.project, projectPath)
      setNodes(new Map((refreshed.canvas?.nodes || []).map((node: any) => [node.id, node])))
      setZoom(refreshed.canvas?.zoom ?? 1)
      setViewport(refreshed.canvas?.viewport ?? { x: 0, y: 0 })
      deselectAll()
      window.showToast('Canvas refreshed from source files', 'success')
    } catch (error) {
      console.error('Refresh from source failed:', error)
      window.showToast(`Refresh failed: ${error}`, 'error')
    }
  }

  return (
    <div className="flex h-14 items-center justify-between border-b bg-card px-4">
      {/* Left: Logo and Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          CA
        </div>
        
        {currentProject && (
          <div className="flex items-center gap-2">
            <span className="font-medium">{currentProject.name}</span>
            {isDirty && (
              <span className="text-xs text-muted-foreground">• Modified</span>
            )}
          </div>
        )}
      </div>

      {/* Center: Actions */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleSave}
          disabled={!currentProject}
        >
          <Save className="h-4 w-4" />
        </Button>

        {currentProject?.source?.roundTrip && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshFromSource}
            title="Refresh from source"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleExport('html')}
          disabled={!currentProject}
          title="Export HTML"
        >
          <FileText className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleExport('react')}
          disabled={!currentProject}
          title="Export React (TSX)"
        >
          <FileCode className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleExport('vue')}
          disabled={!currentProject}
          title="Export Vue (.vue)"
        >
          Vue
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" disabled={selectedCount < 2} onClick={handleGroup} title="Group selected">
          <Group className="h-4 w-4 mr-1" />
          Group
        </Button>

        <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={handleUngroup} title="Ungroup selected groups">
          <Ungroup className="h-4 w-4 mr-1" />
          Ungroup
        </Button>

        <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={handleToggleLock} title="Toggle lock">
          {hasUnlockedSelected ? <Lock className="h-4 w-4 mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
          {hasUnlockedSelected ? 'Lock' : 'Unlock'}
        </Button>

        <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={handleToggleVisibility} title="Toggle visibility">
          {hasHiddenSelected ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
          {hasHiddenSelected ? 'Show' : 'Hide'}
        </Button>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={() => handleAlign('left')} title="Align Left">L</Button>
          <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={() => handleAlign('center')} title="Align Center">C</Button>
          <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={() => handleAlign('right')} title="Align Right">R</Button>
          <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={() => handleAlign('top')} title="Align Top">T</Button>
          <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={() => handleAlign('middle')} title="Align Middle">M</Button>
          <Button variant="ghost" size="sm" disabled={selectedCount === 0} onClick={() => handleAlign('bottom')} title="Align Bottom">B</Button>
        </div>

        <div className="h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" disabled={selectedCount < 3} onClick={() => handleDistribute('horizontal')} title="Distribute Horizontally">
          Dist H
        </Button>

        <Button variant="ghost" size="sm" disabled={selectedCount < 3} onClick={() => handleDistribute('vertical')} title="Distribute Vertically">
          Dist V
        </Button>

        {selectedCount > 0 && (
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
        )}
        
        <Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo}>
          <Undo className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon" disabled={!canRedo} onClick={redo}>
          <Redo className="h-4 w-4" />
        </Button>
        
        <div className="h-4 w-px bg-border" />
        
        <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <span className="min-w-[3rem] text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        
        <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(5, zoom + 0.1))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: Theme and Settings */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {settings.theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : settings.theme === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
