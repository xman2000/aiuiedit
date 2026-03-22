import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/common/Button'
import { Folder, Settings, ArrowRight, Check } from 'lucide-react'

export function WelcomeWizard() {
  const [step, setStep] = useState(1)
  const [workspacePath, setWorkspacePath] = useState('')
  const [projectName, setProjectName] = useState('My First Project')
  const [isLoading, setIsLoading] = useState(false)
  const [electronReady, setElectronReady] = useState(false)
  const { setSettings, setWelcomeOpen } = useAppStore()

  useEffect(() => {
    // Check if electron API is available
    if (typeof window !== 'undefined' && window.electron) {
      setElectronReady(true)
      console.log('Electron API is ready')
    } else {
      console.error('Electron API not available')
      // Try again after a short delay
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && window.electron) {
          setElectronReady(true)
          console.log('Electron API is ready (delayed)')
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleSelectDirectory = async () => {
    console.log('Select directory clicked')
    
    if (!window.electron) {
      alert('Electron API not available. Please restart the application.')
      return
    }
    
    try {
      const path = await window.electron.selectDirectory()
      console.log('Selected path:', path)
      if (path) {
        setWorkspacePath(path)
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
      alert('Error selecting directory: ' + error)
    }
  }

  const handleComplete = async () => {
    if (!workspacePath || !projectName.trim()) return

    if (!window.electron) {
      alert('Electron API not available. Please restart the application.')
      return
    }

    setIsLoading(true)
    try {
      // Save settings
      await window.electron.saveSettings({
        workspacePath,
        theme: 'system',
        aiModel: 'kimi-latest',
        recentProjects: [],
        shortcuts: {}
      })

      // Create the project
      await window.electron.createProject(projectName)

      setSettings({ workspacePath })
      setWelcomeOpen(false)
    } catch (error) {
      console.error('Failed to complete setup:', error)
      alert('Error: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-3xl font-bold">CA</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold">Welcome to aiuiedit</h1>
          <p className="text-muted-foreground">
            AI-powered visual UI builder
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {/* Electron API Warning */}
        {!electronReady && (
          <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-600">
            <p className="text-sm font-medium">⚠️ System API not ready</p>
            <p className="text-xs mt-1">Please wait a moment or restart the application if this persists.</p>
          </div>
        )}

        {/* Step 1: Introduction */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-lg border p-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Visual Design</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag-and-drop interface with 66+ components
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-lg border p-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Natural language commands to modify your designs
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-lg border p-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Export Anywhere</h3>
                  <p className="text-sm text-muted-foreground">
                    React, Vue, Next.js, or plain HTML
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Workspace Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold">Choose Workspace</h2>
              <p className="text-sm text-muted-foreground">
                Select a directory where your projects will be stored
              </p>
            </div>

            <div
              onClick={handleSelectDirectory}
              className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary hover:bg-primary/5"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectDirectory()
                }
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <Folder className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  {workspacePath ? (
                    <>
                      <p className="font-medium text-primary">Directory Selected</p>
                      <p className="mt-1 text-sm text-muted-foreground break-all">
                        {workspacePath}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Click to select directory</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose where to store your projects
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                disabled={!workspacePath}
                className="flex-1"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Project Name */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold">Name Your First Project</h2>
              <p className="text-sm text-muted-foreground">
                Give your project a meaningful name
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Project will be saved to:
                </p>
                <code className="mt-1 block text-xs break-all">
                  {workspacePath}/projects/{projectName.replace(/\s+/g, '-').toLowerCase()}.canvas
                </code>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setStep(4)} 
                disabled={!projectName.trim()}
                className="flex-1"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <Check className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Ready to Go!</h2>
              <p className="text-sm text-muted-foreground">
                Creating project:
                <br />
                <strong className="text-foreground">{projectName}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Workspace: <code className="bg-muted px-1 rounded">{workspacePath}</code>
              </p>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">What's next?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Start designing your page</li>
                <li>• Drag components from the library</li>
                <li>• Try AI commands like "add a button"</li>
              </ul>
            </div>

            <Button 
              onClick={handleComplete} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Creating Project...' : `Create "${projectName}"`}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
