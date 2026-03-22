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
  selectAllInPage: (pageId: string) => void
  
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

  // Alignment
  alignSelected: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  distributeSelected: (axis: 'horizontal' | 'vertical') => void

  // Grouping
  groupSelected: () => void
  ungroupSelected: () => void

  // Node state
  toggleLockSelected: () => void
  toggleVisibilitySelected: () => void
}

function readNodeDimension(value: number | string, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseFloat(value.replace('px', ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function getNodeMetrics(node: CanvasNode): { x: number; y: number; width: number; height: number } {
  return {
    x: node.position.x,
    y: node.position.y,
    width: readNodeDimension(node.size.width, 100),
    height: readNodeDimension(node.size.height, 40)
  }
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

      if (updates.position && node.type === 'group') {
        const deltaX = updates.position.x - node.position.x
        const deltaY = updates.position.y - node.position.y

        node.children.forEach((childId) => {
          const child = newNodes.get(childId)
          if (!child) return

          newNodes.set(childId, {
            ...child,
            position: {
              x: child.position.x + deltaX,
              y: child.position.y + deltaY
            }
          })
        })
      }

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

  selectAllInPage: (pageId) => {
    set((state) => ({
      selectedIds: new Set(
        Array.from(state.nodes.values())
          .filter((node) => node.visible && node.pageId === pageId)
          .map((node) => node.id)
      )
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
  },

  alignSelected: (mode) => {
    set((state) => {
      const selectedNodes = Array.from(state.selectedIds)
        .map((id) => state.nodes.get(id))
        .filter(Boolean) as CanvasNode[]

      if (selectedNodes.length === 0) return state

      const metrics = selectedNodes.map(getNodeMetrics)
      const left = Math.min(...metrics.map((item) => item.x))
      const right = Math.max(...metrics.map((item) => item.x + item.width))
      const top = Math.min(...metrics.map((item) => item.y))
      const bottom = Math.max(...metrics.map((item) => item.y + item.height))
      const centerX = (left + right) / 2
      const centerY = (top + bottom) / 2

      const newNodes = new Map(state.nodes)

      selectedNodes.forEach((node) => {
        const { width, height } = getNodeMetrics(node)
        let nextX = node.position.x
        let nextY = node.position.y

        if (mode === 'left') nextX = left
        if (mode === 'center') nextX = centerX - width / 2
        if (mode === 'right') nextX = right - width
        if (mode === 'top') nextY = top
        if (mode === 'middle') nextY = centerY - height / 2
        if (mode === 'bottom') nextY = bottom - height

        newNodes.set(node.id, {
          ...node,
          position: { x: nextX, y: nextY }
        })
      })

      return { nodes: newNodes }
    })
    get().pushHistory()
  },

  distributeSelected: (axis) => {
    set((state) => {
      const selectedNodes = Array.from(state.selectedIds)
        .map((id) => state.nodes.get(id))
        .filter(Boolean) as CanvasNode[]

      if (selectedNodes.length < 3) return state

      const working = selectedNodes
        .map((node) => ({ node, ...getNodeMetrics(node) }))
        .sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y))

      const first = working[0]
      const last = working[working.length - 1]

      const rangeStart = axis === 'horizontal' ? first.x : first.y
      const rangeEnd = axis === 'horizontal' ? last.x + last.width : last.y + last.height
      const totalSize = working.reduce((sum, item) => sum + (axis === 'horizontal' ? item.width : item.height), 0)
      const availableSpace = rangeEnd - rangeStart - totalSize
      const gap = availableSpace / (working.length - 1)

      let cursor = rangeStart
      const newNodes = new Map(state.nodes)

      working.forEach((item) => {
        const size = axis === 'horizontal' ? item.width : item.height
        const nextX = axis === 'horizontal' ? cursor : item.node.position.x
        const nextY = axis === 'vertical' ? cursor : item.node.position.y

        newNodes.set(item.node.id, {
          ...item.node,
          position: { x: nextX, y: nextY }
        })

        cursor += size + gap
      })

      return { nodes: newNodes }
    })
    get().pushHistory()
  },

  groupSelected: () => {
    set((state) => {
      const selectedNodes = Array.from(state.selectedIds)
        .map((id) => state.nodes.get(id))
        .filter(Boolean) as CanvasNode[]

      if (selectedNodes.length < 2) return state

      const metrics = selectedNodes.map(getNodeMetrics)
      const left = Math.min(...metrics.map((item) => item.x))
      const right = Math.max(...metrics.map((item) => item.x + item.width))
      const top = Math.min(...metrics.map((item) => item.y))
      const bottom = Math.max(...metrics.map((item) => item.y + item.height))

      const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const groupNode: CanvasNode = {
        id: groupId,
        type: 'group',
        pageId: selectedNodes[0].pageId,
        parentId: null,
        position: { x: left, y: top },
        size: {
          width: right - left,
          height: bottom - top
        },
        style: {
          border: '1px dashed #60A5FA',
          borderRadius: '8px',
          backgroundColor: 'transparent'
        },
        props: {},
        children: selectedNodes.map((node) => node.id),
        name: 'Group',
        locked: false,
        visible: true
      }

      const newNodes = new Map(state.nodes)
      newNodes.set(groupId, groupNode)

      selectedNodes.forEach((node) => {
        newNodes.set(node.id, {
          ...node,
          parentId: groupId
        })
      })

      return {
        nodes: newNodes,
        selectedIds: new Set([groupId])
      }
    })
    get().pushHistory()
  },

  ungroupSelected: () => {
    set((state) => {
      const selectedGroupIds = Array.from(state.selectedIds).filter((id) => {
        const node = state.nodes.get(id)
        return node?.type === 'group'
      })

      if (selectedGroupIds.length === 0) return state

      const newNodes = new Map(state.nodes)
      const newSelectedIds = new Set<string>()

      selectedGroupIds.forEach((groupId) => {
        const groupNode = newNodes.get(groupId)
        if (!groupNode) return

        groupNode.children.forEach((childId) => {
          const child = newNodes.get(childId)
          if (!child) return

          newNodes.set(childId, {
            ...child,
            parentId: null
          })
          newSelectedIds.add(childId)
        })

        newNodes.delete(groupId)
      })

      return {
        nodes: newNodes,
        selectedIds: newSelectedIds
      }
    })
    get().pushHistory()
  },

  toggleLockSelected: () => {
    set((state) => {
      const selectedNodes = Array.from(state.selectedIds)
        .map((id) => state.nodes.get(id))
        .filter(Boolean) as CanvasNode[]

      if (selectedNodes.length === 0) return state

      const shouldLock = selectedNodes.some((node) => !node.locked)
      const newNodes = new Map(state.nodes)

      selectedNodes.forEach((node) => {
        newNodes.set(node.id, {
          ...node,
          locked: shouldLock
        })
      })

      return { nodes: newNodes }
    })
    get().pushHistory()
  },

  toggleVisibilitySelected: () => {
    set((state) => {
      const selectedNodes = Array.from(state.selectedIds)
        .map((id) => state.nodes.get(id))
        .filter(Boolean) as CanvasNode[]

      if (selectedNodes.length === 0) return state

      const shouldShow = selectedNodes.some((node) => !node.visible)
      const newNodes = new Map(state.nodes)
      const newSelected = new Set(state.selectedIds)

      selectedNodes.forEach((node) => {
        newNodes.set(node.id, {
          ...node,
          visible: shouldShow
        })

        if (!shouldShow) {
          newSelected.delete(node.id)
        }
      })

      return {
        nodes: newNodes,
        selectedIds: newSelected
      }
    })
    get().pushHistory()
  }
}))
