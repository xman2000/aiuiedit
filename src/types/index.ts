// Project types
export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  pages: Page[]
  designSystem: DesignSystem
  source?: {
    root: string
    framework: 'nextjs' | 'react-vite' | 'unknown'
    entryFile: string
    roundTrip: boolean
    pages?: Record<string, { file: string; route: string }>
  }
}

export interface Page {
  id: string
  name: string
  route: string
  title?: string
  description?: string
  template?: 'default' | 'landing' | 'docs' | 'dashboard'
  noIndex?: boolean
  authRequired?: boolean
}

export interface DesignSystem {
  colors: {
    primary: ColorToken
    secondary: ColorToken
    accent: ColorToken
    background: ColorToken
    text: ColorToken
    [key: string]: ColorToken
  }
  typography: {
    fontFamily: string
    baseSize: number
  }
}

export interface ColorToken {
  name: string
  value: string
}

// Canvas types
export interface CanvasNode {
  id: string
  type: string
  pageId: string
  parentId: string | null
  position: { x: number; y: number }
  size: { width: number | string; height: number | string }
  style: React.CSSProperties
  props: Record<string, any>
  children: string[]
  name: string
  locked: boolean
  visible: boolean
}

export interface CanvasState {
  nodes: Map<string, CanvasNode>
  rootId: string
  selectedIds: Set<string>
  zoom: number
  viewport: { x: number; y: number }
}

// Component types
export interface ComponentDefinition {
  type: string
  name: string
  icon: string
  category: 'primitive' | 'layout' | 'form' | 'navigation' | 'feedback' | 'data-display'
  defaultProps: Record<string, any>
  defaultStyle: React.CSSProperties
  properties: PropertySchema[]
}

export interface PropertySchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'array'
  label: string
  default?: any
  options?: string[]
  min?: number
  max?: number
}

// Settings types
export interface AppSettings {
  workspacePath: string
  theme: 'light' | 'dark' | 'system'
  aiModel: string
  recentProjects: string[]
  shortcuts: Record<string, string>
  openRouterApiKey?: string
}

// AI types
export interface AIContext {
  selectedComponents: CanvasNode[]
  canvasTree: any
  recentActions: any[]
  designSystem: DesignSystem
}

export type AIAction = 
  | { type: 'ADD_COMPONENT'; componentType: string; parentId: string | null; position: { x: number; y: number } }
  | { type: 'DELETE_COMPONENT'; nodeId: string }
  | { type: 'MOVE_COMPONENT'; nodeId: string; newPosition: { x: number; y: number } }
  | { type: 'RESIZE_COMPONENT'; nodeId: string; newSize: { width: number; height: number } }
  | { type: 'MODIFY_PROP'; nodeId: string; prop: string; value: any }
  | { type: 'MODIFY_STYLE'; nodeId: string; style: Partial<React.CSSProperties> }
  | { type: 'APPLY_DESIGN_TOKEN'; nodeId: string; token: string }
