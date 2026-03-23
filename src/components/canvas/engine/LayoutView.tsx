import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Type, Heading1, Image as ImageIcon, Link2, MousePointer, Square, Layout, Layers, Maximize2, RefreshCw, Loader2, Move, Target, Palette, Search, Smartphone, Monitor, Tablet } from 'lucide-react'
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
  computedStyle?: {
    backgroundColor?: string
    color?: string
    fontSize?: string
    fontWeight?: string
    fontFamily?: string
    padding?: string
    margin?: string
    borderRadius?: string
  }
}

interface WireframeData {
  url: string
  title: string
  elements: WireframeElement[]
  pageWidth: number
  pageHeight: number
  colors?: string[]
}

interface ElementModification {
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
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
  const [modifiedElements, setModifiedElements] = useState<Map<string, ElementModification>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 20, y: 20 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selectedWireframeIds, setSelectedWireframeIds] = useState<Set<string>>(new Set())
  const [hoveredWireframeId, setHoveredWireframeId] = useState<string | null>(null)
  const [highlightedWireframeIds, setHighlightedWireframeIds] = useState<Set<string>>(new Set())
  const [showLabels, setShowLabels] = useState(true)
  const [showStructure, setShowStructure] = useState(true)
  const [showSpacing, setShowSpacing] = useState(false)
  const [filterTag, setFilterTag] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0 })
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

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
    setSelectedWireframeIds(new Set())

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
    return {
      x: mod?.x ?? element.rect.x,
      y: mod?.y ?? element.rect.y
    }
  }, [modifiedElements])

  // Get effective size (original + modifications)
  const getElementSize = useCallback((element: WireframeElement) => {
    const mod = modifiedElements.get(element.id)
    return {
      width: mod?.width ?? element.rect.width,
      height: mod?.height ?? element.rect.height
    }
  }, [modifiedElements])

  // Get effective text (original + modifications)
  const getElementText = useCallback((element: WireframeElement) => {
    const mod = modifiedElements.get(element.id)
    return mod?.text ?? element.text
  }, [modifiedElements])

  // Get all descendant IDs
  const getDescendantIds = useCallback((elementId: string): string[] => {
    const element = wireframeData?.elements.find(el => el.id === elementId)
    if (!element) return []
    
    const descendants: string[] = []
    const addDescendants = (parentId: string) => {
      const children = wireframeData?.elements.filter(el => el.parentId === parentId) || []
      children.forEach(child => {
        descendants.push(child.id)
        addDescendants(child.id)
      })
    }
    addDescendants(elementId)
    return descendants
  }, [wireframeData])

  // Handle element click with multi-select support
  const handleElementClick = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation()
    
    if (e.metaKey || e.ctrlKey) {
      // Multi-select toggle
      setSelectedWireframeIds(prev => {
        const next = new Set(prev)
        if (next.has(elementId)) {
          next.delete(elementId)
        } else {
          next.add(elementId)
        }
        return next
      })
    } else {
      // Single select
      setSelectedWireframeIds(new Set([elementId]))
    }
  }

  // Handle double-click for text editing
  const handleElementDoubleClick = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation()
    e.preventDefault()
    
    const element = wireframeData?.elements.find(el => el.id === elementId)
    if (!element) return
    
    // Only allow editing for text elements
    const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'button', 'a', 'li', 'text', 'heading', 'link']
    if (editableTags.includes(element.tag) || element.text) {
      setEditingElementId(elementId)
      setEditText(getElementText(element))
    }
  }

  // Save edited text
  const saveEdit = () => {
    if (editingElementId) {
      setModifiedElements(prev => {
        const next = new Map(prev)
        const current = next.get(editingElementId) || {}
        next.set(editingElementId, { ...current, text: editText })
        return next
      })
      setEditingElementId(null)
    }
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingElementId(null)
    setEditText('')
  }

  // Handle element drag start
  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (e.button !== 0 || editingElementId) return
    e.stopPropagation()
    
    const element = wireframeData?.elements.find(el => el.id === elementId)
    if (!element) return

    // If clicking unselected element without modifier, select just this one
    if (!selectedWireframeIds.has(elementId) && !(e.metaKey || e.ctrlKey)) {
      setSelectedWireframeIds(new Set([elementId]))
    }

    setIsDragging(true)
    
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation()
    e.preventDefault()
    
    const element = wireframeData?.elements.find(el => el.id === elementId)
    if (!element) return

    setIsResizing(true)
    setResizeHandle(handle)
    setSelectedWireframeIds(new Set([elementId]))
    
    const size = getElementSize(element)
    setDragStart({ x: e.clientX, y: e.clientY })
    setResizeStart({ width: size.width, height: size.height })
  }

  // Handle drag/resizing move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && selectedWireframeIds.size > 0) {
      const dx = (e.clientX - dragStart.x) / zoom
      const dy = (e.clientY - dragStart.y) / zoom
      
      setModifiedElements(prev => {
        const next = new Map(prev)
        selectedWireframeIds.forEach(elementId => {
          const element = wireframeData?.elements.find(el => el.id === elementId)
          if (element) {
            const current = next.get(elementId) || {}
            const baseX = current.x ?? element.rect.x
            const baseY = current.y ?? element.rect.y
            next.set(elementId, {
              ...current,
              x: baseX + dx,
              y: baseY + dy
            })
          }
        })
        return next
      })
      
      setDragStart({ x: e.clientX, y: e.clientY })
    } else if (isResizing && selectedWireframeIds.size === 1) {
      const elementId = Array.from(selectedWireframeIds)[0]
      const dx = (e.clientX - dragStart.x) / zoom
      const dy = (e.clientY - dragStart.y) / zoom
      
      setModifiedElements(prev => {
        const next = new Map(prev)
        const current = next.get(elementId) || {}
        
        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        
        if (resizeHandle?.includes('e')) newWidth += dx
        if (resizeHandle?.includes('w')) newWidth -= dx
        if (resizeHandle?.includes('s')) newHeight += dy
        if (resizeHandle?.includes('n')) newHeight -= dy
        
        next.set(elementId, {
          ...current,
          width: Math.max(20, newWidth),
          height: Math.max(20, newHeight)
        })
        return next
      })
      
      setDragStart({ x: e.clientX, y: e.clientY })
      setResizeStart(prev => ({
        width: resizeHandle?.includes('e') ? prev.width + dx : resizeHandle?.includes('w') ? prev.width - dx : prev.width,
        height: resizeHandle?.includes('s') ? prev.height + dy : resizeHandle?.includes('n') ? prev.height - dy : prev.height
      }))
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
    setIsResizing(false)
    setResizeHandle(null)
    setIsPanning(false)
  }

  // Handle hover with highlighting
  const handleElementHover = (elementId: string | null) => {
    setHoveredWireframeId(elementId)
    
    if (elementId) {
      // Highlight element and its descendants
      const descendants = getDescendantIds(elementId)
      setHighlightedWireframeIds(new Set([elementId, ...descendants]))
    } else {
      setHighlightedWireframeIds(new Set())
    }
  }

  // Flatten for rendering
  const allElements = useMemo(() => {
    return wireframeData?.elements || []
  }, [wireframeData])

  const filteredElements = useMemo(() => {
    let filtered = [...allElements]
    
    // Apply tag filter
    if (filterTag === 'structural') filtered = filtered.filter((el) => el.isStructural)
    else if (filterTag === 'content') filtered = filtered.filter((el) => !el.isStructural)
    else if (filterTag !== 'all') filtered = filtered.filter((el) => el.tag === filterTag)
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(el => 
        el.text.toLowerCase().includes(query) ||
        el.tag.toLowerCase().includes(query) ||
        el.className.toLowerCase().includes(query)
      )
    }
    
    // Sort by level so children render on top
    return filtered.sort((a, b) => a.level - b.level)
  }, [allElements, filterTag, searchQuery])

  const selectedElements = useMemo(() => {
    return Array.from(selectedWireframeIds).map(id => allElements.find(el => el.id === id)).filter(Boolean) as WireframeElement[]
  }, [allElements, selectedWireframeIds])

  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null

  // Build hierarchical tree
  const hierarchicalElements = useMemo(() => {
    if (!wireframeData) return []
    
    const rootElements: WireframeElement[] = []
    
    wireframeData.elements.forEach(el => {
      if (!el.parentId) {
        rootElements.push(el)
      }
    })
    
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

  // Canvas mouse handlers
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && 
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return
      }

      if (e.key === 'Escape') {
        if (editingElementId) {
          cancelEdit()
        } else {
          setSelectedWireframeIds(new Set())
          deselectAll()
        }
      }

      if (e.key === 'Enter' && editingElementId) {
        saveEdit()
      }

      // Arrow keys to nudge selected elements
      if (selectedWireframeIds.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !editingElementId) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        
        setModifiedElements(prev => {
          const next = new Map(prev)
          selectedWireframeIds.forEach(elementId => {
            const element = wireframeData?.elements.find(el => el.id === elementId)
            if (element) {
              const current = next.get(elementId) || {}
              const baseX = current.x ?? element.rect.x
              const baseY = current.y ?? element.rect.y
              next.set(elementId, {
                ...current,
                x: baseX + dx,
                y: baseY + dy
              })
            }
          })
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedWireframeIds, deselectAll, wireframeData, editingElementId])

  // Get viewport dimensions
  const viewportDimensions = useMemo(() => {
    switch (viewportSize) {
      case 'mobile': return { width: 375, label: 'Mobile (375px)' }
      case 'tablet': return { width: 768, label: 'Tablet (768px)' }
      default: return { width: wireframeData?.pageWidth || 1280, label: 'Desktop' }
    }
  }, [viewportSize, wireframeData])

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <Layout className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No preview URL configured</p>
          <p className="mt-2 text-sm text-muted-foreground">Set a Live Preview Base URL in Settings to capture the wireframe</p>
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
            {wireframeData ? `${wireframeData.elements.length} elements` : 'Capture to see structure'}
          </p>
          
          {/* Search */}
          <div className="mt-2 relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search elements..."
              className="w-full rounded border bg-background pl-7 pr-2 py-1 text-xs"
            />
          </div>
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
              selectedIds={selectedWireframeIds}
              hoveredId={hoveredWireframeId}
              highlightedIds={highlightedWireframeIds}
              onSelect={(id, addToSelection) => {
                if (addToSelection) {
                  setSelectedWireframeIds(prev => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                } else {
                  setSelectedWireframeIds(new Set([id]))
                }
              }}
              onHover={handleElementHover}
              getElementPosition={getElementPosition}
            />
          )}
        </div>
      </div>

      {/* Center: Wireframe Canvas */}
      <div className="relative min-h-0 overflow-hidden bg-muted/30">
        {/* Toolbar */}
        <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/95 p-2 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom(1)} title="Reset zoom">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <div className="h-4 w-px bg-border" />
            
            <Button variant={showLabels ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setShowLabels(!showLabels)}>Labels</Button>
            <Button variant={showStructure ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setShowStructure(!showStructure)}>Structure</Button>
            <Button variant={showSpacing ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setShowSpacing(!showSpacing)}>Spacing</Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Viewport toggles */}
            <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
              <button
                onClick={() => setViewportSize('desktop')}
                className={`rounded p-1.5 ${viewportSize === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                title="Desktop view"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportSize('tablet')}
                className={`rounded p-1.5 ${viewportSize === 'tablet' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                title="Tablet view"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportSize('mobile')}
                className={`rounded p-1.5 ${viewportSize === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                title="Mobile view"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={captureWireframe} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Refresh
            </Button>
            
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="h-8 rounded border bg-background px-2 text-xs">
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
              setSelectedWireframeIds(new Set())
              deselectAll()
            }
          }}
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Capturing wireframe...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={captureWireframe} className="mt-4">
                  <RefreshCw className="mr-1 h-4 w-4" /> Retry
                </Button>
              </div>
            </div>
          ) : wireframeData ? (
            <div
              className="relative origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: Math.max(viewportDimensions.width, wireframeData.pageWidth),
                height: wireframeData.pageHeight
              }}
            >
              {/* Page background */}
              <div
                className="absolute bg-background shadow-lg"
                style={{
                  width: viewportDimensions.width,
                  height: wireframeData.pageHeight,
                  margin: '0 auto',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                {/* Grid pattern */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }}
                />

                {/* Render elements */}
                {filteredElements.map((element) => {
                  const pos = getElementPosition(element)
                  const size = getElementSize(element)
                  const isSelected = selectedWireframeIds.has(element.id)
                  const isEditing = editingElementId === element.id
                  
                  return (
                    <WireframeBox
                      key={element.id}
                      element={element}
                      position={pos}
                      size={size}
                      text={getElementText(element)}
                      isSelected={isSelected}
                      isHovered={hoveredWireframeId === element.id}
                      isHighlighted={highlightedWireframeIds.has(element.id)}
                      showLabel={showLabels}
                      showStructure={showStructure}
                      showSpacing={showSpacing}
                      onSelect={(e) => handleElementClick(e, element.id)}
                      onHover={handleElementHover}
                      onDoubleClick={(e) => handleElementDoubleClick(e, element.id)}
                      onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                      onResizeStart={handleResizeStart}
                      isEditing={isEditing}
                      editText={editText}
                      onEditChange={setEditText}
                      onEditSave={saveEdit}
                      onEditCancel={cancelEdit}
                    />
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 rounded-lg border bg-card p-1 shadow-sm">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>+</Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>-</Button>
        </div>
      </div>

      {/* Right: Properties Panel */}
      <div className="flex min-h-0 flex-col border-l bg-card">
        <div className="border-b p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {selectedElements.length > 0 ? (
            <div className="space-y-4">
              {/* Selection info */}
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{selectedElements.length} selected</span>
                </div>
              </div>

              {selectedElement && (
                <>
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
                  </div>

                  {/* Size */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Size</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border bg-muted/30 p-2">
                        <span className="text-[10px] text-muted-foreground">Width</span>
                        <p className="font-mono text-sm">{Math.round(getElementSize(selectedElement).width)}px</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2">
                        <span className="text-[10px] text-muted-foreground">Height</span>
                        <p className="font-mono text-sm">{Math.round(getElementSize(selectedElement).height)}px</p>
                      </div>
                    </div>
                  </div>

                  {/* Computed Styles */}
                  {selectedElement.computedStyle && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Computed Styles</label>
                      <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                        {selectedElement.computedStyle.fontSize && (
                          <p className="text-[10px] text-muted-foreground">font-size: {selectedElement.computedStyle.fontSize}</p>
                        )}
                        {selectedElement.computedStyle.fontWeight && (
                          <p className="text-[10px] text-muted-foreground">font-weight: {selectedElement.computedStyle.fontWeight}</p>
                        )}
                        {selectedElement.computedStyle.color && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border" style={{ backgroundColor: selectedElement.computedStyle.color }} />
                            <p className="text-[10px] text-muted-foreground">color: {selectedElement.computedStyle.color}</p>
                          </div>
                        )}
                        {selectedElement.computedStyle.backgroundColor && selectedElement.computedStyle.backgroundColor !== 'transparent' && selectedElement.computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border" style={{ backgroundColor: selectedElement.computedStyle.backgroundColor }} />
                            <p className="text-[10px] text-muted-foreground">bg: {selectedElement.computedStyle.backgroundColor}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Class info */}
                  {selectedElement.className && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Classes</label>
                      <div className="flex flex-wrap gap-1">
                        {selectedElement.className.split(/\s+/).filter(Boolean).slice(0, 10).map((cls) => (
                          <span key={cls} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{cls}</span>
                        ))}
                        {selectedElement.className.split(/\s+/).filter(Boolean).length > 10 && (
                          <span className="text-[10px] text-muted-foreground">+{selectedElement.className.split(/\s+/).filter(Boolean).length - 10} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Color Palette */}
              {wireframeData?.colors && wireframeData.colors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Palette className="h-3 w-3 text-muted-foreground" />
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Page Colors</label>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {wireframeData.colors.slice(0, 12).map((color, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Target className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Select elements to view properties</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Cmd/Ctrl+click for multi-select</p>
              <p className="text-[10px] text-muted-foreground">Double-click to edit text</p>
              {wireframeData && (
                <p className="mt-1 text-[10px] text-muted-foreground">{wireframeData.elements.length} elements captured</p>
              )}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="border-t p-3">
          <p className="text-[10px] text-muted-foreground">{viewportDimensions.label} · {wireframeData?.elements.length || 0} elements</p>
          <p className="text-[10px] text-muted-foreground">Shift+drag to pan · Scroll+Ctrl to zoom · Cmd+click to multi-select</p>
        </div>
      </div>
    </div>
  )
}

// Wireframe box component
interface WireframeBoxProps {
  element: WireframeElement
  position: { x: number; y: number }
  size: { width: number; height: number }
  text: string
  isSelected: boolean
  isHovered: boolean
  isHighlighted: boolean
  showLabel: boolean
  showStructure: boolean
  showSpacing: boolean
  onSelect: (e: React.MouseEvent) => void
  onHover: (id: string | null) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onResizeStart: (e: React.MouseEvent, elementId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => void
  isEditing: boolean
  editText: string
  onEditChange: (text: string) => void
  onEditSave: () => void
  onEditCancel: () => void
}

function WireframeBox({ 
  element, position, size, text, isSelected, isHovered, isHighlighted,
  showLabel, showStructure, showSpacing, onSelect, onHover, onDoubleClick,
  onMouseDown, onResizeStart, isEditing, editText, onEditChange, onEditSave, onEditCancel
}: WireframeBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const getBorderColor = () => {
    if (isSelected) return '#2563eb'
    if (isHighlighted && isHovered) return '#f59e0b'
    if (isHighlighted) return '#fbbf24'
    if (isHovered) return '#3b82f6'
    if (element.isStructural) return '#94a3b8'
    return '#cbd5e1'
  }

  const getBackgroundColor = () => {
    if (isSelected) return 'rgba(37, 99, 235, 0.1)'
    if (isHighlighted) return 'rgba(251, 191, 36, 0.1)'
    if (isHovered) return 'rgba(59, 130, 246, 0.05)'
    if (element.isStructural) return 'rgba(148, 163, 184, 0.05)'
    return 'transparent'
  }

  // Render content preview based on element type
  const renderContent = () => {
    const { tag, attributes } = element
    const isSmall = size.height < 40 || size.width < 60
    
    if (isSmall && !isSelected) return null

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditSave()
            if (e.key === 'Escape') onEditCancel()
          }}
          className="w-full h-full px-2 py-1 text-sm bg-white border-2 border-primary outline-none"
          style={{ fontSize: tag.startsWith('h') ? '16px' : '14px' }}
          onClick={(e) => e.stopPropagation()}
        />
      )
    }

    switch (tag) {
      case 'img':
      case 'image':
        if (attributes.src) {
          return (
            <img
              src={attributes.src}
              alt={attributes.alt || ''}
              className="w-full h-full object-cover pointer-events-none"
              style={{ opacity: isSelected ? 0.8 : 0.6 }}
              draggable={false}
            />
          )
        }
        return (
          <div className="w-full h-full flex items-center justify-center bg-muted/30 pointer-events-none">
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
          </div>
        )

      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
      case 'heading':
        if (text) {
          return (
            <div 
              className="w-full h-full flex items-center px-2 overflow-hidden pointer-events-none"
              style={{ 
                fontSize: tag === 'h1' ? '24px' : tag === 'h2' ? '20px' : tag === 'h3' ? '18px' : '16px',
                fontWeight: 700,
                lineHeight: 1.2,
                opacity: isSelected ? 0.9 : 0.7
              }}
            >
              <span className="truncate">{text}</span>
            </div>
          )
        }
        break

      case 'button':
        if (text) {
          return (
            <div 
              className="w-full h-full flex items-center justify-center px-3 overflow-hidden pointer-events-none"
              style={{ 
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1e40af'
              }}
            >
              <span className="truncate">{text}</span>
            </div>
          )
        }
        break

      case 'a':
      case 'link':
        if (text) {
          return (
            <div 
              className="w-full h-full flex items-center px-2 overflow-hidden pointer-events-none"
              style={{ 
                fontSize: '14px',
                color: '#2563eb',
                textDecoration: 'underline',
                opacity: isSelected ? 0.9 : 0.7
              }}
            >
              <span className="truncate">{text}</span>
            </div>
          )
        }
        break

      case 'p':
      case 'span':
      case 'text':
      case 'li':
        if (text) {
          return (
            <div 
              className="w-full h-full px-2 py-1 overflow-hidden pointer-events-none"
              style={{ 
                fontSize: '14px',
                lineHeight: 1.5,
                opacity: isSelected ? 0.9 : 0.7
              }}
            >
              <span className="line-clamp-3">{text}</span>
            </div>
          )
        }
        break

      default:
        if (text && !element.isStructural) {
          return (
            <div 
              className="w-full h-full px-2 py-1 overflow-hidden pointer-events-none"
              style={{ 
                fontSize: '13px',
                opacity: isSelected ? 0.8 : 0.6
              }}
            >
              <span className="line-clamp-2">{text}</span>
            </div>
          )
        }
    }
    return null
  }

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        border: `${showStructure ? (isSelected ? '2' : '1') : '0'}px solid ${getBorderColor()}`,
        backgroundColor: getBackgroundColor(),
        zIndex: isSelected ? 100 : isHovered ? 50 : element.level + 1,
        boxShadow: isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.3)' : isHighlighted ? '0 0 0 2px rgba(251, 191, 36, 0.5)' : 'none',
        cursor: isEditing ? 'text' : 'move'
      }}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => onHover(element.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Spacing indicators */}
      {showSpacing && element.computedStyle?.padding && (
        <div 
          className="absolute inset-0 pointer-events-none border-2 border-dashed border-green-400/50"
          style={{ margin: '4px' }}
          title={`padding: ${element.computedStyle.padding}`}
        />
      )}

      {/* Content preview */}
      {renderContent()}

      {/* Selection border */}
      {isSelected && (
        <>
          <div className="pointer-events-none absolute -inset-[2px] border-2 border-primary" />
          
          {/* Resize handles */}
          <div 
            className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full cursor-nw-resize"
            onMouseDown={(e) => onResizeStart(e, element.id, 'nw')}
          />
          <div 
            className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full cursor-ne-resize"
            onMouseDown={(e) => onResizeStart(e, element.id, 'ne')}
          />
          <div 
            className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full cursor-sw-resize"
            onMouseDown={(e) => onResizeStart(e, element.id, 'sw')}
          />
          <div 
            className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full cursor-se-resize"
            onMouseDown={(e) => onResizeStart(e, element.id, 'se')}
          />
        </>
      )}

      {/* Label */}
      {showLabel && (size.height > 30 || isSelected || isHovered) && !isEditing && (
        <div
          className="absolute left-0 top-0 z-20 flex max-w-full items-center gap-1 truncate rounded-br bg-background/95 px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
          style={{ color: getBorderColor() }}
        >
          <TagIcon tag={element.tag} className="h-3 w-3" />
          <span className="truncate">{getElementLabel(element)}</span>
        </div>
      )}
    </div>
  )
}

// Element tree component
interface ElementTreeProps {
  elements: WireframeElement[]
  allElements: WireframeElement[]
  selectedIds: Set<string>
  hoveredId: string | null
  highlightedIds: Set<string>
  onSelect: (id: string, addToSelection: boolean) => void
  onHover: (id: string | null) => void
  getElementPosition: (element: WireframeElement) => { x: number; y: number }
}

function ElementTree({ elements, allElements, selectedIds, hoveredId, highlightedIds, onSelect, onHover, getElementPosition }: ElementTreeProps) {
  return (
    <div className="space-y-0.5">
      {elements.map((element) => (
        <TreeNode
          key={element.id}
          element={element}
          allElements={allElements}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          highlightedIds={highlightedIds}
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
  selectedIds: Set<string>
  hoveredId: string | null
  highlightedIds: Set<string>
  onSelect: (id: string, addToSelection: boolean) => void
  onHover: (id: string | null) => void
  depth: number
  getElementPosition: (element: WireframeElement) => { x: number; y: number }
}

function TreeNode({ element, allElements, selectedIds, hoveredId, highlightedIds, onSelect, onHover, depth, getElementPosition }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  const childElements = useMemo(() => {
    return allElements.filter(el => el.parentId === element.id)
  }, [element.id, allElements])
  
  const hasChildren = childElements.length > 0
  const isSelected = selectedIds.has(element.id)
  const isHovered = hoveredId === element.id
  const isHighlighted = highlightedIds.has(element.id)
  const isModified = getElementPosition(element).x !== element.rect.x || getElementPosition(element).y !== element.rect.y

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(element.id, e.metaKey || e.ctrlKey)
  }

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors ${
          isSelected
            ? 'bg-primary text-primary-foreground'
            : isHighlighted
            ? 'bg-yellow-100 text-yellow-900'
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
        {isModified && <Move className="ml-1 h-3 w-3 shrink-0 opacity-70" />}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {childElements.map((child) => (
            <TreeNode
              key={child.id}
              element={child}
              allElements={allElements}
              selectedIds={selectedIds}
              hoveredId={hoveredId}
              highlightedIds={highlightedIds}
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
