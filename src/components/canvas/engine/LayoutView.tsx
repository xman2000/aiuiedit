import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, MoveLeft, MoveRight, MoveUp, MoveDown, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
import { createCanvasNode } from '@/core/canvasNodeFactory'
import type { CanvasNode, Page } from '@/types'

interface LayoutViewProps {
  currentPage?: Page
}

type DropPosition = 'before' | 'inside' | 'after' | 'root'

function readDimension(value: number | string, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseFloat(value.replace('px', ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function sortedChildren(map: Map<string, CanvasNode>, pageId: string, parentId: string | null): CanvasNode[] {
  return Array.from(map.values())
    .filter((node) => node.pageId === pageId && ((node.parentId || null) === parentId))
    .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
}

export function LayoutView({ currentPage }: LayoutViewProps) {
  const {
    nodes,
    selectedIds,
    selectNode,
    setNodes,
    pushHistory,
    updateNode,
    deselectAll,
    removeNode
  } = useCanvasStore()
  const { setDirty } = useProjectStore()

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{ id: string; position: DropPosition } | null>(null)

  const isTypingTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
  }

  const pageNodes = useMemo(() => {
    if (!currentPage) return []
    return Array.from(nodes.values())
      .filter((node) => node.pageId === currentPage.id)
      .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
  }, [nodes, currentPage])

  const pageNodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>()
    pageNodes.forEach((node) => map.set(node.id, node))
    return map
  }, [pageNodes])

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, string[]>()
    pageNodes.forEach((node) => {
      const parentId = node.parentId && pageNodeMap.has(node.parentId) ? node.parentId : null
      const list = map.get(parentId) || []
      list.push(node.id)
      map.set(parentId, list)
    })

    map.forEach((ids) => {
      ids.sort((a, b) => {
        const nodeA = pageNodeMap.get(a)
        const nodeB = pageNodeMap.get(b)
        if (!nodeA || !nodeB) return 0
        return (nodeA.position.y - nodeB.position.y) || (nodeA.position.x - nodeB.position.x)
      })
    })

    return map
  }, [pageNodes, pageNodeMap])

  const selectedNode = useMemo(() => {
    const [first] = Array.from(selectedIds)
    return first ? pageNodeMap.get(first) : undefined
  }, [selectedIds, pageNodeMap])

  const commitNodeMap = (mutate: (draft: Map<string, CanvasNode>) => void) => {
    const draft = new Map<string, CanvasNode>()
    nodes.forEach((node, id) => {
      draft.set(id, { ...node, children: [...node.children] })
    })

    mutate(draft)

    draft.forEach((node) => {
      if (node.pageId === currentPage?.id) {
        node.children = []
      }
    })

    draft.forEach((node) => {
      if (node.pageId !== currentPage?.id || !node.parentId) return
      const parent = draft.get(node.parentId)
      if (!parent || parent.pageId !== node.pageId) return
      parent.children.push(node.id)
    })

    setNodes(draft)
    pushHistory()
    setDirty(true)
  }

  const isDescendant = (candidateId: string, ancestorId: string, map: Map<string, CanvasNode>): boolean => {
    let current = map.get(candidateId)
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true
      current = map.get(current.parentId)
    }
    return false
  }

  const moveNodeTo = (nodeId: string, targetParentId: string | null, insertIndex?: number) => {
    if (!currentPage) return

    commitNodeMap((draft) => {
      const moving = draft.get(nodeId)
      if (!moving) return

      if (targetParentId) {
        const targetParent = draft.get(targetParentId)
        if (!targetParent || targetParent.pageId !== currentPage.id) return
        if (targetParent.id === moving.id) return
        if (isDescendant(targetParent.id, moving.id, draft)) return
      }

      moving.parentId = targetParentId
      draft.set(nodeId, moving)

      const siblings = sortedChildren(draft, currentPage.id, targetParentId).filter((node) => node.id !== nodeId)
      const insertion = insertIndex === undefined
        ? siblings.length
        : Math.max(0, Math.min(insertIndex, siblings.length))

      const ordered = [...siblings.slice(0, insertion), moving, ...siblings.slice(insertion)]

      const parent = targetParentId ? draft.get(targetParentId) : null
      const baseY = parent ? parent.position.y + 28 : 52

      ordered.forEach((node, index) => {
        const nextNode = draft.get(node.id)
        if (!nextNode) return
        nextNode.position = {
          x: parent ? parent.position.x + 24 : nextNode.position.x,
          y: baseY + index * 72
        }
        draft.set(nextNode.id, nextNode)
      })
    })
  }

  const addComponentNode = (type: string, parentId: string | null = null, insertIndex?: number) => {
    if (!currentPage) return

    const parent = parentId ? pageNodeMap.get(parentId) : null
    const created = createCanvasNode(type, currentPage.id, parent
      ? { x: parent.position.x + 24, y: parent.position.y + 28 }
      : { x: 64 + Math.random() * 80, y: 64 + Math.random() * 80 }
    )

    if (!created) return

    created.parentId = parentId

    commitNodeMap((draft) => {
      draft.set(created.id, created)
    })

    moveNodeTo(created.id, parentId, insertIndex)
    selectNode(created.id)
  }

  const handleDropToTarget = (targetId: string | null, position: DropPosition, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDropHint(null)

    if (!currentPage) return

    const componentType = event.dataTransfer.getData('component-type')

    if (position === 'root') {
      if (componentType) {
        addComponentNode(componentType, null)
        return
      }
      if (draggedNodeId) {
        moveNodeTo(draggedNodeId, null)
        setDraggedNodeId(null)
      }
      return
    }

    if (!targetId) return
    const target = pageNodeMap.get(targetId)
    if (!target) return

    const parentId = target.parentId || null
    const siblings = childrenByParent.get(parentId) || []
    const targetIndex = siblings.indexOf(targetId)

    if (position === 'inside') {
      if (componentType) {
        addComponentNode(componentType, targetId)
        return
      }
      if (!draggedNodeId || draggedNodeId === targetId) return
      if (isDescendant(targetId, draggedNodeId, pageNodeMap)) return
      moveNodeTo(draggedNodeId, targetId)
      setDraggedNodeId(null)
      return
    }

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1

    if (componentType) {
      addComponentNode(componentType, parentId, insertIndex)
      return
    }

    if (!draggedNodeId || draggedNodeId === targetId) return
    if (isDescendant(targetId, draggedNodeId, pageNodeMap)) return

    moveNodeTo(draggedNodeId, parentId, insertIndex)
    setDraggedNodeId(null)
  }

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selectedNode) return
    updateNode(selectedNode.id, {
      position: {
        x: selectedNode.position.x + dx,
        y: selectedNode.position.y + dy
      }
    })
    pushHistory()
    setDirty(true)
  }

  const applySize = (field: 'width' | 'height', value: number) => {
    if (!selectedNode) return
    updateNode(selectedNode.id, {
      size: {
        ...selectedNode.size,
        [field]: Math.max(20, value)
      }
    })
  }

  const moveSelectedAmongSiblings = (direction: -1 | 1) => {
    if (!selectedNode) return
    const parentId = selectedNode.parentId || null
    const siblings = childrenByParent.get(parentId) || []
    const currentIndex = siblings.indexOf(selectedNode.id)
    if (currentIndex === -1) return

    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= siblings.length) return

    moveNodeTo(selectedNode.id, parentId, nextIndex)
  }

  const indentSelected = () => {
    if (!selectedNode) return
    const parentId = selectedNode.parentId || null
    const siblings = childrenByParent.get(parentId) || []
    const currentIndex = siblings.indexOf(selectedNode.id)
    if (currentIndex <= 0) return

    const previousSiblingId = siblings[currentIndex - 1]
    if (!previousSiblingId) return
    moveNodeTo(selectedNode.id, previousSiblingId)
  }

  const outdentSelected = () => {
    if (!selectedNode?.parentId) return
    const parentNode = pageNodeMap.get(selectedNode.parentId)
    if (!parentNode) return

    const grandParentId = parentNode.parentId || null
    const parentSiblings = childrenByParent.get(grandParentId) || []
    const parentIndex = parentSiblings.indexOf(parentNode.id)
    if (parentIndex === -1) {
      moveNodeTo(selectedNode.id, grandParentId)
      return
    }

    moveNodeTo(selectedNode.id, grandParentId, parentIndex + 1)
  }

  const deleteSelected = () => {
    if (!selectedNode) return
    removeNode(selectedNode.id)
    setDirty(true)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedNode) return
      if (isTypingTarget(event.target)) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
        return
      }

      if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelectedAmongSiblings(-1)
        return
      }

      if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelectedAmongSiblings(1)
        return
      }

      if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault()
        indentSelected()
        return
      }

      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault()
        outdentSelected()
        return
      }

      const step = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        nudgeSelected(0, -step)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        nudgeSelected(0, step)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        nudgeSelected(-step, 0)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        nudgeSelected(step, 0)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedNode, moveSelectedAmongSiblings, indentSelected, outdentSelected, nudgeSelected])

  const renderDropLine = (targetId: string, position: DropPosition) => (
    <div
      key={`${targetId}-${position}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('component-type') || draggedNodeId) {
          event.preventDefault()
          event.stopPropagation()
          setDropHint({ id: targetId, position })
        }
      }}
      onDrop={(event) => handleDropToTarget(targetId, position, event)}
      className={dropHint?.id === targetId && dropHint.position === position
        ? 'my-1 flex h-5 items-center rounded border border-primary/40 bg-primary/15 px-2 text-[10px] font-medium uppercase tracking-wide text-primary'
        : 'my-1 h-1.5 rounded bg-transparent hover:bg-primary/20'}
    >
      {dropHint?.id === targetId && dropHint.position === position
        ? (position === 'before' ? 'Drop Before' : 'Drop After')
        : null}
    </div>
  )

  const renderTree = (ids: string[], depth = 0): JSX.Element[] => {
    return ids.flatMap((id) => {
      const node = pageNodeMap.get(id)
      if (!node) return []
      const children = childrenByParent.get(id) || []
      const isSelected = selectedIds.has(id)
      const isDropInside = dropHint?.id === id && dropHint.position === 'inside'

      return [
        renderDropLine(id, 'before'),
        <div
          key={id}
          draggable
          onDragStart={() => setDraggedNodeId(id)}
          onDragEnd={() => {
            setDraggedNodeId(null)
            setDropHint(null)
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('component-type') || draggedNodeId) {
              event.preventDefault()
              event.stopPropagation()
              setDropHint({ id, position: 'inside' })
            }
          }}
          onDrop={(event) => handleDropToTarget(id, 'inside', event)}
          onClick={(event) => {
            event.stopPropagation()
            selectNode(id, event.metaKey || event.ctrlKey)
          }}
          className={isSelected
            ? 'relative rounded border border-primary bg-primary/10 p-2'
            : isDropInside
              ? 'relative rounded border border-primary/60 bg-primary/10 p-2'
              : 'relative rounded border bg-background p-2 hover:border-primary/50'}
          style={{ marginLeft: `${depth * 14}px` }}
        >
          {isDropInside && (
            <div className="pointer-events-none absolute -top-2 right-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground">
              Drop Inside
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{node.name || node.type}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{node.type}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  updateNode(node.id, { visible: !node.visible })
                  pushHistory()
                  setDirty(true)
                }}
                title={node.visible ? 'Hide' : 'Show'}
              >
                {node.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  updateNode(node.id, { locked: !node.locked })
                  pushHistory()
                  setDirty(true)
                }}
                title={node.locked ? 'Unlock' : 'Lock'}
              >
                {node.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>,
        ...renderTree(children, depth + 1),
        renderDropLine(id, 'after')
      ]
    })
  }

  const rootNodes = childrenByParent.get(null) || []

  return (
    <div className="grid h-full min-h-0 grid-cols-[340px_minmax(0,1fr)]">
      <div
        className="flex min-h-0 flex-col border-r bg-card p-3"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('component-type') || draggedNodeId) {
            event.preventDefault()
            setDropHint({ id: 'root', position: 'root' })
          }
        }}
        onDrop={(event) => handleDropToTarget(null, 'root', event)}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layout Structure</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Reparent by dropping on node body. Reorder by dropping on separators.</p>

        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <div className={dropHint?.id === 'root' ? 'rounded border border-dashed border-primary bg-primary/10 px-2 py-1.5 text-[11px] text-primary' : 'rounded border border-dashed bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground'}>
            Drop here to move/add at page root
          </div>
          {rootNodes.length > 0 ? renderTree(rootNodes) : (
            <div className="rounded border bg-muted/20 p-3 text-xs text-muted-foreground">No elements on this page yet.</div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col bg-background p-4">
        <p className="text-sm font-medium">Layout Controls</p>
        {selectedNode ? (
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1">
            <div className="col-span-2 rounded-md border bg-card p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected Element</p>
              <p className="mt-1 text-sm font-medium text-foreground">{selectedNode.name || selectedNode.type}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{selectedNode.id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => moveSelectedAmongSiblings(-1)}>
                  <ChevronUp className="mr-1 h-4 w-4" />Move Up
                </Button>
                <Button size="sm" variant="outline" onClick={() => moveSelectedAmongSiblings(1)}>
                  <ChevronDown className="mr-1 h-4 w-4" />Move Down
                </Button>
                <Button size="sm" variant="outline" onClick={indentSelected}>
                  <MoveRight className="mr-1 h-4 w-4" />Indent
                </Button>
                <Button size="sm" variant="outline" onClick={outdentSelected}>
                  <MoveLeft className="mr-1 h-4 w-4" />Outdent
                </Button>
                <Button size="sm" variant="outline" onClick={() => moveNodeTo(selectedNode.id, null)}>
                  Promote to Root
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deleteSelected}
                >
                  <Trash2 className="mr-1 h-4 w-4" />Delete
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-card p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Position</p>
              <label className="mb-1 block text-[11px] text-muted-foreground">X</label>
              <input
                type="number"
                value={Math.round(selectedNode.position.x)}
                onChange={(event) => updateNode(selectedNode.id, { position: { ...selectedNode.position, x: Number(event.target.value) || 0 } })}
                onBlur={() => { pushHistory(); setDirty(true) }}
                className="mb-2 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              />
              <label className="mb-1 block text-[11px] text-muted-foreground">Y</label>
              <input
                type="number"
                value={Math.round(selectedNode.position.y)}
                onChange={(event) => updateNode(selectedNode.id, { position: { ...selectedNode.position, y: Number(event.target.value) || 0 } })}
                onBlur={() => { pushHistory(); setDirty(true) }}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              />
            </div>

            <div className="rounded-md border bg-card p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Size</p>
              <label className="mb-1 block text-[11px] text-muted-foreground">Width</label>
              <input
                type="number"
                value={Math.round(readDimension(selectedNode.size.width, 100))}
                onChange={(event) => applySize('width', Number(event.target.value) || 20)}
                onBlur={() => { pushHistory(); setDirty(true) }}
                className="mb-2 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              />
              <label className="mb-1 block text-[11px] text-muted-foreground">Height</label>
              <input
                type="number"
                value={Math.round(readDimension(selectedNode.size.height, 40))}
                onChange={(event) => applySize('height', Number(event.target.value) || 20)}
                onBlur={() => { pushHistory(); setDirty(true) }}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              />
            </div>

            <div className="col-span-2 rounded-md border bg-card p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Nudge</p>
              <div className="grid grid-cols-4 gap-2">
                <Button size="sm" variant="outline" onClick={() => nudgeSelected(0, -8)}><MoveUp className="mr-1 h-4 w-4" />Up</Button>
                <Button size="sm" variant="outline" onClick={() => nudgeSelected(0, 8)}><MoveDown className="mr-1 h-4 w-4" />Down</Button>
                <Button size="sm" variant="outline" onClick={() => nudgeSelected(-8, 0)}><MoveLeft className="mr-1 h-4 w-4" />Left</Button>
                <Button size="sm" variant="outline" onClick={() => nudgeSelected(8, 0)}><MoveRight className="mr-1 h-4 w-4" />Right</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed bg-card text-center text-sm text-muted-foreground">
            Select a node from Layout Structure to move, reorder, and resize it.
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">{pageNodes.length} element{pageNodes.length !== 1 ? 's' : ''} on page · arrows nudge · Alt+arrows reorder/indent</p>
          <Button size="sm" variant="outline" onClick={() => deselectAll()}>Clear Selection</Button>
        </div>
      </div>
    </div>
  )
}
