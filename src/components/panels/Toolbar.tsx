import { useAppStore } from '@/store/useAppStore'
import { useProjectStore } from '@/store/useProjectStore'
import { Button } from '@/components/common/Button'
import { Moon, Sun, Monitor, Save, Undo, Redo, ZoomIn, ZoomOut } from 'lucide-react'

export function Toolbar() {
  const { settings, setSettings } = useAppStore()
  const { currentProject, isDirty, saveProject } = useProjectStore()

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
          disabled={!currentProject || !isDirty}
        >
          <Save className="h-4 w-4" />
        </Button>
        
        <div className="h-4 w-px bg-border" />
        
        <Button variant="ghost" size="icon" disabled>
          <Undo className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon" disabled>
          <Redo className="h-4 w-4" />
        </Button>
        
        <div className="h-4 w-px bg-border" />
        
        <Button variant="ghost" size="icon">
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <span className="min-w-[3rem] text-center text-xs text-muted-foreground">100%</span>
        
        <Button variant="ghost" size="icon">
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
