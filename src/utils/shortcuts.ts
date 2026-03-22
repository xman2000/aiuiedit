import { useEffect } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'

// Keyboard shortcuts handler
export function useKeyboardShortcuts() {
  const { setDirty, saveProject, currentProject } = useProjectStore()
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
    paste,
    alignSelected,
    distributeSelected,
    groupSelected,
    ungroupSelected,
    toggleLockSelected,
    toggleVisibilitySelected
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
          setDirty(true)
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

      // Save
      if (metaKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (currentProject) {
          saveProject()
            .then(() => window.showToast?.('Project saved!', 'success'))
            .catch(() => window.showToast?.('Failed to save', 'error'))
        }
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
        setDirty(true)
      }

      // Duplicate
      if (metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        copySelected()
        paste()
        setDirty(true)
      }

      // Group / Ungroup
      if (metaKey && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault()
        if (selectedIds.size >= 2) {
          groupSelected()
          setDirty(true)
        }
      }

      if (metaKey && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (selectedIds.size > 0) {
          ungroupSelected()
          setDirty(true)
        }
      }

      // Lock / visibility toggles
      if (selectedIds.size > 0 && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        toggleLockSelected()
        setDirty(true)
      }

      if (selectedIds.size > 0 && e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        toggleVisibilitySelected()
        setDirty(true)
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
        setDirty(true)
      }

      // Alignment shortcuts: Alt + Shift + Arrow
      if (selectedIds.size > 0 && e.altKey && e.shiftKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          alignSelected('left')
          setDirty(true)
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          alignSelected('right')
          setDirty(true)
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          alignSelected('top')
          setDirty(true)
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          alignSelected('bottom')
          setDirty(true)
        }
      }

      // Distribution shortcuts
      if (selectedIds.size >= 3 && e.altKey && metaKey) {
        if (e.key.toLowerCase() === 'h') {
          e.preventDefault()
          distributeSelected('horizontal')
          setDirty(true)
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault()
          distributeSelected('vertical')
          setDirty(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, nodes, deleteNode, undo, redo, canUndo, canRedo, selectAll, deselectAll, copySelected, paste, alignSelected, distributeSelected, groupSelected, ungroupSelected, toggleLockSelected, toggleVisibilitySelected, setDirty, saveProject, currentProject])
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
  'Cmd/Ctrl + S': 'Save project',
  'Cmd/Ctrl + G': 'Group selected',
  'Cmd/Ctrl + Shift + G': 'Ungroup selected',
  'Arrow Keys': 'Nudge 1px',
  'Shift + Arrow': 'Nudge 10px',
  'Shift + Alt + Arrows': 'Align selected',
  'Cmd/Ctrl + Alt + H': 'Distribute horizontal',
  'Cmd/Ctrl + Alt + V': 'Distribute vertical',
  'Alt + L': 'Toggle lock selected',
  'Alt + H': 'Toggle hide/show selected'
}
