import { BUILT_IN_COMPONENTS, getDefaultNodeSize } from '@/core/ComponentRegistry'
import type { CanvasNode } from '@/types'

function createNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createCanvasNode(type: string, pageId: string, position?: { x: number; y: number }): CanvasNode | null {
  const component = BUILT_IN_COMPONENTS.find((item) => item.type === type)
  if (!component) return null

  const size = getDefaultNodeSize(type)
  const fallbackPosition = {
    x: 100 + Math.random() * 50,
    y: 100 + Math.random() * 50
  }

  return {
    id: createNodeId(),
    type,
    pageId,
    parentId: null,
    position: position || fallbackPosition,
    size,
    style: { ...component.defaultStyle },
    props: { ...component.defaultProps },
    children: [],
    name: component.name,
    locked: false,
    visible: true
  }
}
