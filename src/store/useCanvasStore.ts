import { create } from 'zustand'
import type { CanvasNode, CanvasState } from '@/types'

interface CanvasStore extends CanvasState {
  // Actions
  setNodes: (nodes: Map<string, CanvasNode>) => void
  addNode: (node: CanvasNode) => void
  updateNode: (id: string, updates: Partial<CanvasNode>) => void
  removeNode: (id: string) => void
  deleteNode: (id: string) => void
  
  // Selection
  selectNode: (id: string, multi?: boolean) => void
  deselectNode: (id: string) => void
  deselectAll: () => void
  selectAll: () => void
  
  // Viewport
  setZoom: (zoom: number) => void
  setViewport: (viewport: { x: number; y: number }) => void
  
  // History
  history: CanvasState[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  pushHistory: () => void
  
  // Clipboard
  clipboard: CanvasNode[]
  copySelected: () => void
  paste: () => void
}

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
  nodes: new Map(),
  rootId: 'root',
  selectedIds: new Set(),
  zoom: 1,
  viewport: { x: 0, y: 0 },
  
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  clipboard: [],

  setNodes: (nodes) => set({ nodes }),

  addNode: (node) => {
    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.set(node.id, node)
      return { nodes: newNodes }
    })
    get().pushHistory()
  },

  updateNode: (id, updates) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state
      
      const newNodes = new Map(state.nodes)
      newNodes.set(id, { ...node, ...updates })
      return { nodes: newNodes }
    })
  },

  removeNode: (id) => {
    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.delete(id)
      
      const newSelected = new Set(state.selectedIds)
      newSelected.delete(id)
      
      return { nodes: newNodes, selectedIds: newSelected }
    })
    get().pushHistory()
  },

  deleteNode: (id) => {
    get().removeNode(id)
  },

  selectNode: (id, multi = false) => {
    set((state) => {
      if (multi) {
        const newSelected = new Set(state.selectedIds)
        if (newSelected.has(id)) {
          newSelected.delete(id)
        } else {
          newSelected.add(id)
        }
        return { selectedIds: newSelected }
      }
      return { selectedIds: new Set([id]) }
    })
  },

  deselectNode: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds)
      newSelected.delete(id)
      return { selectedIds: newSelected }
    })
  },

  deselectAll: () => set({ selectedIds: new Set() }),

  selectAll: () => {
    set((state) => ({
      selectedIds: new Set(state.nodes.keys())
    }))
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

  setViewport: (viewport) => set({ viewport }),

  pushHistory: () => {
    set((state) => {
      const snapshot = {
        nodes: new Map(state.nodes),
        rootId: state.rootId,
        selectedIds: new Set(state.selectedIds),
        zoom: state.zoom,
        viewport: { ...state.viewport }
      }
      
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(snapshot)
      
      // Limit history to 50 states
      if (newHistory.length > 50) {
        newHistory.shift()
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: newHistory.length > 1,
        canRedo: false
      }
    })
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex <= 0) return state
      
      const newIndex = state.historyIndex - 1
      const snapshot = state.history[newIndex]
      
      return {
        nodes: new Map(snapshot.nodes),
        rootId: snapshot.rootId,
        selectedIds: new Set(snapshot.selectedIds),
        zoom: snapshot.zoom,
        viewport: { ...snapshot.viewport },
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: true
      }
    })
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      
      const newIndex = state.historyIndex + 1
      const snapshot = state.history[newIndex]
      
      return {
        nodes: new Map(snapshot.nodes),
        rootId: snapshot.rootId,
        selectedIds: new Set(snapshot.selectedIds),
        zoom: snapshot.zoom,
        viewport: { ...snapshot.viewport },
        historyIndex: newIndex,
        canUndo: true,
        canRedo: newIndex < state.history.length - 1
      }
    })
  },

  copySelected: () => {
    set((state) => {
      const copied: CanvasNode[] = []
      state.selectedIds.forEach(id => {
        const node = state.nodes.get(id)
        if (node) {
          copied.push({ ...node })
        }
      })
      return { clipboard: copied }
    })
  },

  paste: () => {
    set((state) => {
      if (state.clipboard.length === 0) return state

      const newNodes = new Map(state.nodes)
      const newSelected = new Set<string>()

      state.clipboard.forEach(node => {
        const newNode: CanvasNode = {
          ...node,
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          position: {
            x: node.position.x + 20,
            y: node.position.y + 20
          }
        }
        newNodes.set(newNode.id, newNode)
        newSelected.add(newNode.id)
      })

      return { 
        nodes: newNodes, 
        selectedIds: newSelected,
        clipboard: state.clipboard.map(n => ({
          ...n,
          position: { x: n.position.x + 20, y: n.position.y + 20 }
        }))
      }
    })
    get().pushHistory()
  }
}))
