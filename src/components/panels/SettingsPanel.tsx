import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/common/Button'
import { Settings, Eye, EyeOff, Save, FolderOpen } from 'lucide-react'

export function SettingsPanel() {
  const { settings, setSettings } = useAppStore()
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiModel, setAiModel] = useState(settings.aiModel || 'kimi-latest')
  const [workspacePath, setWorkspacePath] = useState(settings.workspacePath || '')

  useEffect(() => {
    // Load API key from settings
    if (settings.openRouterApiKey) {
      setApiKey(settings.openRouterApiKey)
    }
    setAiModel(settings.aiModel || 'kimi-latest')
    setWorkspacePath(settings.workspacePath || '')
  }, [settings.openRouterApiKey, settings.aiModel, settings.workspacePath])

  const handleSelectWorkspace = async () => {
    try {
      const selected = await window.electron.selectDirectory()
      if (selected) {
        setWorkspacePath(selected)
      }
    } catch (error) {
      console.error('Failed to select workspace directory:', error)
      window.showToast?.('Failed to select workspace directory', 'error')
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const newSettings = {
        ...settings,
        openRouterApiKey: apiKey,
        aiModel,
        workspacePath
      }
      await window.electron.saveSettings(newSettings)
      setSettings(newSettings)
      window.showToast?.('Settings saved!', 'success')
    } catch (error) {
      console.error('Failed to save settings:', error)
      window.showToast?.('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Settings</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* OpenRouter API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenRouter API Key</label>
            <p className="text-xs text-muted-foreground">
              Your API key is stored locally and never shared.
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Get your key →
              </a>
            </p>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm pr-10 outline-none focus:border-primary"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* AI Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">AI Model</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="kimi-latest">Kimi Latest (Moonshot)</option>
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="google/gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="deepseek/deepseek-chat">DeepSeek V3</option>
            </select>
          </div>

          {/* Workspace */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace</label>
            <p className="text-xs text-muted-foreground">
              Projects are created and discovered in this directory.
            </p>
            <div className="rounded-md border bg-muted p-3">
              <p className="text-sm text-muted-foreground break-all">
                {workspacePath || 'Not configured'}
              </p>
            </div>
            <Button variant="outline" onClick={handleSelectWorkspace} className="w-full">
              <FolderOpen className="mr-2 h-4 w-4" />
              Choose Workspace Folder
            </Button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="border-t p-4">
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
