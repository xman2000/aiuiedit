import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { WelcomeWizard } from '@/components/wizard/WelcomeWizard'
import { MainLayout } from '@/components/layout/MainLayout'
import { Toaster } from '@/components/common/Toaster'

function App() {
  const { settings, setSettings, isWelcomeOpen, setWelcomeOpen } = useAppStore()

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await window.electron.loadSettings()
        setSettings(loaded)
        
        // Show welcome if no workspace set
        if (!loaded.workspacePath) {
          setWelcomeOpen(true)
        } else {
          setWelcomeOpen(false)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    
    loadSettings()
  }, [])

  // Apply theme
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement
      
      if (settings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      } else {
        root.classList.toggle('dark', settings.theme === 'dark')
      }
    }
    
    applyTheme()
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme()
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.theme])

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="h-full w-full p-1">
        <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          {isWelcomeOpen ? (
            <WelcomeWizard />
          ) : (
            <MainLayout />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default App
