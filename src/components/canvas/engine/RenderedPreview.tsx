import { useEffect, useMemo, useRef, useState } from 'react'
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

type PreviewMode = 'embedded' | 'snapshot'

function joinPreviewUrl(base: string, route: string): string {
  const normalizedBase = base.trim().replace(/\/+$/, '')
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  return `${normalizedBase}${normalizedRoute}`
}

function injectBaseTag(html: string, url: string): string {
  const baseTag = `<base href="${url.replace(/"/g, '&quot;')}" />`
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (match) => `${match}${baseTag}`)
  }
  return `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`
}

export function RenderedPreview({ currentProject, currentPage, onCaptureBlocks }: RenderedPreviewProps) {
  const { settings, setSettings } = useAppStore()
  const [draftBaseUrl, setDraftBaseUrl] = useState(settings.livePreviewBaseUrl || 'http://127.0.0.1:8000')
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)
  const [snapshotHtml, setSnapshotHtml] = useState('')
  const [snapshotTitle, setSnapshotTitle] = useState('Rendered Page')
  const [snapshotBlocks, setSnapshotBlocks] = useState<Array<{ type: 'heading' | 'text' | 'button' | 'link'; text: string }>>([])
  const [previewMode, setPreviewMode] = useState<PreviewMode>('embedded')
  const [statusMessage, setStatusMessage] = useState('')
  const [embeddedLoaded, setEmbeddedLoaded] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const route = currentPage?.route || '/'
  const isRoutePreviewable = route.startsWith('/')

  const previewUrl = useMemo(() => {
    const base = settings.livePreviewBaseUrl || 'http://127.0.0.1:8000'
    if (!isRoutePreviewable) return ''
    return joinPreviewUrl(base, route)
  }, [settings.livePreviewBaseUrl, route, isRoutePreviewable])

  const snapshotDocument = useMemo(() => {
    if (!snapshotHtml || !previewUrl) return ''
    return injectBaseTag(snapshotHtml, previewUrl)
  }, [snapshotHtml, previewUrl])

  const hints = useMemo(() => {
    const framework = currentProject?.source?.framework
    if (framework === 'laravel') {
      return [
        'Start your app first: `php artisan serve`',
        'If using Vite assets, also run: `npm run dev`',
        'If embedded mode stays blank, switch to Snapshot mode (bypasses frame restrictions).'
      ]
    }
    if (framework === 'nextjs') {
      return [
        'Start your app first: `npm run dev`',
        'Set Live Preview Base URL to your Next.js dev URL (for example: http://127.0.0.1:3000).'
      ]
    }
    return [
      'Start your app locally in your normal dev environment.',
      'If embedded mode is blank, use Snapshot mode and Capture to Canvas.'
    ]
  }, [currentProject?.source?.framework])

  const saveBaseUrl = async () => {
    const nextUrl = draftBaseUrl.trim()
    if (!nextUrl) return
    const nextSettings = { ...settings, livePreviewBaseUrl: nextUrl }
    setSettings({ livePreviewBaseUrl: nextUrl })
    await window.electron.saveSettings(nextSettings)
  }

  const loadSnapshot = async () => {
    if (!previewUrl) return
    setIsLoadingSnapshot(true)
    try {
      const captured = await window.electron.capturePreviewRoute({ url: previewUrl })
      setSnapshotHtml(captured.html)
      setSnapshotTitle(captured.title)
      setSnapshotBlocks(captured.blocks)
      setStatusMessage(`Snapshot loaded: ${captured.blocks.length} content blocks detected`)
    } catch (error) {
      console.error('Snapshot load failed:', error)
      setStatusMessage(`Snapshot failed: ${error}`)
    } finally {
      setIsLoadingSnapshot(false)
    }
  }

  useEffect(() => {
    setEmbeddedLoaded(false)
    if (!previewUrl) return

    loadSnapshot()

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (!embeddedLoaded && previewMode === 'embedded') {
        setStatusMessage('Embedded preview appears blocked or unavailable; switched to Snapshot mode.')
        setPreviewMode('snapshot')
      }
    }, 6000)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [previewUrl, refreshToken])

  const handleCaptureToCanvas = async () => {
    if (!onCaptureBlocks) return

    setIsCapturing(true)
    try {
      if (!snapshotBlocks.length) {
        await loadSnapshot()
      }

      onCaptureBlocks({
        title: snapshotTitle,
        blocks: snapshotBlocks
      })
      window.showToast(`Captured ${snapshotBlocks.length} blocks from rendered page`, 'success')
    } catch (error) {
      console.error('Capture failed:', error)
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
              onClick={() => previewUrl && window.electron.openExternal(previewUrl)}
              disabled={!previewUrl}
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCaptureToCanvas}
              disabled={!previewUrl || isCapturing || isLoadingSnapshot || !onCaptureBlocks}
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

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Route: {route}</p>
          <div className="rounded-md border bg-muted/30 p-0.5">
            <Button size="sm" variant={previewMode === 'embedded' ? 'default' : 'ghost'} className="h-7" onClick={() => setPreviewMode('embedded')}>
              Embedded
            </Button>
            <Button size="sm" variant={previewMode === 'snapshot' ? 'default' : 'ghost'} className="h-7" onClick={() => setPreviewMode('snapshot')}>
              Snapshot
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-white">
        {!isRoutePreviewable ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">This page does not map to a browser route.</p>
          </div>
        ) : previewMode === 'embedded' ? (
          <iframe
            key={`embedded-${previewUrl}-${refreshToken}`}
            src={previewUrl}
            title="Embedded Live Preview"
            className="h-full w-full border-0"
            onLoad={() => {
              setEmbeddedLoaded(true)
              setStatusMessage('Embedded preview loaded')
            }}
          />
        ) : snapshotDocument ? (
          <iframe
            key={`snapshot-${previewUrl}-${refreshToken}`}
            srcDoc={snapshotDocument}
            title="Snapshot Preview"
            className="h-full w-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading snapshot preview...</p>
          </div>
        )}
      </div>

      <div className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">
        {statusMessage && <div className="mb-1">{statusMessage}</div>}
        {hints.map((hint) => (
          <div key={hint}>{hint}</div>
        ))}
      </div>
    </div>
  )
}
