import { useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useProjectStore } from '@/store/useProjectStore'
import { Button } from '@/components/common/Button'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react'
import type { Page } from '@/types'

interface FileNode {
  name: string
  path: string
  page: Page
  sourceFile: string
}

interface DirNode {
  name: string
  path: string
  dirs: Map<string, DirNode>
  files: FileNode[]
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function toDirNode(name: string, path: string): DirNode {
  return {
    name,
    path,
    dirs: new Map<string, DirNode>(),
    files: []
  }
}

function pageSourcePath(page: Page, sourceMap: Record<string, { file: string }>): string {
  const sourceFile = sourceMap[page.id]?.file
  if (sourceFile) return normalizePath(sourceFile)

  if (page.route && page.route !== '/') {
    return `virtual${normalizePath(page.route)}.page`
  }

  return `virtual/${(page.name || 'home').toLowerCase().replace(/\s+/g, '-')}.page`
}

export function PagesPanel() {
  const { currentProject, currentPage, projectPath, setCurrentPage, addPage, removePage, updatePage } = useProjectStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newPageName, setNewPageName] = useState('')
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">Open a project to manage pages</p>
      </div>
    )
  }

  const sourceMap = currentProject.source?.pages || {}
  const hasSourceTree = Object.keys(sourceMap).length > 0

  const treeRoot = useMemo(() => {
    const root = toDirNode('root', '')
    const pages = [...currentProject.pages]
      .sort((a, b) => pageSourcePath(a, sourceMap).localeCompare(pageSourcePath(b, sourceMap)))

    pages.forEach((page) => {
      const srcPath = pageSourcePath(page, sourceMap)
      const segments = srcPath.split('/').filter(Boolean)
      const filename = segments.pop() || `${page.name}.page`

      let cursor = root
      let currentPath = ''

      segments.forEach((segment) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment
        if (!cursor.dirs.has(segment)) {
          cursor.dirs.set(segment, toDirNode(segment, currentPath))
        }
        cursor = cursor.dirs.get(segment) as DirNode
      })

      cursor.files.push({
        name: filename,
        path: srcPath,
        page,
        sourceFile: srcPath
      })
    })

    return root
  }, [currentProject.pages, sourceMap])

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
      currentProject?.source?.framework === 'nextjs' &&
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

  const toggleDir = (path: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const renderDir = (dir: DirNode, depth = 0): JSX.Element[] => {
    const rows: JSX.Element[] = []
    const orderedDirs = Array.from(dir.dirs.values()).sort((a, b) => a.name.localeCompare(b.name))
    const orderedFiles = [...dir.files].sort((a, b) => a.name.localeCompare(b.name))

    orderedDirs.forEach((childDir) => {
      const isCollapsed = collapsedDirs.has(childDir.path)
      rows.push(
        <button
          key={`dir:${childDir.path}`}
          onClick={() => toggleDir(childDir.path)}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {isCollapsed ? <Folder className="h-4 w-4 text-muted-foreground" /> : <FolderOpen className="h-4 w-4 text-muted-foreground" />}
          <span className="truncate">{childDir.name}</span>
        </button>
      )

      if (!isCollapsed) {
        rows.push(...renderDir(childDir, depth + 1))
      }
    })

    orderedFiles.forEach((file) => {
      const selected = currentPage?.id === file.page.id
      rows.push(
        <div
          key={`file:${file.path}:${file.page.id}`}
          onClick={() => setCurrentPage(file.page)}
          className={`group flex cursor-pointer items-start gap-2 rounded-md border-l-2 px-2 py-1.5 transition-colors ${
            selected ? 'border-l-primary bg-primary/10' : 'border-l-transparent hover:bg-muted'
          }`}
          style={{ paddingLeft: `${20 + depth * 16}px` }}
        >
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.page.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{file.sourceFile}</p>
            <p className="truncate text-[11px] text-muted-foreground/80">{file.page.route}</p>
          </div>

          <Button
            onClick={(e) => {
              e.stopPropagation()
              handleRemovePage(file.page.id)
            }}
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
            title="Delete page"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )
    })

    return rows
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Pages</span>
          </div>
          <span className="text-xs text-muted-foreground">{currentProject.pages.length} total</span>
        </div>
        {hasSourceTree && (
          <p className="mt-1 text-xs text-muted-foreground">Source file tree</p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="vertical">
          <Panel defaultSize={62} minSize={25}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-1 overflow-auto p-2">
                {hasSourceTree ? (
                  <div className="space-y-0.5">{renderDir(treeRoot)}</div>
                ) : (
                  <div className="space-y-1">
                    {currentProject.pages.map((page) => (
                      <div
                        key={page.id}
                        onClick={() => setCurrentPage(page)}
                        className={`group flex items-center gap-2 rounded-md border-l-2 px-3 py-2 cursor-pointer transition-colors ${
                          currentPage?.id === page.id
                            ? 'bg-primary/10 text-primary border-l-primary'
                            : 'border-l-transparent hover:bg-muted'
                        }`}
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{page.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{page.route}</p>
                        </div>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemovePage(page.id)
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          title="Delete page"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                      <Button size="sm" className="flex-1" onClick={handleAddPage} disabled={!newPageName.trim()}>
                        Add
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setIsAdding(false)
                        setNewPageName('')
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Page
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="h-1 bg-border hover:bg-primary/40" />

          <Panel defaultSize={38} minSize={20}>
            {currentPage ? (
              <div className="h-full overflow-auto border-t p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Properties</p>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <input
                    type="text"
                    value={currentPage.name}
                    onChange={(e) => handlePageChange('name', e.target.value)}
                    onBlur={() => {
                      const latest = useProjectStore.getState().currentPage
                      if (latest) syncPageToSource(latest)
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
                      if (latest) syncPageToSource(latest)
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
                      if (latest) syncPageToSource(latest)
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
                      if (latest) syncPageToSource(latest)
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

                <div className="grid grid-cols-1 gap-2">
                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(currentPage.noIndex)}
                      onChange={(e) => handlePageChange('noIndex', e.target.checked)}
                    />
                    No-index (exclude from search engines)
                  </label>

                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(currentPage.authRequired)}
                      onChange={(e) => handlePageChange('authRequired', e.target.checked)}
                    />
                    Authentication required
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                Select a page to edit properties
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
