import { useCallback } from 'react'
import { Button } from '@/components/common/Button'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useAppStore } from '@/store/useAppStore'
import { RenderedPreview } from './RenderedPreview'
import { LayoutView } from './LayoutView'
import type { CanvasNode } from '@/types'

export function Canvas() {
  const { nodes, setNodes, deselectAll, pushHistory } = useCanvasStore()
  const { currentProject, currentPage, setDirty } = useProjectStore()
  const { settings, setSettings } = useAppStore()

  const viewMode = settings.canvasViewMode === 'live' ? 'live' : 'layout'

  const currentPageNodes = currentPage
    ? Array.from(nodes.values()).filter((node) => node.visible && (node.pageId || currentPage.id) === currentPage.id)
    : []

  const applyRenderedCapture = useCallback((payload: {
    title: string
    blocks: Array<{
      type: 'heading' | 'text' | 'button' | 'link' | 'image' | 'card'
      text: string
      src?: string
      href?: string
      className?: string
    }>
  }) => {
    if (!currentPage) return

    const keptNodes = Array.from(nodes.values()).filter((node) => node.pageId !== currentPage.id)
    const nextNodes = new Map<string, CanvasNode>()

    keptNodes.forEach((node) => nextNodes.set(node.id, node))

    const makeNodeId = () => `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const headingNode = {
      id: makeNodeId(),
      type: 'heading',
      pageId: currentPage.id,
      parentId: null,
      position: { x: 32, y: 28 },
      size: { width: 760, height: 56 },
      style: {
        color: '#111827',
        fontSize: '28px',
        fontWeight: '700',
        lineHeight: '1.25'
      },
      props: { text: payload.title || currentPage.name || 'Rendered Page', level: 1 },
      children: [],
      name: 'Heading',
      locked: false,
      visible: true
    }
    nextNodes.set(headingNode.id, headingNode as CanvasNode)

    const chooseTextColor = (className?: string): string => {
      const classes = (className || '').toLowerCase()
      if (classes.includes('text-white') || classes.includes('text-stone-50')) return '#FFFFFF'
      if (classes.includes('text-stone-600') || classes.includes('text-muted')) return '#4B5563'
      return '#111827'
    }

    const pageWidth = 1120
    const pagePadding = 36
    const contentWidth = pageWidth - pagePadding * 2
    let currentY = 108

    const estimateTextHeight = (text: string, base = 22, charsPerLine = 88): number => {
      const normalized = (text || '').trim()
      if (!normalized) return base + 10
      const lines = Math.max(1, Math.ceil(normalized.length / charsPerLine))
      return Math.min(220, base + lines * 20)
    }

    payload.blocks.slice(0, 220).forEach((block) => {
      const id = makeNodeId()
      const isHeading = block.type === 'heading'
      const type =
        isHeading
          ? 'heading'
          : block.type === 'button'
            ? 'button'
            : block.type === 'link'
              ? 'link'
              : block.type === 'image'
                ? 'image'
                  : block.type === 'card'
                    ? 'container'
                    : 'text'

      const className = block.className || ''
      const textColorFromClass = chooseTextColor(className)
      const resolvedTextColor = textColorFromClass === '#FFFFFF' ? '#111827' : textColorFromClass

      const blockText = (block.text || '').trim()

      const preferredHeight =
        type === 'image'
          ? 220
          : type === 'container'
            ? Math.max(84, estimateTextHeight(blockText, 52, 90))
            : isHeading
              ? Math.max(58, estimateTextHeight(blockText, 32, 54))
              : type === 'button'
                ? 48
                : type === 'link'
                  ? Math.max(40, estimateTextHeight(blockText, 18, 70))
                  : Math.max(52, estimateTextHeight(blockText, 24, 86))

      const x = type === 'button' ? pagePadding : pagePadding
      const width = type === 'button' ? Math.min(320, Math.max(140, blockText.length * 7 + 52)) : contentWidth

      const y = currentY
      currentY += preferredHeight + 16

      const node = {
        id,
        type,
        pageId: currentPage.id,
        parentId: null,
        position: { x, y },
        size: {
          width,
          height:
            type === 'image'
              ? 220
              : type === 'container'
                ? Math.max(84, estimateTextHeight(blockText, 52, 90))
              : isHeading
                ? Math.max(58, estimateTextHeight(blockText, 32, 54))
                : type === 'button'
                  ? 48
                  : type === 'link'
                    ? Math.max(40, estimateTextHeight(blockText, 18, 70))
                    : Math.max(52, estimateTextHeight(blockText, 24, 86))
        },
        style: type === 'button'
          ? {
              backgroundColor: '#1D4ED8',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              padding: '10px 14px',
              width: `${width}px`,
              fontWeight: '600'
            }
          : type === 'link'
            ? {
                color: '#1D4ED8',
                textDecoration: 'underline',
                fontSize: '16px'
              }
            : type === 'image'
              ? {
                  borderRadius: '10px',
                  border: '1px solid #D1D5DB',
                  objectFit: 'cover'
                }
              : type === 'container'
                ? {
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    color: '#0F172A',
                    padding: '14px'
                  }
              : {
                  color: resolvedTextColor,
                  fontSize: isHeading ? '24px' : '16px',
                  lineHeight: '1.45'
                },
        props:
          type === 'heading'
            ? { text: block.text, level: 2 }
            : type === 'text'
              ? { content: block.text }
              : type === 'button'
                ? { text: block.text }
                : type === 'container'
                  ? { content: block.text || 'Card' }
                : type === 'image'
                  ? { src: block.src || '', alt: block.text || 'Image' }
                  : { text: block.text, href: block.href || '#' },
        children: [],
        name: type[0].toUpperCase() + type.slice(1),
        locked: false,
        visible: true
      }

      nextNodes.set(id, node as CanvasNode)
    })

    setNodes(nextNodes)
    deselectAll()
    pushHistory()
    setDirty(true)
  }, [currentPage, nodes, setNodes, deselectAll, pushHistory, setDirty])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Page:</span>
          <span className="text-sm text-muted-foreground">{currentPage?.name || currentProject?.pages[0]?.name || 'Home'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-md border bg-muted/30 p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'live' ? 'ghost' : 'default'}
              className="h-7"
              onClick={() => setSettings({ canvasViewMode: 'layout' })}
            >
              Layout
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'live' ? 'default' : 'ghost'}
              className="h-7"
              onClick={() => setSettings({ canvasViewMode: 'live' })}
            >
              Live
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {currentPageNodes.length} element{currentPageNodes.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-10">
        {viewMode === 'live'
          ? <RenderedPreview currentProject={currentProject} currentPage={currentPage} onCaptureBlocks={applyRenderedCapture} />
          : <LayoutView currentPage={currentPage || undefined} />}
      </div>
    </div>
  )
}
