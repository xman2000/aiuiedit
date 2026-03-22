import { create } from 'zustand'
import type { Project, Page } from '@/types'
import { useCanvasStore } from '@/store/useCanvasStore'

interface ProjectState {
  currentProject: Project | null
  currentPage: Page | null
  projectPath: string
  isDirty: boolean
  
  // Actions
  setCurrentProject: (project: Project | null, path: string) => void
  setCurrentPage: (page: Page) => void
  updateProject: (updates: Partial<Project>) => void
  updateDesignSystem: (designSystem: Project['designSystem']) => void
  addPage: (page: Page) => void
  removePage: (pageId: string) => void
  updatePage: (pageId: string, updates: Partial<Page>) => void
  setDirty: (dirty: boolean) => void
  saveProject: () => Promise<void>
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  currentProject: null,
  currentPage: null,
  projectPath: '',
  isDirty: false,

  setCurrentProject: (project, path) => {
    set({
      currentProject: project,
      currentPage: project?.pages[0] || null,
      projectPath: path,
      isDirty: false
    })
  },

  setCurrentPage: (page) => {
    useCanvasStore.getState().deselectAll()
    set({ currentPage: page })
  },

  updateProject: (updates) => {
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, ...updates, updatedAt: new Date().toISOString() }
        : null,
      isDirty: true
    }))
  },

  updateDesignSystem: (designSystem) => {
    const { currentProject, updateProject } = get()
    if (currentProject) {
      updateProject({ designSystem })
    }
  },

  addPage: (page) => {
    const { currentProject } = get()
    if (currentProject) {
      useCanvasStore.getState().deselectAll()
      set({
        currentProject: {
          ...currentProject,
          pages: [...currentProject.pages, page],
          updatedAt: new Date().toISOString()
        },
        currentPage: page,
        isDirty: true
      })
    }
  },

  removePage: (pageId) => {
    const { currentProject, updateProject, currentPage, setCurrentPage } = get()
    if (currentProject) {
      const canvas = useCanvasStore.getState()
      const pageNodeIds = Array.from(canvas.nodes.values())
        .filter((node) => node.pageId === pageId)
        .map((node) => node.id)

      pageNodeIds.forEach((nodeId) => canvas.removeNode(nodeId))

      const filtered = currentProject.pages.filter((p) => p.id !== pageId)
      updateProject({ pages: filtered })
      
      if (currentPage?.id === pageId && filtered.length > 0) {
        setCurrentPage(filtered[0])
      }
    }
  },

  updatePage: (pageId, updates) => {
    const { currentProject, currentPage } = get()
    if (!currentProject) return

    const updatedPages = currentProject.pages.map((page) =>
      page.id === pageId ? { ...page, ...updates } : page
    )
    const nextCurrentPage = updatedPages.find((page) => page.id === currentPage?.id) || null

    set({
      currentProject: {
        ...currentProject,
        pages: updatedPages,
        updatedAt: new Date().toISOString()
      },
      currentPage: nextCurrentPage,
      isDirty: true
    })
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  saveProject: async () => {
    const { currentProject, projectPath } = get()
    if (!currentProject || !projectPath) return

    const canvasState = useCanvasStore.getState()
    const serializedCanvas = {
      nodes: Array.from(canvasState.nodes.values()),
      selectedIds: Array.from(canvasState.selectedIds),
      zoom: canvasState.zoom,
      viewport: canvasState.viewport
    }

    await window.electron.saveProject(projectPath, {
      project: {
        ...currentProject,
        updatedAt: new Date().toISOString()
      },
      canvas: serializedCanvas
    })

    set({ isDirty: false })
  }
}))
