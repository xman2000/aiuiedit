import { useState } from 'react'
import { Layers, Search } from 'lucide-react'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'
import type { ComponentDefinition } from '@/types'

interface ComponentLibraryProps {
  onAddComponent?: (type: string) => void
}

export function ComponentLibrary({ onAddComponent }: ComponentLibraryProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = Array.from(new Set(BUILT_IN_COMPONENTS.map(c => c.category)))

  const filteredComponents = BUILT_IN_COMPONENTS.filter(component => {
    const matchesSearch = component.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !activeCategory || component.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const handleDragStart = (e: React.DragEvent, component: ComponentDefinition) => {
    e.dataTransfer.setData('component-type', component.type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-3">
        <div className="mb-3 flex items-center gap-2 text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span className="text-sm font-medium">Components</span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Category Filter */}
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
              !activeCategory
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-2 py-0.5 text-xs capitalize transition-colors ${
                activeCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Components List */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-2">
          {filteredComponents.map(component => (
            <div
              key={component.type}
              draggable
              onDragStart={(e) => handleDragStart(e, component)}
              onClick={() => onAddComponent?.(component.type)}
              className="group flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-card">
                <ComponentIcon name={component.icon} />
              </div>
              
              <div className="flex-1">
                <p className="text-sm font-medium">{component.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{component.category}</p>
              </div>
              
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-xs text-primary">Click to add</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Simple icon mapping
function ComponentIcon({ name }: { name: string }) {
  const iconClass = "h-5 w-5 text-muted-foreground"
  
  switch (name) {
    case 'MousePointerClick':
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
    case 'Type':
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
    case 'Heading':
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
    case 'Square':
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} /></svg>
    case 'Image':
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15l-5-5L5 21" /></svg>
    case 'TextCursor':
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    default:
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} /></svg>
  }
}
