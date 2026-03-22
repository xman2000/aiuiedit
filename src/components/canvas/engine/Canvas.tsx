import { useRef, useEffect, useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import { CanvasNodeComponent } from '../components/CanvasNode'
import { MousePointer2, Plus } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'
import { useProjectStore } from '@/store/useProjectStore'
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
    pushHistory
  } = useCanvasStore()
  const { currentProject } = useProjectStore()
  
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
    selectNode(nodeId, e.metaKey || e.ctrlKey)
  }, [selectNode])

  const handleAddNode = useCallback((type: string) => {
    if (!currentProject) return

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
        height: type === 'container' ? 200 : type === 'input' ? 40 : type === 'button' ? 40 : 'auto' 
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
    
    // Select the new node
    useCanvasStore.getState().selectNode(newNode.id)
  }, [currentProject, addNode, pushHistory])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Page Header */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-card border-b flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Page:</span>
          <span className="text-sm text-muted-foreground">{currentProject?.pages[0]?.name || 'Home'}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {nodes.size} element{nodes.size !== 1 ? 's' : ''}
        </div>
      </div>
      
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
              Page: {currentProject?.pages[0]?.name || 'Home'} (1200×800)
            </div>
            
            {/* Render Nodes - Inside Page Frame */}
            <div className="relative w-full h-full overflow-hidden">
              {Array.from(nodes.values()).map(node => (
                <CanvasNodeComponent
                  key={node.id}
                  node={node}
                  isSelected={selectedIds.has(node.id)}
                  onSelect={handleNodeSelect(node.id)}
                  scale={zoom}
                />
              ))}

              {/* Empty State - Inside Page Frame */}
              {nodes.size === 0 && (
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
