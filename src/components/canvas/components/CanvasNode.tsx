import { useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
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
  const { updateNode, pushHistory, selectedIds, nodes } = useCanvasStore()
  const { setDirty } = useProjectStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 })
  const [initialPositions, setInitialPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 })

  const component = BUILT_IN_COMPONENTS.find(c => c.type === node.type)

  const splitByComma = (value: unknown): string[] => {
    if (typeof value !== 'string') return []
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  const splitRows = (value: unknown): string[][] => {
    if (typeof value !== 'string') return []
    return value
      .split(';')
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split('|').map((cell) => cell.trim()))
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    
    e.stopPropagation()
    onSelect(e)

    if (node.locked) return
    
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPosition({ x: node.position.x, y: node.position.y })

    if (isSelected && selectedIds.size > 1) {
      const allInitial: Record<string, { x: number; y: number }> = {}
      selectedIds.forEach((id) => {
        const selectedNode = nodes.get(id)
        if (selectedNode) {
          allInitial[id] = {
            x: selectedNode.position.x,
            y: selectedNode.position.y
          }
        }
      })
      setInitialPositions(allInitial)
    } else {
      setInitialPositions({
        [node.id]: { x: node.position.x, y: node.position.y }
      })
    }
  }, [node.id, node.locked, node.position, onSelect, isSelected, selectedIds, nodes])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = (e.clientX - dragStart.x) / scale
      const deltaY = (e.clientY - dragStart.y) / scale

      const dragIds = Object.keys(initialPositions)
      if (dragIds.length > 1) {
        dragIds.forEach((id) => {
          const start = initialPositions[id]
          updateNode(id, {
            position: {
              x: start.x + deltaX,
              y: start.y + deltaY
            }
          })
        })
      } else {
        updateNode(node.id, {
          position: {
            x: initialPosition.x + deltaX,
            y: initialPosition.y + deltaY
          }
        })
      }
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
  }, [isDragging, isResizing, resizeHandle, dragStart, initialPosition, initialPositions, initialSize, scale, node.id, updateNode])

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      pushHistory()
      setDirty(true)
    }
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
  }, [isDragging, isResizing, pushHistory, setDirty])

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation()
    e.preventDefault()

    if (node.locked) return
    
    setIsResizing(true)
    setResizeHandle(handle)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPosition({ x: node.position.x, y: node.position.y })
    setInitialSize({ 
      width: typeof node.size.width === 'number' ? node.size.width : parseInt(node.size.width as string) || 100, 
      height: typeof node.size.height === 'number' ? node.size.height : parseInt(node.size.height as string) || 100 
    })
  }, [node.locked, node.position, node.size])

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

      case 'navbar': {
        const links = splitByComma(node.props.links)
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <span style={{ fontWeight: 700 }}>{node.props.brand || 'Brand'}</span>
            <div style={{ display: 'flex', gap: '14px', fontSize: '13px', opacity: 0.95 }}>
              {links.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
            </div>
          </div>
        )
      }

      case 'tabs': {
        const tabs = splitByComma(node.props.tabs)
        const active = Math.max(0, Math.min(tabs.length - 1, Number(node.props.activeTab) || 0))
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
              {tabs.map((tab, index) => (
                <div
                  key={`${tab}-${index}`}
                  style={{
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontWeight: index === active ? 600 : 500,
                    borderBottom: index === active ? '2px solid #3B82F6' : '2px solid transparent',
                    color: index === active ? '#1D4ED8' : '#6B7280'
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>
            <div style={{ padding: '12px', fontSize: '13px', color: '#6B7280' }}>Tab content preview</div>
          </div>
        )
      }

      case 'breadcrumb': {
        const items = splitByComma(node.props.items)
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {items.map((item, index) => (
              <div key={`${item}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: index === items.length - 1 ? 600 : 400 }}>{item}</span>
                {index < items.length - 1 && <span style={{ color: '#9CA3AF' }}>/</span>}
              </div>
            ))}
          </div>
        )
      }

      case 'pagination': {
        const currentPage = Math.max(1, Number(node.props.currentPage) || 1)
        const totalPages = Math.max(1, Number(node.props.totalPages) || 1)
        const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1)
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '12px', color: '#6B7280' }}>{'<'}</span>
            {pages.map((page) => (
              <div
                key={page}
                style={{
                  minWidth: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: page === currentPage ? '#2563EB' : '#FFFFFF',
                  color: page === currentPage ? '#FFFFFF' : '#374151',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {page}
              </div>
            ))}
            <span style={{ fontSize: '12px', color: '#6B7280' }}>{'>'}</span>
          </div>
        )
      }

      case 'alert': {
        const variant = (node.props.variant || 'warning') as string
        const palette: Record<string, { bg: string; border: string; text: string }> = {
          info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
          success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
          warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
          error: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' }
        }
        const colors = palette[variant] || palette.warning

        return (
          <div
            style={{
              ...node.style,
              backgroundColor: colors.bg,
              borderColor: colors.border,
              color: colors.text,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>{node.props.title || 'Alert'}</div>
            <div style={{ fontSize: '13px' }}>{node.props.message || 'Message'}</div>
          </div>
        )
      }

      case 'progress': {
        const value = Math.max(0, Math.min(100, Number(node.props.value) || 0))
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4B5563' }}>
              <span>{node.props.label || 'Progress'}</span>
              <span>{value}%</span>
            </div>
            <div style={{ height: '8px', borderRadius: '9999px', backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
              <div style={{ width: `${value}%`, height: '100%', borderRadius: 'inherit', backgroundColor: '#3B82F6' }} />
            </div>
          </div>
        )
      }

      case 'toast': {
        const variant = (node.props.variant || 'success') as string
        const accent: Record<string, string> = {
          success: '#10B981',
          info: '#3B82F6',
          warning: '#F59E0B',
          error: '#EF4444'
        }
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: accent[variant] || accent.success }} />
            <span style={{ fontSize: '13px' }}>{node.props.message || 'Notification'}</span>
          </div>
        )
      }

      case 'modal':
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>{node.props.title || 'Modal title'}</div>
              <p style={{ margin: 0, color: '#6B7280', fontSize: '13px' }}>{node.props.body || 'Modal body'}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={{ border: '1px solid #D1D5DB', borderRadius: '6px', background: '#FFFFFF', padding: '6px 10px', fontSize: '12px' }}>{node.props.cancelText || 'Cancel'}</button>
              <button style={{ border: 'none', borderRadius: '6px', background: '#2563EB', color: '#FFFFFF', padding: '6px 10px', fontSize: '12px' }}>{node.props.confirmText || 'Confirm'}</button>
            </div>
          </div>
        )

      case 'radio': {
        const options = splitByComma(node.props.options)
        const selected = (node.props.selected || '').toString()
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{node.props.label || 'Choose one'}</span>
            {options.map((option) => (
              <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input type="radio" checked={option === selected} readOnly />
                {option}
              </label>
            ))}
          </div>
        )
      }

      case 'switch': {
        const checked = Boolean(node.props.checked)
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '13px' }}>{node.props.label || 'Switch'}</span>
            <span
              style={{
                width: '42px',
                height: '24px',
                backgroundColor: checked ? '#2563EB' : '#D1D5DB',
                borderRadius: '9999px',
                position: 'relative'
              }}
            >
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '9999px',
                  backgroundColor: '#FFFFFF',
                  position: 'absolute',
                  top: '3px',
                  left: checked ? '21px' : '3px'
                }}
              />
            </span>
          </div>
        )
      }

      case 'slider': {
        const min = Number(node.props.min) || 0
        const max = Number(node.props.max) || 100
        const value = Math.max(min, Math.min(max, Number(node.props.value) || min))
        const progress = max === min ? 0 : ((value - min) / (max - min)) * 100

        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span>{node.props.label || 'Slider'}</span>
              <span>{value}</span>
            </div>
            <div style={{ position: 'relative', height: '6px', borderRadius: '9999px', backgroundColor: '#E5E7EB' }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 'inherit', backgroundColor: '#2563EB' }} />
            </div>
          </div>
        )
      }

      case 'table': {
        const headers = splitByComma(node.props.headers)
        const rows = splitRows(node.props.rows)
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#F9FAFB' }}>
                <tr>
                  {headers.map((header) => (
                    <th key={header} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #E5E7EB' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`cell-${rowIndex}-${cellIndex}`} style={{ padding: '8px', borderBottom: '1px solid #F3F4F6', color: '#4B5563' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      case 'list': {
        const items = splitByComma(node.props.items)
        const isOrdered = Boolean(node.props.ordered)
        const ListTag = isOrdered ? 'ol' : 'ul'
        return (
          <ListTag
            style={{
              ...node.style,
              pointerEvents: 'none',
              margin: 0,
              paddingLeft: '20px',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ListTag>
        )
      }

      case 'statistic':
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{node.props.label || 'Statistic'}</span>
            <span style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{node.props.value || '0'}</span>
            <span style={{ fontSize: '12px', color: '#059669' }}>{node.props.trend || '+0%'}</span>
          </div>
        )

      case 'timeline': {
        const events = splitRows(node.props.events)
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {events.map((event, index) => (
              <div key={`event-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '8px', height: '8px', marginTop: '6px', borderRadius: '9999px', backgroundColor: '#3B82F6' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{event[0] || 'Event'}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>{event[1] || ''}</div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'group':
        return (
          <div
            style={{
              ...node.style,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '9999px',
                backgroundColor: '#DBEAFE',
                color: '#1D4ED8',
                transform: 'translate(6px, 6px)'
              }}
            >
              Group ({node.children.length})
            </span>
          </div>
        )

      default:
        return <div style={{ width: '100%', height: '100%', background: '#ccc' }} />
    }
  }

  if (!component && node.type !== 'group') return null

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
        cursor: node.locked ? 'not-allowed' : isDragging ? 'grabbing' : isResizing ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxSizing: 'border-box',
        opacity: node.locked ? 0.9 : 1
      }}
      className={isSelected ? 'selection-outline' : ''}
    >
      {renderContent()}
      
      {/* Resize Handles */}
      {isSelected && !isDragging && !node.locked && (
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
