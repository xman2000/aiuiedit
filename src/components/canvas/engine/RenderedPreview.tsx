import { useMemo, useState } from 'react'
import { Button } from '@/components/common/Button'
import { Download, ExternalLink, RefreshCcw } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import type { Page, Project } from '@/types'

interface RenderedPreviewProps {
  currentProject: Project | null
  currentPage: Page | null
  onCaptureBlocks?: (payload: {
    title: string
    blocks: Array<{ type: 'heading' | 'text' | 'button' | 'link'; text: string }>
  }) => void
}

function joinPreviewUrl(base: string, route: string): string {
  const normalizedBase = base.trim().replace(/\/+$/, '')
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  return `${normalizedBase}${normalizedRoute}`
}

export function RenderedPreview({ currentProject, currentPage, onCaptureBlocks }: RenderedPreviewProps) {
  const { settings, setSettings } = useAppStore()
  const [draftBaseUrl, setDraftBaseUrl] = useState(settings.livePreviewBaseUrl || 'http://127.0.0.1:8000')
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)

  const route = currentPage?.route || '/'
  const isRoutePreviewable = route.startsWith('/')

  const previewUrl = useMemo(() => {
    const base = settings.livePreviewBaseUrl || 'http://127.0.0.1:8000'
    if (!isRoutePreviewable) return ''
    return joinPreviewUrl(base, route)
  }, [settings.livePreviewBaseUrl, route, isRoutePreviewable])

  const hints = useMemo(() => {
    const framework = currentProject?.source?.framework
    if (framework === 'laravel') {
      return [
        'Start your app first: `php artisan serve`',
        'If using Vite assets, also run: `npm run dev`',
        'Set Live Preview Base URL to your Laravel server (default: http://127.0.0.1:8000)'
      ]
    }
    if (framework === 'nextjs') {
      return [
        'Start your app first: `npm run dev`',
        'Set Live Preview Base URL to your Next.js dev URL (for example: http://127.0.0.1:3000)'
      ]
    }
    if (framework === 'react-vite') {
      return [
        'Start your app first: `npm run dev`',
        'Set Live Preview Base URL to your Vite URL (for example: http://127.0.0.1:5173)'
      ]
    }
    return [
      'Start your app locally in your normal dev environment.',
      'Set Live Preview Base URL to where your app is running (for example: http://127.0.0.1:8000).'
    ]
  }, [currentProject?.source?.framework])

  const saveBaseUrl = async () => {
    const nextUrl = draftBaseUrl.trim()
    if (!nextUrl) return
    const nextSettings = { ...settings, livePreviewBaseUrl: nextUrl }
    setSettings({ livePreviewBaseUrl: nextUrl })
    await window.electron.saveSettings(nextSettings)
  }

  const handleCaptureSnapshot = async () => {
    if (!previewUrl || !onCaptureBlocks) return

    setIsCapturing(true)
    try {
      const captured = await window.electron.capturePreviewRoute({ url: previewUrl })
      onCaptureBlocks({
        title: captured.title,
        blocks: captured.blocks
      })
      window.showToast(`Captured ${captured.blocks.length} blocks from rendered page`, 'success')
    } catch (error) {
      console.error('Preview capture failed:', error)
      window.showToast(`Capture failed: ${error}`, 'error')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Live Preview</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefreshToken((v) => v + 1)}>
              <RefreshCcw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (previewUrl) {
                  window.electron.openExternal(previewUrl)
                }
              }}
              disabled={!previewUrl}
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCaptureSnapshot}
              disabled={!previewUrl || isCapturing || !onCaptureBlocks}
            >
              <Download className="mr-1 h-4 w-4" />
              {isCapturing ? 'Capturing...' : 'Capture to Canvas'}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={draftBaseUrl}
            onChange={(e) => setDraftBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:8000"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <Button size="sm" onClick={saveBaseUrl}>Use URL</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Route: {route}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {!isRoutePreviewable ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <p className="text-sm font-medium">This page does not map to a browser route</p>
              <p className="mt-1 text-xs text-muted-foreground">The selected page is file-based and cannot be opened directly in live preview.</p>
            </div>
          </div>
        ) : previewUrl ? (
          <iframe
            key={`${previewUrl}-${refreshToken}`}
            src={previewUrl}
            title="Live Preview"
            className="h-full w-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">Set a valid Live Preview Base URL to render this page.</p>
          </div>
        )}
      </div>

      <div className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">
        {hints.map((hint) => (
          <div key={hint}>{hint}</div>
        ))}
      </div>
    </div>
  )
}
