import { useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import type { CanvasNode } from '@/types'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'

interface CanvasNodeProps {
  node: CanvasNode
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  scale: number
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null

export function CanvasNodeComponent({ node, isSelected, onSelect, scale }: CanvasNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const { updateNode, pushHistory } = useCanvasStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 })
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 })

  const component = BUILT_IN_COMPONENTS.find(c => c.type === node.type)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    
    e.stopPropagation()
    onSelect(e)
    
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPosition({ x: node.position.x, y: node.position.y })
  }, [node.position, onSelect])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = (e.clientX - dragStart.x) / scale
      const deltaY = (e.clientY - dragStart.y) / scale
      
      updateNode(node.id, {
        position: {
          x: initialPosition.x + deltaX,
          y: initialPosition.y + deltaY
        }
      })
    } else if (isResizing && resizeHandle) {
      const deltaX = (e.clientX - dragStart.x) / scale
      const deltaY = (e.clientY - dragStart.y) / scale
      
      let newWidth = initialSize.width
      let newHeight = initialSize.height
      let newX = initialPosition.x
      let newY = initialPosition.y

      // Handle horizontal resizing
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(20, initialSize.width + deltaX)
      } else if (resizeHandle.includes('w')) {
        const proposedWidth = Math.max(20, initialSize.width - deltaX)
        newX = initialPosition.x + (initialSize.width - proposedWidth)
        newWidth = proposedWidth
      }

      // Handle vertical resizing
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(20, initialSize.height + deltaY)
      } else if (resizeHandle.includes('n')) {
        const proposedHeight = Math.max(20, initialSize.height - deltaY)
        newY = initialPosition.y + (initialSize.height - proposedHeight)
        newHeight = proposedHeight
      }

      updateNode(node.id, {
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight }
      })
    }
  }, [isDragging, isResizing, resizeHandle, dragStart, initialPosition, initialSize, scale, node.id, updateNode])

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      pushHistory()
    }
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
  }, [isDragging, isResizing, pushHistory])

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation()
    e.preventDefault()
    
    setIsResizing(true)
    setResizeHandle(handle)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPosition({ x: node.position.x, y: node.position.y })
    setInitialSize({ 
      width: typeof node.size.width === 'number' ? node.size.width : parseInt(node.size.width as string) || 100, 
      height: typeof node.size.height === 'number' ? node.size.height : parseInt(node.size.height as string) || 100 
    })
  }, [node.position, node.size])

  const renderContent = () => {
    switch (node.type) {
      case 'button':
        return (
          <button
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          >
            {node.props.text || 'Button'}
          </button>
        )
      
      case 'text':
        return (
          <p style={{ ...node.style, pointerEvents: 'none', margin: 0 }}>
            {node.props.content || 'Text content'}
          </p>
        )
      
      case 'heading':
        const HeadingTag = `h${node.props.level || 2}` as keyof JSX.IntrinsicElements
        return (
          <HeadingTag style={{ ...node.style, pointerEvents: 'none', margin: 0 }}>
            {node.props.text || 'Heading'}
          </HeadingTag>
        )
      
      case 'container':
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          />
        )
      
      case 'image':
        return (
          <img
            src={node.props.src || 'https://via.placeholder.com/200'}
            alt={node.props.alt || 'Image'}
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          />
        )
      
      case 'input':
        return (
          <input
            type={node.props.type || 'text'}
            placeholder={node.props.placeholder || 'Enter text...'}
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
            readOnly
          />
        )

      case 'card':
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>{node.props.title}</div>
            <div style={{ color: '#6B7280' }}>Card content</div>
          </div>
        )

      case 'textarea':
        return (
          <textarea
            placeholder={node.props.placeholder || 'Enter long text...'}
            rows={node.props.rows || 4}
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              resize: 'none'
            }}
            readOnly
          />
        )

      case 'checkbox':
        return (
          <label style={{ ...node.style, pointerEvents: 'none', width: '100%', height: '100%' }}>
            <input type="checkbox" checked={node.props.checked} readOnly style={{ marginRight: '8px' }} />
            {node.props.label}
          </label>
        )

      case 'select':
        return (
          <select
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
            disabled
          >
            <option>{node.props.placeholder || 'Select...'}</option>
          </select>
        )

      case 'link':
        return (
          <a
            href={node.props.href || '#'}
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'inline-block'
            }}
          >
            {node.props.text || 'Link'}
          </a>
        )

      case 'badge':
        return (
          <span
            style={{
              ...node.style,
              pointerEvents: 'none'
            }}
          >
            {node.props.text || 'Badge'}
          </span>
        )

      case 'divider':
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%'
            }}
          />
        )

      case 'avatar':
        return node.props.src ? (
          <img
            src={node.props.src}
            alt="Avatar"
            style={{
              ...node.style,
              pointerEvents: 'none',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none'
            }}
          >
            {node.props.initials || '??'}
          </div>
        )

      case 'label':
        return (
          <label
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          >
            {node.props.text || 'Label'}
          </label>
        )

      default:
        return <div style={{ width: '100%', height: '100%', background: '#ccc' }} />
    }
  }

  if (!component) return null

  const width = typeof node.size.width === 'number' ? node.size.width : parseInt(node.size.width as string) || 100
  const height = typeof node.size.height === 'number' ? node.size.height : parseInt(node.size.height as string) || 100

  return (
    <div
      ref={nodeRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: width,
        height: height,
        cursor: isDragging ? 'grabbing' : isResizing ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxSizing: 'border-box'
      }}
      className={isSelected ? 'selection-outline' : ''}
    >
      {renderContent()}
      
      {/* Resize Handles */}
      {isSelected && !isDragging && (
        <>
          {/* Corner handles */}
          <ResizeHandle position="nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <ResizeHandle position="ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <ResizeHandle position="sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <ResizeHandle position="se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          
          {/* Edge handles */}
          <ResizeHandle position="n" onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <ResizeHandle position="s" onMouseDown={(e) => handleResizeStart(e, 's')} />
          <ResizeHandle position="e" onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <ResizeHandle position="w" onMouseDown={(e) => handleResizeStart(e, 'w')} />
        </>
      )}
    </div>
  )
}

interface ResizeHandleProps {
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  onMouseDown: (e: React.MouseEvent) => void
}

function ResizeHandle({ position, onMouseDown }: ResizeHandleProps) {
  const getPosition = () => {
    switch (position) {
      case 'nw': return { left: -4, top: -4 }
      case 'n': return { left: '50%', top: -4, transform: 'translateX(-50%)' }
      case 'ne': return { right: -4, top: -4 }
      case 'e': return { right: -4, top: '50%', transform: 'translateY(-50%)' }
      case 'se': return { right: -4, bottom: -4 }
      case 's': return { left: '50%', bottom: -4, transform: 'translateX(-50%)' }
      case 'sw': return { left: -4, bottom: -4 }
      case 'w': return { left: -4, top: '50%', transform: 'translateY(-50%)' }
    }
  }

  const getCursor = () => {
    switch (position) {
      case 'nw':
      case 'se': return 'nwse-resize'
      case 'ne':
      case 'sw': return 'nesw-resize'
      case 'n':
      case 's': return 'ns-resize'
      case 'e':
      case 'w': return 'ew-resize'
    }
  }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        width: 8,
        height: 8,
        backgroundColor: 'hsl(var(--primary))',
        border: '2px solid white',
        borderRadius: position.length === 2 ? '50%' : position === 'n' || position === 's' ? '4px' : '4px',
        ...getPosition(),
        cursor: getCursor(),
        zIndex: 10
      }}
    />
  )
}
