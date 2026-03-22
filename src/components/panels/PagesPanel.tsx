import { useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { Button } from '@/components/common/Button'
import { Plus, FileText, Trash2, ChevronRight, Settings } from 'lucide-react'
import type { Page } from '@/types'

export function PagesPanel() {
  const { currentProject, currentPage, setCurrentPage, addPage, removePage, updateProject } = useProjectStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newPageName, setNewPageName] = useState('')

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">Open a project to manage pages</p>
      </div>
    )
  }

  const handleAddPage = () => {
    if (!newPageName.trim()) return
    
    const newPage: Page = {
      id: `page-${Date.now()}`,
      name: newPageName,
      route: `/${newPageName.toLowerCase().replace(/\s+/g, '-')}`
    }
    
    addPage(newPage)
    setNewPageName('')
    setIsAdding(false)
  }

  const handleRemovePage = (pageId: string) => {
    if (currentProject.pages.length <= 1) {
      window.showToast?.('Cannot delete the last page', 'error')
      return
    }
    removePage(pageId)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Pages</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {currentProject.pages.length} total
          </span>
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          {currentProject.pages.map((page) => (
            <div
              key={page.id}
              onClick={() => setCurrentPage(page)}
              className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors ${
                currentPage?.id === page.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              }`}
            >
              <FileText className="h-4 w-4 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{page.name}</p>
                <p className="text-xs text-muted-foreground truncate">{page.route}</p>
              </div>

              {currentPage?.id === page.id && (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemovePage(page.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity"
                title="Delete page"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Page */}
      <div className="border-t p-3">
        {isAdding ? (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Page name"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPage()}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1"
                onClick={handleAddPage}
                disabled={!newPageName.trim()}
              >
                Add
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setIsAdding(false)
                  setNewPageName('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Page
          </Button>
        )}
      </div>
    </div>
  )
}
