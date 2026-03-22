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

export function CanvasNodeComponent({ node, isSelected, onSelect, scale }: CanvasNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const { updateNode } = useCanvasStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 })

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
    if (!isDragging) return
    
    const deltaX = (e.clientX - dragStart.x) / scale
    const deltaY = (e.clientY - dragStart.y) / scale
    
    updateNode(node.id, {
      position: {
        x: initialPosition.x + deltaX,
        y: initialPosition.y + deltaY
      }
    })
  }, [isDragging, dragStart, initialPosition, scale, node.id, updateNode])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
    }
  }, [isDragging])

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
      
      default:
        return <div style={{ width: '100%', height: '100%', background: '#ccc' }} />
    }
  }

  if (!component) return null

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
        width: node.size.width,
        height: node.size.height,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxSizing: 'border-box'
      }}
      className={isSelected ? 'selection-outline' : ''}
    >
      {renderContent()}
    </div>
  )
}
