import { ipcMain, dialog, app } from 'electron'
import { basename, dirname, join, relative } from 'path'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { randomUUID } from 'crypto'
import { getMainWindow } from '../index.js'

const AIUIEDIT_DIR = join(homedir(), 'aiuiedit')
const SETTINGS_FILE = join(AIUIEDIT_DIR, 'settings.json')

type SupportedFramework = 'nextjs' | 'react-vite' | 'unknown'

interface SourceMappingItem {
  nodeId: string
  sourcePath: string
  selector: string
  kind: 'element'
}

interface SourceMappingManifest {
  version: 1
  framework: SupportedFramework
  sourceRoot: string
  entryFile: string
  generatedAt: string
  mappings: SourceMappingItem[]
}

interface SourceTextEditPayload {
  projectPath: string
  nodeId: string
  text: string
}

interface SourcePageMetadataPayload {
  projectPath: string
  pageId: string
  title?: string
  description?: string
}

interface SourcePageSyncPayload {
  projectPath: string
  page: {
    id: string
    name: string
    route: string
    title?: string
    description?: string
  }
}

interface ImportedNode {
  id: string
  type: string
  pageId: string
  parentId: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: Record<string, string>
  props: Record<string, unknown>
  children: string[]
  name: string
  locked: boolean
  visible: boolean
}

const TAG_TO_COMPONENT: Record<string, string> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  p: 'text',
  span: 'text',
  button: 'button',
  input: 'input',
  textarea: 'textarea',
  img: 'image',
  a: 'link',
  label: 'label',
  nav: 'navbar',
  section: 'container',
  article: 'card',
  main: 'container',
  div: 'container'
}

function makeNodeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeProjectName(raw: string): string {
  const safe = raw.trim().replace(/[^a-zA-Z0-9._-]/g, '-')
  return safe || `imported-${Date.now()}`
}

function extractTextContent(markup: string): string {
  return markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseAttr(block: string, attr: string): string {
  const match = block.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1] || ''
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function findFirstFileInTree(rootDir: string, preferredSuffixes: string[], maxDepth = 5): Promise<string | null> {
  const ignoredDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache'])
  const normalized = preferredSuffixes.map((suffix) => suffix.replace(/\\/g, '/'))
  const found: string[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return

    let entries: any[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' }) as any[]
    } catch {
      return
    }

    for (const entry of entries) {
      const entryName = String(entry.name)

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entryName)) continue
        await walk(join(dir, entryName), depth + 1)
        continue
      }

      const fullPath = join(dir, entryName)
      const relativePath = relative(rootDir, fullPath).replace(/\\/g, '/')

      if (normalized.some((suffix) => relativePath.endsWith(suffix))) {
        found.push(fullPath)
      }
    }
  }

  await walk(rootDir, 0)

  if (found.length === 0) return null

  found.sort((a, b) => {
    const relA = relative(rootDir, a).replace(/\\/g, '/')
    const relB = relative(rootDir, b).replace(/\\/g, '/')
    const idxA = normalized.findIndex((suffix) => relA.endsWith(suffix))
    const idxB = normalized.findIndex((suffix) => relB.endsWith(suffix))

    if (idxA !== idxB) return idxA - idxB
    if (relA.length !== relB.length) return relA.length - relB.length
    return relA.localeCompare(relB)
  })

  return found[0]
}

async function detectFramework(sourceRoot: string): Promise<{ framework: SupportedFramework; entryFile: string | null }> {
  const findFirstExisting = async (candidates: string[]): Promise<string | null> => {
    for (const candidate of candidates) {
      if (await pathExists(candidate)) return candidate
    }
    return null
  }

  const nextConfig = await findFirstExisting([
    join(sourceRoot, 'next.config.js'),
    join(sourceRoot, 'next.config.mjs'),
    join(sourceRoot, 'next.config.ts')
  ])

  const nextEntry = await findFirstExisting([
    join(sourceRoot, 'app', 'page.tsx'),
    join(sourceRoot, 'app', 'page.jsx'),
    join(sourceRoot, 'app', 'page.js'),
    join(sourceRoot, 'app', 'layout.tsx'),
    join(sourceRoot, 'app', 'layout.jsx'),
    join(sourceRoot, 'app', 'layout.js'),
    join(sourceRoot, 'src', 'app', 'page.tsx'),
    join(sourceRoot, 'src', 'app', 'page.jsx'),
    join(sourceRoot, 'src', 'app', 'page.js'),
    join(sourceRoot, 'src', 'app', 'layout.tsx'),
    join(sourceRoot, 'src', 'app', 'layout.jsx'),
    join(sourceRoot, 'src', 'app', 'layout.js'),
    join(sourceRoot, 'pages', 'index.tsx'),
    join(sourceRoot, 'pages', 'index.jsx'),
    join(sourceRoot, 'pages', 'index.js'),
    join(sourceRoot, 'src', 'pages', 'index.tsx'),
    join(sourceRoot, 'src', 'pages', 'index.jsx'),
    join(sourceRoot, 'src', 'pages', 'index.js')
  ])

  if (nextConfig || nextEntry) {
    if (nextEntry) {
      return { framework: 'nextjs', entryFile: nextEntry }
    }

    const discoveredNextEntry = await findFirstFileInTree(sourceRoot, [
      'app/page.tsx',
      'app/page.jsx',
      'app/page.js',
      'app/layout.tsx',
      'app/layout.jsx',
      'app/layout.js',
      'src/app/page.tsx',
      'src/app/page.jsx',
      'src/app/page.js',
      'src/app/layout.tsx',
      'src/app/layout.jsx',
      'src/app/layout.js',
      'pages/index.tsx',
      'pages/index.jsx',
      'pages/index.js',
      'src/pages/index.tsx',
      'src/pages/index.jsx',
      'src/pages/index.js'
    ])

    return { framework: 'nextjs', entryFile: discoveredNextEntry }
  }

  const viteConfig = await findFirstExisting([
    join(sourceRoot, 'vite.config.ts'),
    join(sourceRoot, 'vite.config.js'),
    join(sourceRoot, 'vite.config.mjs')
  ])
  const viteEntry = await findFirstExisting([
    join(sourceRoot, 'src', 'App.tsx'),
    join(sourceRoot, 'src', 'App.jsx'),
    join(sourceRoot, 'src', 'App.js'),
    join(sourceRoot, 'src', 'main.tsx'),
    join(sourceRoot, 'src', 'main.jsx'),
    join(sourceRoot, 'src', 'main.js')
  ])

  if (viteConfig || viteEntry) {
    if (viteEntry) {
      return { framework: 'react-vite', entryFile: viteEntry }
    }

    const discoveredViteEntry = await findFirstFileInTree(sourceRoot, [
      'src/App.tsx',
      'src/App.jsx',
      'src/App.js',
      'src/main.tsx',
      'src/main.jsx',
      'src/main.js'
    ])

    return { framework: 'react-vite', entryFile: discoveredViteEntry }
  }

  const staticEntry = await findFirstExisting([
    join(sourceRoot, 'index.html'),
    join(sourceRoot, 'public', 'index.html')
  ])

  if (staticEntry) {
    return { framework: 'unknown', entryFile: staticEntry }
  }

  const discoveredGenericEntry = await findFirstFileInTree(sourceRoot, [
    'index.html',
    'public/index.html',
    'src/App.tsx',
    'src/App.jsx',
    'src/App.js',
    'src/main.tsx',
    'src/main.jsx',
    'src/main.js',
    'app/page.tsx',
    'app/page.jsx',
    'app/page.js',
    'src/app/page.tsx',
    'src/app/page.jsx',
    'src/app/page.js'
  ])

  return { framework: 'unknown', entryFile: discoveredGenericEntry }
}

function buildImportedNodes(sourceCode: string, sourcePath: string, sourceRoot: string): { nodes: ImportedNode[]; mappings: SourceMappingItem[] } {
  const elementRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\/>/g
  const nodes: ImportedNode[] = []
  const mappings: SourceMappingItem[] = []
  let match: RegExpExecArray | null
  let index = 0
  const perTagCount = new Map<string, number>()

  while ((match = elementRegex.exec(sourceCode)) !== null) {
    const tag = (match[1] || match[4] || '').toLowerCase()
    const attrsBlock = match[2] || match[5] || ''
    const innerHtml = match[3] || ''
    const componentType = TAG_TO_COMPONENT[tag]
    if (!componentType) continue

    const nodeId = makeNodeId('node')
    const text = extractTextContent(innerHtml)
    const y = 40 + index * 84

    const node: ImportedNode = {
      id: nodeId,
      type: componentType,
      pageId: 'page-1',
      parentId: null,
      position: { x: 48, y },
      size: {
        width: componentType === 'container' ? 420 : componentType === 'heading' ? 420 : 320,
        height: componentType === 'textarea' ? 120 : componentType === 'heading' ? 56 : 44
      },
      style: {
        boxSizing: 'border-box'
      },
      props: {},
      children: [],
      name: componentType[0].toUpperCase() + componentType.slice(1),
      locked: false,
      visible: true
    }

    if (componentType === 'heading') {
      node.props.text = text || 'Heading'
      node.props.level = Number(tag.replace('h', '')) || 2
    } else if (componentType === 'text') {
      node.props.content = text || 'Text'
    } else if (componentType === 'button') {
      node.props.text = text || 'Button'
    } else if (componentType === 'input') {
      node.props.placeholder = parseAttr(attrsBlock, 'placeholder') || 'Enter text...'
      node.props.type = parseAttr(attrsBlock, 'type') || 'text'
    } else if (componentType === 'textarea') {
      node.props.placeholder = parseAttr(attrsBlock, 'placeholder') || 'Enter text...'
      node.props.rows = Number(parseAttr(attrsBlock, 'rows') || '4')
    } else if (componentType === 'image') {
      node.props.src = parseAttr(attrsBlock, 'src')
      node.props.alt = parseAttr(attrsBlock, 'alt') || 'Image'
      node.size = { width: 360, height: 220 }
    } else if (componentType === 'link') {
      node.props.text = text || 'Link'
      node.props.href = parseAttr(attrsBlock, 'href') || '#'
    } else if (componentType === 'label') {
      node.props.text = text || 'Label'
    } else if (componentType === 'navbar') {
      node.props.brand = text || 'Navigation'
      node.props.links = 'Home,About,Contact'
      node.size = { width: 800, height: 56 }
    } else if (componentType === 'card') {
      node.props.title = text || 'Card'
      node.size = { width: 420, height: 160 }
    }

    nodes.push(node)
    const currentTagCount = (perTagCount.get(tag) || 0) + 1
    perTagCount.set(tag, currentTagCount)

    mappings.push({
      nodeId,
      sourcePath: relative(sourceRoot, sourcePath),
      selector: `${tag}:nth-of-type(${currentTagCount})`,
      kind: 'element'
    })
    index += 1

    if (nodes.length >= 100) break
  }

  return { nodes, mappings }
}

async function readSourceMapManifest(projectPath: string): Promise<SourceMappingManifest> {
  const manifestPath = join(projectPath, '.aiuiedit', 'source-map.json')
  const raw = await fs.readFile(manifestPath, 'utf-8')
  return JSON.parse(raw)
}

function parseSelector(selector: string): { tag: string; nth: number } | null {
  const match = selector.match(/^([a-zA-Z][a-zA-Z0-9]*):nth-of-type\((\d+)\)$/)
  if (!match) return null

  return {
    tag: match[1].toLowerCase(),
    nth: Number(match[2])
  }
}

function applyTextPatchBySelector(sourceCode: string, selector: { tag: string; nth: number }, newText: string): { updated: string; applied: boolean } {
  const elementRegex = new RegExp(`<(${selector.tag})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'g')
  let match: RegExpExecArray | null
  let seen = 0

  while ((match = elementRegex.exec(sourceCode)) !== null) {
    seen += 1
    if (seen !== selector.nth) continue

    const full = match[0]
    const openingTag = `<${match[1]}${match[2]}>`
    const inner = match[3]
    const closingTag = `</${match[1]}>`

    if (inner.includes('<') || inner.includes('{')) {
      throw new Error('Source element has nested JSX/expression content; text sync not safe for this node yet')
    }

    if (newText.includes('<') || newText.includes('{')) {
      throw new Error('Text contains unsupported characters for direct JSX text replacement')
    }

    const replacement = `${openingTag}${newText}${closingTag}`
    const updated = sourceCode.slice(0, match.index) + replacement + sourceCode.slice(match.index + full.length)

    return { updated, applied: true }
  }

  return { updated: sourceCode, applied: false }
}

function escapeStringLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function upsertMetadataField(content: string, key: 'title' | 'description', value: string): string {
  const fieldRegex = new RegExp(`(${key}\\s*:\\s*)(["'\"]).*?\\2`, 's')
  if (fieldRegex.test(content)) {
    return content.replace(fieldRegex, `$1"${escapeStringLiteral(value)}"`)
  }

  const trimmed = content.trimEnd()
  const needsComma = trimmed.length > 0 && !trimmed.endsWith(',')
  const suffix = trimmed.length > 0 ? `\n  ${key}: "${escapeStringLiteral(value)}"` : `  ${key}: "${escapeStringLiteral(value)}"`
  return `${trimmed}${needsComma ? ',' : ''}${suffix}\n`
}

function applyPageMetadataPatch(sourceCode: string, title?: string, description?: string): string {
  if (!title && !description) return sourceCode

  const metadataRegex = /export\s+const\s+metadata\s*=\s*\{([\s\S]*?)\}\s*(?:as const\s*)?/m
  if (metadataRegex.test(sourceCode)) {
    return sourceCode.replace(metadataRegex, (_full, body: string) => {
      let nextBody = body
      if (title !== undefined) {
        nextBody = upsertMetadataField(nextBody, 'title', title)
      }
      if (description !== undefined) {
        nextBody = upsertMetadataField(nextBody, 'description', description)
      }
      return `export const metadata = {\n${nextBody}}\n`
    })
  }

  const metadataLines = [
    'export const metadata = {'
  ]
  if (title !== undefined) metadataLines.push(`  title: "${escapeStringLiteral(title)}",`)
  if (description !== undefined) metadataLines.push(`  description: "${escapeStringLiteral(description)}",`)
  metadataLines.push('}\n')

  const block = `${metadataLines.join('\n')}\n`

  const importBlockRegex = /^(?:import[^\n]*\n)+/m
  const importMatch = sourceCode.match(importBlockRegex)
  if (importMatch) {
    const insertAt = importMatch[0].length
    return `${sourceCode.slice(0, insertAt)}\n${block}${sourceCode.slice(insertAt)}`
  }

  return `${block}${sourceCode}`
}

function normalizeRoute(route: string): string {
  const cleaned = route.trim().replace(/\s+/g, '-').replace(/\/+/g, '/').replace(/[^a-zA-Z0-9/_-]/g, '')
  if (!cleaned || cleaned === '/') return '/'
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`
}

function getNextAppBaseDir(entryFile: string): string {
  if (entryFile.endsWith('src/app/page.tsx')) return 'src/app'
  if (entryFile.endsWith('app/page.tsx')) return 'app'
  return dirname(entryFile)
}

function routeToNextPageFile(baseDir: string, route: string): string {
  const normalized = normalizeRoute(route)
  if (normalized === '/') return `${baseDir}/page.tsx`
  const slug = normalized.replace(/^\//, '')
  return `${baseDir}/${slug}/page.tsx`
}

function buildNewNextPageSource(pageName: string, title?: string, description?: string): string {
  const safeTitle = title?.trim() || pageName
  const safeDescription = description?.trim() || ''

  return `export const metadata = {
  title: "${escapeStringLiteral(safeTitle)}",
  description: "${escapeStringLiteral(safeDescription)}",
}

export default function ${pageName.replace(/[^a-zA-Z0-9]/g, '') || 'Page'}Page() {
  return (
    <main>
      <h1>${safeTitle}</h1>
    </main>
  )
}
`
}

async function getWorkspaceRoot(): Promise<string> {
  await ensureaiuieditDir()

  try {
    const settingsRaw = await fs.readFile(SETTINGS_FILE, 'utf-8')
    const settings = JSON.parse(settingsRaw)
    if (settings?.workspacePath && typeof settings.workspacePath === 'string') {
      return settings.workspacePath
    }
  } catch {
    // Fall back to the app directory when settings do not exist yet.
  }

  return AIUIEDIT_DIR
}

// Ensure aiuiedit directory exists
async function ensureaiuieditDir() {
  try {
    await fs.access(AIUIEDIT_DIR)
  } catch {
    await fs.mkdir(AIUIEDIT_DIR, { recursive: true })
    await fs.mkdir(join(AIUIEDIT_DIR, 'projects'), { recursive: true })
    await fs.mkdir(join(AIUIEDIT_DIR, 'assets'), { recursive: true })
    await fs.mkdir(join(AIUIEDIT_DIR, 'cache'), { recursive: true })
  }
}

// IPC Handlers
export function setupIPC() {
  // Get app version
  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })

  // Select sandbox directory
  ipcMain.handle('dialog:select-directory', async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      console.error('No main window available')
      return null
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select aiuiedit Workspace Directory',
      buttonLabel: 'Select Folder'
    })
    
    if (result.canceled) {
      return null
    }
    
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:save-file', async (_event, options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      console.error('No main window available')
      return null
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: options?.title || 'Save File',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })

    if (result.canceled) {
      return null
    }

    return result.filePath || null
  })

  ipcMain.handle('file:write-text', async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  })

  // Save settings
  ipcMain.handle('settings:save', async (_event, settings) => {
    await ensureaiuieditDir()
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    return true
  })

  // Load settings
  ipcMain.handle('settings:load', async () => {
    await ensureaiuieditDir()
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
      const settings = JSON.parse(data)
      // If workspacePath is the default app directory, treat it as unset
      if (settings.workspacePath === AIUIEDIT_DIR) {
        settings.workspacePath = ''
      }
      return settings
    } catch {
      // Return default settings with NO workspace (force user to select)
      return {
        workspacePath: '',
        theme: 'system',
        aiModel: 'kimi-latest',
        recentProjects: [],
        shortcuts: {}
      }
    }
  })

  // List projects
  ipcMain.handle('projects:list', async () => {
    const workspaceRoot = await getWorkspaceRoot()
    const projectsDir = join(workspaceRoot, 'projects')
    await fs.mkdir(projectsDir, { recursive: true })

    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true })
      const projects = []
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.endsWith('.canvas')) {
          const projectPath = join(projectsDir, entry.name)
          try {
            const projectFile = join(projectPath, 'project.json')
            const data = await fs.readFile(projectFile, 'utf-8')
            const project = JSON.parse(data)
            projects.push({
              ...project,
              path: projectPath
            })
          } catch {
            // Skip invalid projects
          }
        }
      }
      
      return projects
    } catch {
      return []
    }
  })

  // Create new project
  ipcMain.handle('projects:create', async (_event, name: string) => {
    const workspaceRoot = await getWorkspaceRoot()
    const projectsDir = join(workspaceRoot, 'projects')
    await fs.mkdir(projectsDir, { recursive: true })

    const projectDir = join(projectsDir, `${name}.canvas`)
    
    try {
      await fs.access(projectDir)
      throw new Error('Project already exists')
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    await fs.mkdir(projectDir, { recursive: true })
    await fs.mkdir(join(projectDir, 'assets'), { recursive: true })
    await fs.mkdir(join(projectDir, 'exports'), { recursive: true })

    const project = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: [
        {
          id: 'page-1',
          name: 'Home',
          route: '/',
          title: 'Home',
          description: '',
          template: 'default',
          noIndex: false,
          authRequired: false
        }
      ],
      designSystem: {
        colors: {
          primary: { name: 'Primary', value: '#3B82F6' },
          secondary: { name: 'Secondary', value: '#10B981' },
          accent: { name: 'Accent', value: '#F59E0B' },
          background: { name: 'Background', value: '#FFFFFF' },
          text: { name: 'Text', value: '#1F2937' }
        },
        typography: {
          fontFamily: 'Inter',
          baseSize: 16
        }
      }
    }

    await fs.writeFile(
      join(projectDir, 'project.json'),
      JSON.stringify(project, null, 2)
    )

    // Create initial canvas state
    await fs.writeFile(
      join(projectDir, 'canvas-state.json'),
      JSON.stringify({
        nodes: [],
        selectedIds: [],
        zoom: 1,
        viewport: { x: 0, y: 0 }
      }, null, 2)
    )

    return project
  })

  // Import existing source project (round-trip bootstrap)
  ipcMain.handle('projects:import-source', async (_event, sourceRoot: string) => {
    const workspaceRoot = await getWorkspaceRoot()
    const projectsDir = join(workspaceRoot, 'projects')
    await fs.mkdir(projectsDir, { recursive: true })

    const detected = await detectFramework(sourceRoot)
    if (!detected.entryFile) {
      throw new Error('Could not detect an entry file. Select the app folder (for monorepos, choose the frontend package directory).')
    }

    const sourceCode = await fs.readFile(detected.entryFile, 'utf-8')
    const { nodes, mappings } = buildImportedNodes(sourceCode, detected.entryFile, sourceRoot)

    const sourceName = sanitizeProjectName(basename(sourceRoot))
    const projectName = `${sourceName}-import`
    const projectDir = join(projectsDir, `${projectName}.canvas`)

    try {
      await fs.access(projectDir)
      throw new Error('Imported project already exists')
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    await fs.mkdir(projectDir, { recursive: true })
    await fs.mkdir(join(projectDir, 'assets'), { recursive: true })
    await fs.mkdir(join(projectDir, 'exports'), { recursive: true })
    await fs.mkdir(join(projectDir, '.aiuiedit'), { recursive: true })

    const project = {
      id: randomUUID(),
      name: projectName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: [
        {
          id: 'page-1',
          name: 'Imported Page',
          route: '/',
          title: 'Imported Page',
          description: '',
          template: 'default',
          noIndex: false,
          authRequired: false
        }
      ],
      designSystem: {
        colors: {
          primary: { name: 'Primary', value: '#3B82F6' },
          secondary: { name: 'Secondary', value: '#10B981' },
          accent: { name: 'Accent', value: '#F59E0B' },
          background: { name: 'Background', value: '#FFFFFF' },
          text: { name: 'Text', value: '#1F2937' }
        },
        typography: {
          fontFamily: 'Inter',
          baseSize: 16
        }
      },
      source: {
        root: sourceRoot,
        framework: detected.framework,
        entryFile: relative(sourceRoot, detected.entryFile),
        roundTrip: true,
        pages: {
          'page-1': {
            file: relative(sourceRoot, detected.entryFile),
            route: '/'
          }
        }
      }
    }

    const manifest: SourceMappingManifest = {
      version: 1,
      framework: detected.framework,
      sourceRoot,
      entryFile: relative(sourceRoot, detected.entryFile),
      generatedAt: new Date().toISOString(),
      mappings
    }

    await Promise.all([
      fs.writeFile(join(projectDir, 'project.json'), JSON.stringify(project, null, 2)),
      fs.writeFile(join(projectDir, 'canvas-state.json'), JSON.stringify({
        nodes,
        selectedIds: [],
        zoom: 1,
        viewport: { x: 0, y: 0 }
      }, null, 2)),
      fs.writeFile(join(projectDir, '.aiuiedit', 'source-map.json'), JSON.stringify(manifest, null, 2))
    ])

    return {
      path: projectDir,
      project,
      canvas: {
        nodes,
        selectedIds: [],
        zoom: 1,
        viewport: { x: 0, y: 0 }
      }
    }
  })

  // Load project
  ipcMain.handle('projects:load', async (_event, projectPath: string) => {
    const projectFile = join(projectPath, 'project.json')
    const canvasFile = join(projectPath, 'canvas-state.json')
    
    const [projectData, canvasData] = await Promise.all([
      fs.readFile(projectFile, 'utf-8'),
      fs.readFile(canvasFile, 'utf-8')
    ])

    return {
      project: JSON.parse(projectData),
      canvas: JSON.parse(canvasData)
    }
  })

  // Save project
  ipcMain.handle('projects:save', async (_event, projectPath: string, data: any) => {
    const projectFile = join(projectPath, 'project.json')
    const canvasFile = join(projectPath, 'canvas-state.json')

    await Promise.all([
      fs.writeFile(projectFile, JSON.stringify(data.project, null, 2)),
      fs.writeFile(canvasFile, JSON.stringify(data.canvas, null, 2))
    ])

    return true
  })

  // Apply atomic text patch to source repository
  ipcMain.handle('source:apply-text-edit', async (_event, payload: SourceTextEditPayload) => {
    const { projectPath, nodeId, text } = payload
    const manifest = await readSourceMapManifest(projectPath)
    const mapping = manifest.mappings.find((item) => item.nodeId === nodeId)

    if (!mapping) {
      throw new Error('No source mapping found for selected node')
    }

    const selector = parseSelector(mapping.selector)
    if (!selector) {
      throw new Error('Unsupported selector format in source map')
    }

    const sourceFile = join(manifest.sourceRoot, mapping.sourcePath)
    const sourceCode = await fs.readFile(sourceFile, 'utf-8')
    const patched = applyTextPatchBySelector(sourceCode, selector, text)

    if (!patched.applied) {
      throw new Error('Could not locate mapped element in source file')
    }

    await fs.writeFile(sourceFile, patched.updated, 'utf-8')
    return {
      success: true,
      sourceFile
    }
  })

  ipcMain.handle('source:apply-page-metadata-edit', async (_event, payload: SourcePageMetadataPayload) => {
    const { projectPath, pageId, title, description } = payload
    if (pageId !== 'page-1') {
      throw new Error('Page metadata sync currently supports the primary imported page only')
    }

    const projectFile = join(projectPath, 'project.json')
    const projectRaw = await fs.readFile(projectFile, 'utf-8')
    const project = JSON.parse(projectRaw)

    if (!project?.source?.roundTrip || !project?.source?.root || !project?.source?.entryFile) {
      throw new Error('Project is not source-linked')
    }

    const sourceFile = join(project.source.root, project.source.entryFile)
    const sourceCode = await fs.readFile(sourceFile, 'utf-8')
    const updated = applyPageMetadataPatch(sourceCode, title, description)
    await fs.writeFile(sourceFile, updated, 'utf-8')

    return {
      success: true,
      sourceFile
    }
  })

  ipcMain.handle('source:sync-page', async (_event, payload: SourcePageSyncPayload) => {
    const { projectPath, page } = payload

    const projectFile = join(projectPath, 'project.json')
    const projectRaw = await fs.readFile(projectFile, 'utf-8')
    const project = JSON.parse(projectRaw)

    if (!project?.source?.roundTrip || !project?.source?.root || !project?.source?.entryFile) {
      throw new Error('Project is not source-linked')
    }

    const framework: SupportedFramework = project.source.framework || 'unknown'
    if (framework !== 'nextjs') {
      throw new Error('Route/page sync currently supports Next.js source projects only')
    }

    const sourceRoot = project.source.root as string
    const sourcePages = { ...(project.source.pages || {}) } as Record<string, { file: string; route: string }>
    const baseDir = getNextAppBaseDir(project.source.entryFile as string)
    const normalizedRoute = normalizeRoute(page.route)

    const existing = sourcePages[page.id]
    const previousRel = existing?.file
    const desiredRel = page.id === 'page-1'
      ? (project.source.entryFile as string)
      : routeToNextPageFile(baseDir, normalizedRoute)

    const desiredAbs = join(sourceRoot, desiredRel)

    if (!previousRel) {
      await fs.mkdir(dirname(desiredAbs), { recursive: true })
      const initial = buildNewNextPageSource(page.name, page.title, page.description)
      await fs.writeFile(desiredAbs, initial, 'utf-8')
    } else {
      const previousAbs = join(sourceRoot, previousRel)
      if (previousRel !== desiredRel && page.id !== 'page-1') {
        await fs.mkdir(dirname(desiredAbs), { recursive: true })
        await fs.rename(previousAbs, desiredAbs)
      }
    }

    const sourceCode = await fs.readFile(desiredAbs, 'utf-8')
    const withMetadata = applyPageMetadataPatch(sourceCode, page.title || page.name, page.description || '')
    await fs.writeFile(desiredAbs, withMetadata, 'utf-8')

    sourcePages[page.id] = {
      file: desiredRel,
      route: normalizedRoute
    }

    const updatedProject = {
      ...project,
      source: {
        ...project.source,
        pages: sourcePages
      },
      updatedAt: new Date().toISOString()
    }

    await fs.writeFile(projectFile, JSON.stringify(updatedProject, null, 2))

    return {
      success: true,
      sourceFile: desiredAbs,
      route: normalizedRoute
    }
  })

  // Refresh imported canvas from source entry file
  ipcMain.handle('projects:refresh-from-source', async (_event, projectPath: string) => {
    const projectFile = join(projectPath, 'project.json')
    const projectRaw = await fs.readFile(projectFile, 'utf-8')
    const project = JSON.parse(projectRaw)

    if (!project?.source?.roundTrip || !project?.source?.root || !project?.source?.entryFile) {
      throw new Error('Project is not source-linked for round-trip refresh')
    }

    const sourceRoot = project.source.root as string
    const entryFile = join(sourceRoot, project.source.entryFile as string)
    const sourceCode = await fs.readFile(entryFile, 'utf-8')
    const built = buildImportedNodes(sourceCode, entryFile, sourceRoot)

    const manifest: SourceMappingManifest = {
      version: 1,
      framework: project.source.framework as SupportedFramework,
      sourceRoot,
      entryFile: project.source.entryFile,
      generatedAt: new Date().toISOString(),
      mappings: built.mappings
    }

    const canvas = {
      nodes: built.nodes,
      selectedIds: [],
      zoom: 1,
      viewport: { x: 0, y: 0 }
    }

    await Promise.all([
      fs.writeFile(join(projectPath, 'canvas-state.json'), JSON.stringify(canvas, null, 2)),
      fs.writeFile(join(projectPath, '.aiuiedit', 'source-map.json'), JSON.stringify(manifest, null, 2)),
      fs.writeFile(projectFile, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2))
    ])

    return {
      project: { ...project, updatedAt: new Date().toISOString() },
      canvas
    }
  })

  console.log('IPC handlers registered')
}
