import { useEffect } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'

// Keyboard shortcuts handler
export function useKeyboardShortcuts() {
  const {
    selectedIds,
    nodes,
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    selectAll,
    deselectAll,
    copySelected,
    paste
  } = useCanvasStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const metaKey = e.metaKey || e.ctrlKey

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          selectedIds.forEach(id => deleteNode(id))
          e.preventDefault()
        }
      }

      // Select All
      if (metaKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAll()
      }

      // Deselect (Escape)
      if (e.key === 'Escape') {
        deselectAll()
      }

      // Undo
      if (metaKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) undo()
      }

      // Redo
      if ((metaKey && e.key.toLowerCase() === 'y') || (metaKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault()
        if (canRedo) redo()
      }

      // Copy
      if (metaKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        copySelected()
      }

      // Paste
      if (metaKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        paste()
      }

      // Duplicate
      if (metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        copySelected()
        paste()
      }

      // Arrow keys for nudging
      if (selectedIds.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const delta = e.shiftKey ? 10 : 1
        
        selectedIds.forEach(id => {
          const node = nodes.get(id)
          if (node) {
            let newX = node.position.x
            let newY = node.position.y

            switch (e.key) {
              case 'ArrowUp':
                newY -= delta
                break
              case 'ArrowDown':
                newY += delta
                break
              case 'ArrowLeft':
                newX -= delta
                break
              case 'ArrowRight':
                newX += delta
                break
            }

            useCanvasStore.getState().updateNode(id, {
              position: { x: newX, y: newY }
            })
          }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, nodes, deleteNode, undo, redo, canUndo, canRedo, selectAll, deselectAll, copySelected, paste])
}

// Export keyboard shortcuts map for reference
export const KEYBOARD_SHORTCUTS = {
  'Delete': 'Delete selected',
  'Cmd/Ctrl + A': 'Select all',
  'Escape': 'Deselect',
  'Cmd/Ctrl + Z': 'Undo',
  'Cmd/Ctrl + Shift + Z': 'Redo',
  'Cmd/Ctrl + C': 'Copy',
  'Cmd/Ctrl + V': 'Paste',
  'Cmd/Ctrl + D': 'Duplicate',
  'Arrow Keys': 'Nudge 1px',
  'Shift + Arrow': 'Nudge 10px'
}
