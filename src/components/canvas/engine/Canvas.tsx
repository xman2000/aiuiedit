import { useRef, useEffect, useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import { CanvasNodeComponent } from '../components/CanvasNode'
import { MousePointer2, Plus } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'
import { createCanvasNode } from '@/core/canvasNodeFactory'
import { useProjectStore } from '@/store/useProjectStore'
import { useAppStore } from '@/store/useAppStore'
import { RenderedPreview } from './RenderedPreview'
import type { CanvasNode } from '@/types'

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { 
    zoom, 
    viewport, 
    nodes, 
    selectedIds,
    setZoom, 
    setViewport, 
    selectNode,
    addNode,
    setNodes,
    deselectAll,
    pushHistory
  } = useCanvasStore()
  const { currentProject, currentPage, setDirty } = useProjectStore()
  const { settings, setSettings } = useAppStore()

  const currentPageNodes = currentPage
    ? Array.from(nodes.values()).filter((node) => node.visible && (node.pageId || currentPage.id) === currentPage.id)
    : []
  
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Handle zoom with mouse wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        const newZoom = Math.max(0.1, Math.min(5, zoom + delta))
        setZoom(newZoom)
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [zoom, setZoom])

  // Handle panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or Space + left click for pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y })
      e.preventDefault()
    } else if (e.button === 0 && !e.shiftKey) {
      // Click on empty canvas to deselect
      if (e.target === e.currentTarget) {
        useCanvasStore.getState().deselectAll()
      }
    }
  }, [viewport])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewport({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }, [isPanning, panStart, setViewport])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleNodeSelect = useCallback((nodeId: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const clicked = nodes.get(nodeId)
    const parentNode = clicked?.parentId ? nodes.get(clicked.parentId) : null
    const targetId = parentNode?.type === 'group' ? parentNode.id : nodeId
    selectNode(targetId, e.metaKey || e.ctrlKey)
  }, [selectNode, nodes])

  const handleAddNode = useCallback((type: string) => {
    if (!currentProject) return

    if (!currentPage) return

    const newNode = createCanvasNode(type, currentPage.id)
    if (!newNode) return

    addNode(newNode)
    setDirty(true)
    
    // Select the new node
    useCanvasStore.getState().selectNode(newNode.id)
  }, [currentProject, currentPage, addNode, setDirty])

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
    const maxY = 740
    const columns = 3
    const gutter = 18
    const columnWidth = Math.floor((pageWidth - gutter * (columns - 1)) / columns)
    const columnHeights = Array.from({ length: columns }, () => 120)

    const placeNode = (preferredHeight: number): { x: number; y: number; width: number; canPlace: boolean } => {
      let targetIndex = 0
      for (let i = 1; i < columnHeights.length; i += 1) {
        if (columnHeights[i] < columnHeights[targetIndex]) targetIndex = i
      }

      const yPos = columnHeights[targetIndex]
      const canPlace = yPos + preferredHeight <= maxY
      const xPos = 32 + targetIndex * (columnWidth + gutter)

      if (canPlace) {
        columnHeights[targetIndex] += preferredHeight + 12
      }

      return { x: xPos, y: yPos, width: columnWidth, canPlace }
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
                  ? 'text'
                  : 'text'

      const className = block.className || ''
      const textColorFromClass = chooseTextColor(className)
      const resolvedTextColor = textColorFromClass === '#FFFFFF' ? '#111827' : textColorFromClass

      const preferredHeight =
        type === 'image'
          ? 180
          : isHeading
              ? 58
              : type === 'button'
                ? 48
                : 56

      const placement = placeNode(preferredHeight)
      if (!placement.canPlace) return

      const node = {
        id,
        type,
        pageId: currentPage.id,
        parentId: null,
        position: { x: placement.x, y: placement.y },
        size: {
          width: type === 'button' ? Math.min(placement.width, 260) : placement.width,
          height:
            type === 'image'
              ? 180
              : isHeading
                  ? 58
                  : type === 'button'
                    ? 48
                    : 56
        },
        style: type === 'button'
          ? {
              backgroundColor: '#1D4ED8',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              padding: '10px 14px',
              width: `${Math.min(placement.width, 260)}px`,
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
      {/* Page Header */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-card border-b flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Page:</span>
          <span className="text-sm text-muted-foreground">{currentPage?.name || currentProject?.pages[0]?.name || 'Home'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-md border bg-muted/30 p-0.5">
            <Button
              size="sm"
              variant={settings.canvasViewMode === 'live' ? 'ghost' : 'default'}
              className="h-7"
              onClick={() => setSettings({ canvasViewMode: 'design' })}
            >
              Design
            </Button>
            <Button
              size="sm"
              variant={settings.canvasViewMode === 'live' ? 'default' : 'ghost'}
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

      {settings.canvasViewMode === 'live' ? (
        <div className="absolute inset-x-0 bottom-0 top-10">
          <RenderedPreview currentProject={currentProject} currentPage={currentPage} onCaptureBlocks={applyRenderedCapture} />
        </div>
      ) : (
        <>
      
      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className="absolute inset-0 canvas-container cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isPanning ? 'grabbing' : 'default'
        }}
      >
        <div
          className="absolute origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`,
            width: '3000px',
            height: '3000px'
          }}
        >
          {/* Grid Background */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />

          {/* Page Frame - Visual Boundary */}
          <div 
            className="absolute border-2 border-dashed border-muted-foreground/30 bg-background shadow-lg"
            style={{
              left: '100px',
              top: '100px',
              width: '1200px',
              height: '800px',
            }}
          >
            {/* Page Label */}
            <div className="absolute -top-6 left-0 text-xs text-muted-foreground font-medium">
              Page: {currentPage?.name || currentProject?.pages[0]?.name || 'Home'} (1200×800)
            </div>
            
            {/* Render Nodes - Inside Page Frame */}
            <div className="relative w-full h-full overflow-hidden">
              {currentPageNodes.map(node => (
                <CanvasNodeComponent
                  key={node.id}
                  node={node}
                  isSelected={selectedIds.has(node.id)}
                  onSelect={handleNodeSelect(node.id)}
                  scale={zoom}
                />
              ))}

              {/* Empty State - Inside Page Frame */}
              {currentPageNodes.length === 0 && (
                <EmptyCanvas onAddNode={handleAddNode} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg border bg-card p-2 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
        >
          <span className="text-xs">−</span>
        </Button>
        
        <span className="min-w-[4rem] text-center text-xs font-medium">
          {Math.round(zoom * 100)}%
        </span>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(Math.min(5, zoom + 0.1))}
        >
          <span className="text-xs">+</span>
        </Button>

        <div className="mx-2 h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewport({ x: 0, y: 0 })}
        >
          Reset View
        </Button>
      </div>

      {/* Quick Add Panel */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="rounded-lg border bg-card p-2 shadow-lg">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Quick Add</p>
          <div className="flex flex-col gap-1">
            {BUILT_IN_COMPONENTS.slice(0, 4).map(component => (
              <Button
                key={component.type}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handleAddNode(component.type)}
              >
                <Plus className="mr-2 h-3 w-3" />
                {component.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

interface EmptyCanvasProps {
  onAddNode: (type: string) => void
}

function EmptyCanvas({ onAddNode }: EmptyCanvasProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MousePointer2 className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <p className="text-muted-foreground">
          Drag components from the library or click Quick Add
        </p>
        
        <p className="mt-2 text-sm text-muted-foreground">
          or type in the AI chat: "Add a button"
        </p>

        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => onAddNode('button')} size="sm">
            <Plus className="mr-1 h-3 w-3" />
            Button
          </Button>
          <Button onClick={() => onAddNode('text')} size="sm" variant="outline">
            <Plus className="mr-1 h-3 w-3" />
            Text
          </Button>
          <Button onClick={() => onAddNode('container')} size="sm" variant="outline">
            <Plus className="mr-1 h-3 w-3" />
            Container
          </Button>
        </div>
      </div>
    </div>
  )
}
