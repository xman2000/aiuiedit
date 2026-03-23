import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Eye, EyeOff, Lock, Unlock, Trash2, Type, Heading1, Image as ImageIcon, Link2, MousePointer, Square, Layout, Layers, Maximize2 } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
import type { CanvasNode, Page } from '@/types'

interface LayoutViewProps {
  currentPage?: Page
}

interface WireframeElement {
  id: string
  nodeId: string | null
  tag: string
  rect: DOMRect
  text: string
  className: string
  children: WireframeElement[]
  level: number
  visible: boolean
  isStructural: boolean
  attributes: {
    href?: string
    src?: string
    alt?: string
  }
}

interface WireframeData {
  elements: WireframeElement[]
  pageWidth: number
  pageHeight: number
}

function readDimension(value: number | string, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseFloat(value.replace('px', ''))
  return Number.isFinite(parsed) ? parsed : fallback
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
    nodes,
    selectNode,
    deselectAll,
    updateNode,
    removeNode,
    pushHistory
  } = useCanvasStore()
  const { setDirty } = useProjectStore()

  const containerRef = useRef<HTMLDivElement>(null)
  // Wireframe data from actual DOM capture - currently unused but reserved for future integration
  const [wireframeData] = useState<WireframeData | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selectedWireframeId, setSelectedWireframeId] = useState<string | null>(null)
  const [hoveredWireframeId, setHoveredWireframeId] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [showStructure, setShowStructure] = useState(true)
  const [filterTag, setFilterTag] = useState<string>('all')

  // Get page nodes
  const pageNodes = useMemo(() => {
    if (!currentPage) return []
    return Array.from(nodes.values())
      .filter((node) => node.pageId === currentPage.id)
      .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
  }, [nodes, currentPage])

  // Build wireframe from nodes (fallback to node positions)
  const computedWireframe = useMemo<WireframeData | null>(() => {
    if (!currentPage) return null

    const elements: WireframeElement[] = []
    const childrenByParent = new Map<string | null, CanvasNode[]>()

    pageNodes.forEach((node) => {
      const parentId = node.parentId || null
      const siblings = childrenByParent.get(parentId) || []
      siblings.push(node)
      childrenByParent.set(parentId, siblings)
    })

    const buildHierarchy = (node: CanvasNode, level: number): WireframeElement => {
      const width = readDimension(node.size.width, 200)
      const height = readDimension(node.size.height, 50)
      const children = childrenByParent.get(node.id) || []

      const props = (node.props || {}) as Record<string, any>

      return {
        id: `wf-${node.id}`,
        nodeId: node.id,
        tag: node.type,
        rect: {
          x: node.position.x,
          y: node.position.y,
          width,
          height,
          top: node.position.y,
          left: node.position.x,
          right: node.position.x + width,
          bottom: node.position.y + height,
          toJSON: () => ({})
        } as DOMRect,
        text: props.text || props.content || props.label || props.title || props.alt || '',
        className: '',
        children: children.map((child) => buildHierarchy(child, level + 1)),
        level,
        visible: node.visible,
        isStructural: ['container', 'card', 'section', 'div'].includes(node.type),
        attributes: {
          href: props.href,
          src: props.src,
          alt: props.alt
        }
      }
    }

    const rootNodes = childrenByParent.get(null) || []
    rootNodes.forEach((node) => {
      elements.push(buildHierarchy(node, 0))
    })

    // Calculate page bounds
    let maxX = 800
    let maxY = 600
    elements.forEach((el) => {
      maxX = Math.max(maxX, el.rect.right + 100)
      maxY = Math.max(maxY, el.rect.bottom + 100)
    })

    return {
      elements,
      pageWidth: maxX,
      pageHeight: maxY
    }
  }, [pageNodes, currentPage])

  // Flatten wireframe elements for rendering
  const flattenElements = useCallback((elements: WireframeElement[]): WireframeElement[] => {
    const flat: WireframeElement[] = []
    const traverse = (el: WireframeElement) => {
      flat.push(el)
      el.children.forEach(traverse)
    }
    elements.forEach(traverse)
    return flat
  }, [])

  const allElements = useMemo(() => {
    const data = wireframeData || computedWireframe
    if (!data) return []
    return flattenElements(data.elements)
  }, [wireframeData, computedWireframe, flattenElements])

  const filteredElements = useMemo(() => {
    if (filterTag === 'all') return allElements
    if (filterTag === 'structural') return allElements.filter((el) => el.isStructural)
    if (filterTag === 'content') return allElements.filter((el) => !el.isStructural)
    return allElements.filter((el) => el.tag === filterTag)
  }, [allElements, filterTag])

  const selectedElement = useMemo(() => {
    return allElements.find((el) => el.id === selectedWireframeId) || null
  }, [allElements, selectedWireframeId])

  const linkedNode = useMemo(() => {
    if (!selectedElement?.nodeId) return null
    return nodes.get(selectedElement.nodeId) || null
  }, [selectedElement, nodes])

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom((z) => Math.max(0.1, Math.min(3, z * delta)))
    }
  }

  const selectElement = (id: string, addToSelection = false) => {
    const element = allElements.find((el) => el.id === id)
    if (!element) return

    setSelectedWireframeId(id)

    // Also select the corresponding node if it exists
    if (element.nodeId) {
      if (addToSelection) {
        // For multi-select, we'd need to modify the store
        selectNode(element.nodeId, true)
      } else {
        selectNode(element.nodeId, false)
      }
    }
  }

  const deleteSelected = () => {
    if (!linkedNode) return
    removeNode(linkedNode.id)
    setDirty(true)
    setSelectedWireframeId(null)
  }

  const toggleVisibility = () => {
    if (!linkedNode) return
    updateNode(linkedNode.id, { visible: !linkedNode.visible })
    pushHistory()
    setDirty(true)
  }

  const toggleLock = () => {
    if (!linkedNode) return
    updateNode(linkedNode.id, { locked: !linkedNode.locked })
    pushHistory()
    setDirty(true)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && 
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireframeId) {
        e.preventDefault()
        deleteSelected()
      }

      if (e.key === 'Escape') {
        setSelectedWireframeId(null)
        deselectAll()
      }

      const step = e.shiftKey ? 10 : 1
      if (linkedNode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        updateNode(linkedNode.id, {
          position: {
            x: linkedNode.position.x + dx,
            y: linkedNode.position.y + dy
          }
        })
        pushHistory()
        setDirty(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedWireframeId, linkedNode, updateNode, pushHistory, setDirty, deselectAll])

  const data = wireframeData || computedWireframe

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
            Hierarchical view of page elements
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {data?.elements.length === 0 ? (
            <div className="rounded border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">No elements on this page</p>
            </div>
          ) : (
            <ElementTree
              elements={data?.elements || []}
              selectedId={selectedWireframeId}
              hoveredId={hoveredWireframeId}
              onSelect={selectElement}
              onHover={setHoveredWireframeId}
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
              <option value="container">Containers</option>
            </select>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
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
          <div
            className="relative origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: data?.pageWidth || 800,
              height: data?.pageHeight || 600
            }}
          >
            {/* Page background */}
            <div
              className="absolute bg-background shadow-lg"
              style={{
                width: data?.pageWidth || 800,
                height: data?.pageHeight || 600
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

              {/* Render elements */}
              {filteredElements.map((element) => (
                <WireframeBox
                  key={element.id}
                  element={element}
                  isSelected={selectedWireframeId === element.id}
                  isHovered={hoveredWireframeId === element.id}
                  showLabel={showLabels}
                  showStructure={showStructure}
                  onSelect={(add) => selectElement(element.id, add)}
                  onHover={setHoveredWireframeId}
                />
              ))}
            </div>
          </div>
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
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{getElementLabel(selectedElement)}</p>
              </div>

              {/* Position */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">X</span>
                    <p className="font-mono text-sm">{Math.round(selectedElement.rect.x)}px</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">Y</span>
                    <p className="font-mono text-sm">{Math.round(selectedElement.rect.y)}px</p>
                  </div>
                </div>
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

              {/* Linked node controls */}
              {linkedNode && (
                <>
                  <div className="h-px bg-border" />
                  
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Element Controls</label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleVisibility}
                        className="flex-1"
                      >
                        {linkedNode.visible ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                        {linkedNode.visible ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleLock}
                        className="flex-1"
                      >
                        {linkedNode.locked ? <Lock className="mr-1 h-3 w-3" /> : <Unlock className="mr-1 h-3 w-3" />}
                        {linkedNode.locked ? 'Unlock' : 'Lock'}
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelected}
                      className="w-full"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete Element
                    </Button>
                  </div>

                  {/* Node ID */}
                  <div className="rounded-md border bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground">Node ID</span>
                    <p className="font-mono text-[10px]">{linkedNode.id}</p>
                  </div>
                </>
              )}

              {/* Class info */}
              {selectedElement.className && (
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Classes</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedElement.className.split(/\s+/).filter(Boolean).map((cls) => (
                      <span key={cls} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Layout className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Select an element on the wireframe to view its properties</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Use arrow keys to nudge position</p>
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="border-t p-3">
          <p className="text-[10px] text-muted-foreground">
            {allElements.length} elements · {filteredElements.length} visible
          </p>
          <p className="text-[10px] text-muted-foreground">
            Drag to pan · Scroll+Ctrl to zoom · Click to select
          </p>
        </div>
      </div>
    </div>
  )
}

// Wireframe box component
interface WireframeBoxProps {
  element: WireframeElement
  isSelected: boolean
  isHovered: boolean
  showLabel: boolean
  showStructure: boolean
  onSelect: (addToSelection: boolean) => void
  onHover: (id: string | null) => void
}

function WireframeBox({ element, isSelected, isHovered, showLabel, showStructure, onSelect, onHover }: WireframeBoxProps) {
  const getBorderColor = () => {
    if (isSelected) return '#2563eb' // primary
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
    onSelect(e.metaKey || e.ctrlKey)
  }

  return (
    <div
      className="absolute cursor-pointer transition-colors"
      style={{
        left: element.rect.x,
        top: element.rect.y,
        width: element.rect.width,
        height: element.rect.height,
        border: `${showStructure ? '1' : '0'}px solid ${getBorderColor()}`,
        backgroundColor: getBackgroundColor(),
        zIndex: isSelected ? 100 : isHovered ? 50 : 10 - element.level
      }}
      onClick={handleClick}
      onMouseEnter={() => onHover(element.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="pointer-events-none absolute -inset-[2px] border-2 border-primary" />
      )}

      {/* Label */}
      {showLabel && (element.rect.height > 20 || isSelected || isHovered) && (
        <div
          className="absolute left-0 top-0 z-10 flex max-w-full items-center gap-1 truncate rounded-br bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
          style={{ color: getBorderColor() }}
        >
          <TagIcon tag={element.tag} className="h-3 w-3" />
          <span className="truncate">{getElementLabel(element)}</span>
        </div>
      )}

      {/* Resize handles for selected element */}
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
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string, addToSelection: boolean) => void
  onHover: (id: string | null) => void
}

function ElementTree({ elements, selectedId, hoveredId, onSelect, onHover }: ElementTreeProps) {
  return (
    <div className="space-y-0.5">
      {elements.map((element) => (
        <TreeNode
          key={element.id}
          element={element}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
          depth={0}
        />
      ))}
    </div>
  )
}

interface TreeNodeProps {
  element: WireframeElement
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string, addToSelection: boolean) => void
  onHover: (id: string | null) => void
  depth: number
}

function TreeNode({ element, selectedId, hoveredId, onSelect, onHover, depth }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasChildren = element.children.length > 0
  const isSelected = selectedId === element.id
  const isHovered = hoveredId === element.id

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
        {!element.visible && <EyeOff className="ml-auto h-3 w-3 shrink-0 opacity-50" />}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {element.children.map((child) => (
            <TreeNode
              key={child.id}
              element={child}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              depth={depth + 1}
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
