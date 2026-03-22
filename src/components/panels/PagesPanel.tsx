import { useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { Button } from '@/components/common/Button'
import { Plus, FileText, Trash2, ChevronRight } from 'lucide-react'
import type { Page } from '@/types'

export function PagesPanel() {
  const { currentProject, currentPage, projectPath, setCurrentPage, addPage, removePage, updatePage } = useProjectStore()
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
      route: `/${newPageName.toLowerCase().replace(/\s+/g, '-')}`,
      title: newPageName,
      description: '',
      template: 'default',
      noIndex: false,
      authRequired: false
    }
    
    addPage(newPage)
    syncPageToSource(newPage)
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

  const handlePageChange = (key: keyof Page, value: string | boolean) => {
    if (!currentPage) return
    updatePage(currentPage.id, { [key]: value })
  }

  const syncPageToSource = async (page: Page) => {
    const shouldSync =
      currentProject?.source?.roundTrip &&
      projectPath

    if (!shouldSync) return

    try {
      const result = await window.electron.syncSourcePage({
        projectPath,
        page: {
          id: page.id,
          name: page.name,
          route: page.route,
          title: page.title || '',
          description: page.description || ''
        }
      })

      if (result.route !== page.route) {
        updatePage(page.id, { route: result.route })
      }
    } catch (error) {
      console.error('Page source sync failed:', error)
      window.showToast(`Page sync failed: ${error}`, 'error')
    }
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

      {/* Page Properties */}
      {currentPage && (
        <div className="border-t p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Properties</p>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              type="text"
              value={currentPage.name}
              onChange={(e) => handlePageChange('name', e.target.value)}
              onBlur={() => {
                const latest = useProjectStore.getState().currentPage
                if (latest) {
                  syncPageToSource(latest)
                }
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Route</label>
            <input
              type="text"
              value={currentPage.route}
              onChange={(e) => handlePageChange('route', e.target.value)}
              onBlur={() => {
                const latest = useProjectStore.getState().currentPage
                if (latest) {
                  syncPageToSource(latest)
                }
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">SEO Title</label>
            <input
              type="text"
              value={currentPage.title || ''}
              onChange={(e) => handlePageChange('title', e.target.value)}
              onBlur={() => {
                const latest = useProjectStore.getState().currentPage
                if (latest) {
                  syncPageToSource(latest)
                }
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">SEO Description</label>
            <textarea
              rows={3}
              value={currentPage.description || ''}
              onChange={(e) => handlePageChange('description', e.target.value)}
              onBlur={() => {
                const latest = useProjectStore.getState().currentPage
                if (latest) {
                  syncPageToSource(latest)
                }
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Template</label>
            <select
              value={currentPage.template || 'default'}
              onChange={(e) => handlePageChange('template', e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="default">Default</option>
              <option value="landing">Landing</option>
              <option value="docs">Docs</option>
              <option value="dashboard">Dashboard</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(currentPage.noIndex)}
              onChange={(e) => handlePageChange('noIndex', e.target.checked)}
            />
            No-index (exclude from search engines)
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(currentPage.authRequired)}
              onChange={(e) => handlePageChange('authRequired', e.target.checked)}
            />
            Authentication required
          </label>
        </div>
      )}
    </div>
  )
}
