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

  setCurrentPage: (page) => set({ currentPage: page }),

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
    const { currentProject, updateProject } = get()
    if (currentProject) {
      updateProject({
        pages: [...currentProject.pages, page]
      })
    }
  },

  removePage: (pageId) => {
    const { currentProject, updateProject, currentPage, setCurrentPage } = get()
    if (currentProject) {
      const filtered = currentProject.pages.filter((p) => p.id !== pageId)
      updateProject({ pages: filtered })
      
      if (currentPage?.id === pageId && filtered.length > 0) {
        setCurrentPage(filtered[0])
      }
    }
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
