import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Type, Heading1, Image as ImageIcon, Link2, MousePointer, Square, Layout, Layers, Maximize2, RefreshCw, Loader2, Move, Target } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useAppStore } from '@/store/useAppStore'
import type { Page } from '@/types'

interface LayoutViewProps {
  currentPage?: Page
}

interface WireframeElement {
  id: string
  tag: string
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  text: string
  className: string
  children: string[]
  parentId: string | null
  level: number
  isStructural: boolean
  attributes: {
    href?: string
    src?: string
    alt?: string
  }
}

interface WireframeData {
  url: string
  title: string
  elements: WireframeElement[]
  pageWidth: number
  pageHeight: number
}

function getElementLabel(el: WireframeElement): string {
  if (el.text) {
    const text = el.text.trim()
    if (text.length > 0) {
      return text.length > 25 ? text.slice(0, 24) + '...' : text
    }
  }
  return `<${el.tag}>`
}

export function LayoutView({ currentPage }: LayoutViewProps) {
  const {
    deselectAll
  } = useCanvasStore()
  const { settings } = useAppStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const [wireframeData, setWireframeData] = useState<WireframeData | null>(null)
  const [modifiedElements, setModifiedElements] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 20, y: 20 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selectedWireframeId, setSelectedWireframeId] = useState<string | null>(null)
  const [hoveredWireframeId, setHoveredWireframeId] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [showStructure, setShowStructure] = useState(true)
  const [filterTag, setFilterTag] = useState<string>('all')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Get the preview URL from settings and current page route
  const previewUrl = useMemo(() => {
    const baseUrl = settings.livePreviewBaseUrl || 'http://127.0.0.1:8000'
    const route = currentPage?.route || '/'
    if (!route.startsWith('/')) return ''
    return `${baseUrl.replace(/\/$/, '')}${route}`
  }, [settings.livePreviewBaseUrl, currentPage?.route])

  // Capture wireframe from rendered page
  const captureWireframe = useCallback(async () => {
    if (!previewUrl) {
      setError('No preview URL configured')
      return
    }

    setIsLoading(true)
    setError(null)
    setModifiedElements(new Map())

    try {
      const result = await window.electron.captureWireframe({ url: previewUrl })
      setWireframeData(result)
    } catch (err: any) {
      setError(err.message || 'Failed to capture wireframe')
      console.error('Wireframe capture failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [previewUrl])

  // Capture on mount and when URL changes
  useEffect(() => {
    if (previewUrl) {
      captureWireframe()
    }
  }, [previewUrl, captureWireframe])

  // Get effective position (original + modifications)
  const getElementPosition = useCallback((element: WireframeElement) => {
    const mod = modifiedElements.get(element.id)
    if (mod) {
      return { x: mod.x, y: mod.y }
    }
    return { x: element.rect.x, y: element.rect.y }
  }, [modifiedElements])

  // Handle element drag start
  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    
    const element = wireframeData?.elements.find(el => el.id === elementId)
    if (!element) return

    setSelectedWireframeId(elementId)
    setIsDragging(true)
    
    const pos = getElementPosition(element)
    setDragStart({ x: e.clientX, y: e.clientY })
    setDragOffset({ x: pos.x, y: pos.y })
  }

  // Handle drag move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && selectedWireframeId) {
      const dx = (e.clientX - dragStart.x) / zoom
      const dy = (e.clientY - dragStart.y) / zoom
      
      setModifiedElements(prev => {
        const next = new Map(prev)
        next.set(selectedWireframeId, {
          x: dragOffset.x + dx,
          y: dragOffset.y + dy
        })
        return next
      })
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }

  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false)
    setIsPanning(false)
  }

  // Flatten for rendering - render ALL elements, not just top-level
  const allElements = useMemo(() => {
    return wireframeData?.elements || []
  }, [wireframeData])

  const filteredElements = useMemo(() => {
    if (filterTag === 'all') return allElements
    if (filterTag === 'structural') return allElements.filter((el) => el.isStructural)
    if (filterTag === 'content') return allElements.filter((el) => !el.isStructural)
    return allElements.filter((el) => el.tag === filterTag)
  }, [allElements, filterTag])

  const selectedElement = useMemo(() => {
    return allElements.find((el) => el.id === selectedWireframeId) || null
  }, [allElements, selectedWireframeId])

  // Build hierarchical tree from flat elements
  const hierarchicalElements = useMemo(() => {
    if (!wireframeData) return []
    
    const rootElements: WireframeElement[] = []
    
    wireframeData.elements.forEach(el => {
      if (!el.parentId) {
        rootElements.push(el)
      }
    })
    
    // Sort by position (top to bottom, left to right)
    rootElements.sort((a, b) => {
      const posA = getElementPosition(a)
      const posB = getElementPosition(b)
      if (Math.abs(posA.y - posB.y) < 50) {
        return posA.x - posB.x
      }
      return posA.y - posB.y
    })
    
    return rootElements
  }, [wireframeData, getElementPosition])

  // Canvas mouse handlers for panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom((z) => Math.max(0.1, Math.min(3, z * delta)))
    }
  }

  const selectElement = (id: string) => {
    setSelectedWireframeId(id)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && 
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return
      }

      if (e.key === 'Escape') {
        setSelectedWireframeId(null)
        deselectAll()
      }

      // Arrow keys to nudge selected element
      if (selectedWireframeId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        
        setModifiedElements(prev => {
          const next = new Map(prev)
          const current = next.get(selectedWireframeId)
          const element = wireframeData?.elements.find(el => el.id === selectedWireframeId)
          
          if (element) {
            const baseX = current?.x ?? element.rect.x
            const baseY = current?.y ?? element.rect.y
            next.set(selectedWireframeId, {
              x: baseX + dx,
              y: baseY + dy
            })
          }
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedWireframeId, deselectAll, wireframeData])

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <Layout className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No preview URL configured</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Set a Live Preview Base URL in Settings to capture the wireframe
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr_320px]">
      {/* Left: Structure Panel */}
      <div className="flex min-h-0 flex-col border-r bg-card">
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">DOM Structure</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {wireframeData ? `${wireframeData.elements.length} elements captured` : 'Capture to see structure'}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded border border-dashed p-4 text-center">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          ) : hierarchicalElements.length === 0 ? (
            <div className="rounded border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">No elements captured</p>
            </div>
          ) : (
            <ElementTree
              elements={hierarchicalElements}
              allElements={allElements}
              selectedId={selectedWireframeId}
              hoveredId={hoveredWireframeId}
              onSelect={selectElement}
              onHover={setHoveredWireframeId}
              getElementPosition={getElementPosition}
            />
          )}
        </div>
      </div>

      {/* Center: Wireframe Canvas */}
      <div className="relative min-h-0 overflow-hidden bg-muted/30">
        {/* Toolbar */}
        <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-lg border bg-card/95 p-2 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom(1)}
              title="Reset zoom"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <div className="h-4 w-px bg-border" />
            <Button
              variant={showLabels ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setShowLabels(!showLabels)}
            >
              Labels
            </Button>
            <Button
              variant={showStructure ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setShowStructure(!showStructure)}
            >
              Structure
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={captureWireframe}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-4 w-4" />
              )}
              Refresh
            </Button>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="h-8 rounded border bg-background px-2 text-xs"
            >
              <option value="all">All Elements</option>
              <option value="structural">Structural Only</option>
              <option value="content">Content Only</option>
              <option value="heading">Headings</option>
              <option value="text">Text</option>
              <option value="image">Images</option>
              <option value="button">Buttons</option>
              <option value="link">Links</option>
              <option value="div">Divs</option>
            </select>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedWireframeId(null)
              deselectAll()
            }
          }}
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Capturing wireframe...</p>
                <p className="text-xs text-muted-foreground">{previewUrl}</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={captureWireframe} className="mt-4">
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : wireframeData ? (
            <div
              className="relative origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: wireframeData.pageWidth,
                height: wireframeData.pageHeight
              }}
            >
              {/* Page background */}
              <div
                className="absolute bg-background shadow-lg"
                style={{
                  width: wireframeData.pageWidth,
                  height: wireframeData.pageHeight
                }}
              >
                {/* Grid pattern */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                      linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }}
                />

                {/* Render ALL elements (not filtered for hierarchy) */}
                {filteredElements.map((element) => {
                  const pos = getElementPosition(element)
                  return (
                    <WireframeBox
                      key={element.id}
                      element={element}
                      position={pos}
                      isSelected={selectedWireframeId === element.id}
                      isHovered={hoveredWireframeId === element.id}
                      showLabel={showLabels}
                      showStructure={showStructure}
                      onSelect={() => selectElement(element.id)}
                      onHover={setHoveredWireframeId}
                      onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                    />
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 rounded-lg border bg-card p-1 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
          >
            +
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}
          >
            -
          </Button>
        </div>
      </div>

      {/* Right: Properties Panel */}
      <div className="flex min-h-0 flex-col border-l bg-card">
        <div className="border-b p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {selectedElement ? (
            <div className="space-y-4">
              {/* Element info */}
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <TagIcon tag={selectedElement.tag} />
                  <span className="font-mono text-sm font-medium">{selectedElement.tag}</span>
                  {modifiedElements.has(selectedElement.id) && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Modified</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{getElementLabel(selectedElement)}</p>
              </div>

              {/* Position */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">X</span>
                    <p className="font-mono text-sm">{Math.round(getElementPosition(selectedElement).x)}px</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">Y</span>
                    <p className="font-mono text-sm">{Math.round(getElementPosition(selectedElement).y)}px</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Drag elements to move · Arrow keys to nudge</p>
              </div>

              {/* Size */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">Width</span>
                    <p className="font-mono text-sm">{Math.round(selectedElement.rect.width)}px</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">Height</span>
                    <p className="font-mono text-sm">{Math.round(selectedElement.rect.height)}px</p>
                  </div>
                </div>
              </div>

              {/* Class info */}
              {selectedElement.className && (
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Classes</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedElement.className.split(/\s+/).filter(Boolean).slice(0, 10).map((cls) => (
                      <span key={cls} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {cls}
                      </span>
                    ))}
                    {selectedElement.className.split(/\s+/).filter(Boolean).length > 10 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{selectedElement.className.split(/\s+/).filter(Boolean).length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Attributes */}
              {(selectedElement.attributes.href || selectedElement.attributes.src) && (
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attributes</label>
                  {selectedElement.attributes.href && (
                    <p className="text-[10px] text-muted-foreground truncate">href: {selectedElement.attributes.href}</p>
                  )}
                  {selectedElement.attributes.src && (
                    <p className="text-[10px] text-muted-foreground truncate">src: {selectedElement.attributes.src}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Target className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Select an element on the wireframe to view its properties</p>
              {wireframeData && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {wireframeData.elements.length} elements captured from<br />{wireframeData.url}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="border-t p-3">
          <p className="text-[10px] text-muted-foreground">
            {wireframeData ? `${wireframeData.elements.length} elements · Page: ${wireframeData.title}` : 'No wireframe captured'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Drag to pan (Shift+drag) · Scroll+Ctrl to zoom · Click to select · Drag elements to move
          </p>
        </div>
      </div>
    </div>
  )
}

// Wireframe box component
interface WireframeBoxProps {
  element: WireframeElement
  position: { x: number; y: number }
  isSelected: boolean
  isHovered: boolean
  showLabel: boolean
  showStructure: boolean
  onSelect: () => void
  onHover: (id: string | null) => void
  onMouseDown: (e: React.MouseEvent) => void
}

function WireframeBox({ element, position, isSelected, isHovered, showLabel, showStructure, onSelect, onHover, onMouseDown }: WireframeBoxProps) {
  const getBorderColor = () => {
    if (isSelected) return '#2563eb'
    if (isHovered) return '#3b82f6'
    if (element.isStructural) return '#94a3b8'
    return '#cbd5e1'
  }

  const getBackgroundColor = () => {
    if (isSelected) return 'rgba(37, 99, 235, 0.1)'
    if (isHovered) return 'rgba(59, 130, 246, 0.05)'
    if (element.isStructural) return 'rgba(148, 163, 184, 0.05)'
    return 'transparent'
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
  }

  return (
    <div
      className="absolute cursor-move transition-colors"
      style={{
        left: position.x,
        top: position.y,
        width: element.rect.width,
        height: element.rect.height,
        border: `${showStructure ? '1' : '0'}px solid ${getBorderColor()}`,
        backgroundColor: getBackgroundColor(),
        zIndex: isSelected ? 100 : isHovered ? 50 : 10 - element.level
      }}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => onHover(element.id)}
      onMouseLeave={() => onHover(null)}
    >
      {isSelected && (
        <div className="pointer-events-none absolute -inset-[2px] border-2 border-primary" />
      )}

      {showLabel && (element.rect.height > 20 || isSelected || isHovered) && (
        <div
          className="absolute left-0 top-0 z-10 flex max-w-full items-center gap-1 truncate rounded-br bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
          style={{ color: getBorderColor() }}
        >
          <TagIcon tag={element.tag} className="h-3 w-3" />
          <span className="truncate">{getElementLabel(element)}</span>
        </div>
      )}

      {isSelected && (
        <>
          <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" />
          <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
          <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-primary" />
          <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-primary" />
        </>
      )}
    </div>
  )
}

// Element tree component
interface ElementTreeProps {
  elements: WireframeElement[]
  allElements: WireframeElement[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  getElementPosition: (element: WireframeElement) => { x: number; y: number }
}

function ElementTree({ elements, allElements, selectedId, hoveredId, onSelect, onHover, getElementPosition }: ElementTreeProps) {
  return (
    <div className="space-y-0.5">
      {elements.map((element) => (
        <TreeNode
          key={element.id}
          element={element}
          allElements={allElements}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
          depth={0}
          getElementPosition={getElementPosition}
        />
      ))}
    </div>
  )
}

interface TreeNodeProps {
  element: WireframeElement
  allElements: WireframeElement[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  depth: number
  getElementPosition: (element: WireframeElement) => { x: number; y: number }
}

function TreeNode({ element, allElements, selectedId, hoveredId, onSelect, onHover, depth, getElementPosition }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Find children from all elements
  const childElements = useMemo(() => {
    return allElements.filter(el => el.parentId === element.id)
  }, [element.id, allElements])
  
  const hasChildren = childElements.length > 0
  const isSelected = selectedId === element.id
  const isHovered = hoveredId === element.id
  const isModified = getElementPosition(element).x !== element.rect.x || getElementPosition(element).y !== element.rect.y

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(element.id)
  }

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors ${
          isSelected
            ? 'bg-primary text-primary-foreground'
            : isHovered
            ? 'bg-muted'
            : 'hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleClick}
        onMouseEnter={() => onHover(element.id)}
        onMouseLeave={() => onHover(null)}
      >
        {hasChildren ? (
          <button
            className="h-4 w-4 shrink-0 rounded hover:bg-background/20"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <TagIcon tag={element.tag} className="h-3 w-3 shrink-0 opacity-70" />
        <span className="truncate">{getElementLabel(element)}</span>
        {isModified && (
          <Move className="ml-1 h-3 w-3 shrink-0 opacity-70" />
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {childElements.map((child) => (
            <TreeNode
              key={child.id}
              element={child}
              allElements={allElements}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              depth={depth + 1}
              getElementPosition={getElementPosition}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Tag icon component
function TagIcon({ tag, className = '' }: { tag: string; className?: string }) {
  switch (tag) {
    case 'heading':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return <Heading1 className={className || 'h-4 w-4'} />
    case 'text':
    case 'p':
    case 'span':
      return <Type className={className || 'h-4 w-4'} />
    case 'image':
    case 'img':
      return <ImageIcon className={className || 'h-4 w-4'} />
    case 'link':
    case 'a':
      return <Link2 className={className || 'h-4 w-4'} />
    case 'button':
      return <MousePointer className={className || 'h-4 w-4'} />
    case 'container':
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'aside':
    case 'nav':
      return <Square className={className || 'h-4 w-4'} />
    default:
      return <Layout className={className || 'h-4 w-4'} />
  }
}
