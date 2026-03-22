import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
import { Settings2, Layout, Type, Palette, Box } from 'lucide-react'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'

export function PropertiesPanel() {
  const { selectedIds, nodes, updateNode } = useCanvasStore()
  const { setDirty } = useProjectStore()
  const selectedNodes = Array.from(selectedIds).map((id) => nodes.get(id)).filter(Boolean)

  if (selectedNodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <Settings2 className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select an element to edit its properties
        </p>
      </div>
    )
  }

  const node = selectedNodes[0]
  const component = BUILT_IN_COMPONENTS.find(c => c.type === node?.type)

  if (!node || !component) {
    return <div className="p-4">Unknown component type</div>
  }

  const handlePropChange = (propName: string, value: any) => {
    updateNode(node.id, {
      props: { ...node.props, [propName]: value }
    })
    setDirty(true)
  }

  const handleStyleChange = (styleProp: string, value: string) => {
    updateNode(node.id, {
      style: { ...node.style, [styleProp]: value }
    })
    setDirty(true)
  }

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    updateNode(node.id, {
      position: { ...node.position, [axis]: value }
    })
    setDirty(true)
  }

  const handleSizeChange = (dimension: 'width' | 'height', value: number | string) => {
    updateNode(node.id, {
      size: { ...node.size, [dimension]: value }
    })
    setDirty(true)
  }

  const handleToggleLock = (value: boolean) => {
    updateNode(node.id, { locked: value })
    setDirty(true)
  }

  const handleToggleVisibility = (value: boolean) => {
    updateNode(node.id, { visible: value })
    setDirty(true)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">{node.name}</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{component.category}</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* Layout Section */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layout className="h-3 w-3" />
              Layout
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border p-2">
                <label className="text-xs text-muted-foreground">X</label>
                <input 
                  type="number" 
                  value={Math.round(node.position.x)}
                  onChange={(e) => handlePositionChange('x', parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="rounded border p-2">
                <label className="text-xs text-muted-foreground">Y</label>
                <input 
                  type="number"
                  value={Math.round(node.position.y)}
                  onChange={(e) => handlePositionChange('y', parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="rounded border p-2">
                <label className="text-xs text-muted-foreground">Width</label>
                <input 
                  type="text"
                  value={typeof node.size.width === 'number' ? node.size.width : node.size.width}
                  onChange={(e) => handleSizeChange('width', e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="rounded border p-2">
                <label className="text-xs text-muted-foreground">Height</label>
                <input 
                  type="text"
                  value={typeof node.size.height === 'number' ? node.size.height : node.size.height}
                  onChange={(e) => handleSizeChange('height', e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {/* Node State */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Settings2 className="h-3 w-3" />
              Node State
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex items-center gap-2 rounded border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(node.locked)}
                  onChange={(e) => handleToggleLock(e.target.checked)}
                />
                Locked
              </label>

              <label className="inline-flex items-center gap-2 rounded border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(node.visible)}
                  onChange={(e) => handleToggleVisibility(e.target.checked)}
                />
                Visible
              </label>
            </div>
          </div>

          {/* Appearance Section */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Palette className="h-3 w-3" />
              Appearance
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Background Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={node.style.backgroundColor as string || '#ffffff'}
                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                    className="h-8 w-8 rounded border p-0"
                  />
                  <input
                    type="text"
                    value={node.style.backgroundColor as string || ''}
                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                    className="flex-1 rounded border px-2 py-1 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Text Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={node.style.color as string || '#000000'}
                    onChange={(e) => handleStyleChange('color', e.target.value)}
                    className="h-8 w-8 rounded border p-0"
                  />
                  <input
                    type="text"
                    value={node.style.color as string || ''}
                    onChange={(e) => handleStyleChange('color', e.target.value)}
                    className="flex-1 rounded border px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Border Radius</label>
                <input
                  type="text"
                  value={node.style.borderRadius as string || '0'}
                  onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Padding</label>
                <input
                  type="text"
                  value={node.style.padding as string || '0'}
                  onChange={(e) => handleStyleChange('padding', e.target.value)}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Properties Section */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Type className="h-3 w-3" />
              Properties
            </div>
            
            <div className="space-y-2">
              {component.properties.map(prop => (
                <div key={prop.name}>
                  <label className="mb-1 block text-xs text-muted-foreground">{prop.label}</label>
                  
                  {prop.type === 'string' && (
                    <input
                      type="text"
                      value={node.props[prop.name] || ''}
                      onChange={(e) => handlePropChange(prop.name, e.target.value)}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  )}
                  
                  {prop.type === 'number' && (
                    <input
                      type="number"
                      value={node.props[prop.name] || 0}
                      onChange={(e) => handlePropChange(prop.name, parseInt(e.target.value) || 0)}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  )}
                  
                  {prop.type === 'select' && prop.options && (
                    <select
                      value={node.props[prop.name] || prop.default}
                      onChange={(e) => handlePropChange(prop.name, e.target.value)}
                      className="w-full rounded border px-2 py-1 text-sm bg-background"
                    >
                      {prop.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  )}

                  {prop.type === 'boolean' && (
                    <label className="inline-flex items-center gap-2 rounded border px-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(node.props[prop.name])}
                        onChange={(e) => handlePropChange(prop.name, e.target.checked)}
                      />
                      {Boolean(node.props[prop.name]) ? 'True' : 'False'}
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
