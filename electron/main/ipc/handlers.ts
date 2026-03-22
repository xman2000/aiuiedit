import { ipcMain, dialog, app, shell } from 'electron'
import { basename, dirname, join, relative } from 'path'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { randomUUID } from 'crypto'
import { getMainWindow } from '../index.js'

const AIUIEDIT_DIR = join(homedir(), 'aiuiedit')
const SETTINGS_FILE = join(AIUIEDIT_DIR, 'settings.json')

type SupportedFramework = 'nextjs' | 'react-vite' | 'laravel' | 'mixed' | 'unknown'

interface SourceMappingItem {
  nodeId: string
  pageId: string
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

interface DiscoveredPage {
  route: string
  name: string
  file: string
  framework: SupportedFramework
}

interface ImportCandidate {
  root: string
  framework: SupportedFramework
  entryFile: string
  pageCount: number
  samplePages: Array<{ route: string; name: string; file: string }>
}

interface ImportAnalysisResult {
  selectedRoot: string
  candidates: ImportCandidate[]
  recommendedCandidateIndex: number | null
  logs: string[]
  manualEntryHints: string[]
  diagnostics: {
    rootSignals: Record<string, boolean>
    candidateRoots: string[]
  }
  reportPath?: string
}

interface ImportDebugReport {
  generatedAt: string
  selectedRoot: string
  sourceRoot: string
  framework: SupportedFramework
  mode: 'auto' | 'plan' | 'manual'
  entryFile: string
  pageCount: number
  mappingCount: number
  pages: Array<{
    id: string
    name: string
    route: string
    framework: SupportedFramework
    sourceFile: string
  }>
  analysis?: ImportAnalysisResult
}

interface PreviewCapturePayload {
  url: string
}

interface PreviewCaptureResult {
  url: string
  title: string
  html: string
  blocks: Array<{
    type: 'heading' | 'text' | 'button' | 'link'
    text: string
  }>
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

function sanitizeBladeText(markup: string): string {
  return markup
    .replace(/<\?php[\s\S]*?\?>/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/\{!![\s\S]*?!!\}/g, ' ')
    .replace(/@[a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectFallbackTextChunks(sourceCode: string): string[] {
  const lines = sourceCode
    .split(/\r?\n/)
    .map((line) => sanitizeBladeText(line))
    .filter((line) => line.length >= 14)

  const unique = Array.from(new Set(lines))
  return unique.slice(0, 8)
}

function htmlToText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRenderedPreviewBlocks(html: string): PreviewCaptureResult['blocks'] {
  const blocks: PreviewCaptureResult['blocks'] = []

  const headingRegex = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(html)) !== null) {
    const text = htmlToText(match[2])
    if (text.length >= 3) {
      blocks.push({ type: 'heading', text })
    }
    if (blocks.length >= 40) return blocks
  }

  const paragraphRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = htmlToText(match[1])
    if (text.length >= 16) {
      blocks.push({ type: 'text', text })
    }
    if (blocks.length >= 80) return blocks
  }

  const buttonRegex = /<button\b[^>]*>([\s\S]*?)<\/button>/gi
  while ((match = buttonRegex.exec(html)) !== null) {
    const text = htmlToText(match[1])
    if (text.length >= 2) {
      blocks.push({ type: 'button', text })
    }
    if (blocks.length >= 100) return blocks
  }

  const linkRegex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi
  while ((match = linkRegex.exec(html)) !== null) {
    const text = htmlToText(match[1])
    if (text.length >= 3) {
      blocks.push({ type: 'link', text })
    }
    if (blocks.length >= 120) return blocks
  }

  return blocks
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

async function findFilesInTree(rootDir: string, preferredSuffixes: string[], maxDepth = 6, maxResults = 400): Promise<string[]> {
  const ignoredDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache', 'vendor', 'storage'])
  const normalized = preferredSuffixes.map((suffix) => suffix.replace(/\\/g, '/'))
  const found: string[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || found.length >= maxResults) return

    let entries: any[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' }) as any[]
    } catch {
      return
    }

    for (const entry of entries) {
      if (found.length >= maxResults) return

      const entryName = String(entry.name)
      const fullPath = join(dir, entryName)

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entryName)) continue
        await walk(fullPath, depth + 1)
        continue
      }

      const relativePath = relative(rootDir, fullPath).replace(/\\/g, '/')
      if (normalized.some((suffix) => relativePath.endsWith(suffix))) {
        found.push(fullPath)
      }
    }
  }

  await walk(rootDir, 0)
  return found
}

async function findLikelyAppRoots(rootDir: string, maxDepth = 4): Promise<string[]> {
  const ignoredDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache', 'vendor', 'storage'])
  const roots = new Set<string>()

  async function hasFile(dir: string, relativeFile: string): Promise<boolean> {
    return pathExists(join(dir, relativeFile))
  }

  async function inspect(dir: string): Promise<void> {
    const isLaravel = (await hasFile(dir, 'artisan')) && (await hasFile(dir, 'composer.json'))
    const isNext = (await hasFile(dir, 'next.config.js')) || (await hasFile(dir, 'next.config.mjs')) || (await hasFile(dir, 'next.config.ts'))
    const isVite = (await hasFile(dir, 'vite.config.js')) || (await hasFile(dir, 'vite.config.ts')) || (await hasFile(dir, 'vite.config.mjs'))

    if (isLaravel || isNext || isVite) {
      roots.add(dir)
    }
  }

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    await inspect(dir)

    let entries: any[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' }) as any[]
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const entryName = String(entry.name)
      if (ignoredDirs.has(entryName)) continue
      await walk(join(dir, entryName), depth + 1)
    }
  }

  await walk(rootDir, 0)

  return Array.from(roots).sort((a, b) => {
    const relA = relative(rootDir, a)
    const relB = relative(rootDir, b)
    const depthA = relA.split(/[\\/]/).filter(Boolean).length
    const depthB = relB.split(/[\\/]/).filter(Boolean).length
    if (depthA !== depthB) return depthA - depthB
    return relA.localeCompare(relB)
  })
}

async function resolveImportTargets(selectedRoot: string): Promise<Array<{ root: string; framework: SupportedFramework; entryFile: string }>> {
  const candidateRoots = [selectedRoot, ...(await findLikelyAppRoots(selectedRoot))]
  const uniqueRootMap = new Map<string, string>()
  candidateRoots.forEach((root) => {
    const normalized = root.replace(/\\/g, '/').toLowerCase()
    if (!uniqueRootMap.has(normalized)) {
      uniqueRootMap.set(normalized, root)
    }
  })
  const uniqueRoots = Array.from(uniqueRootMap.values())

  const resolved: Array<{ root: string; framework: SupportedFramework; entryFile: string }> = []
  const seenEntries = new Set<string>()

  for (const root of uniqueRoots) {
    const detected = await detectFramework(root)
    if (!detected.entryFile) continue

    const normalizedEntry = detected.entryFile.replace(/\\/g, '/')
    if (seenEntries.has(normalizedEntry)) continue
    seenEntries.add(normalizedEntry)

    resolved.push({
      root,
      framework: detected.framework,
      entryFile: detected.entryFile
    })
  }

  return resolved
}

async function buildImportAnalysis(selectedRoot: string): Promise<ImportAnalysisResult> {
  const logs: string[] = []
  logs.push(`Selected root: ${selectedRoot}`)

  const rootSignals: Record<string, boolean> = {
    artisan: await pathExists(join(selectedRoot, 'artisan')),
    composerJson: await pathExists(join(selectedRoot, 'composer.json')),
    routesWeb: await pathExists(join(selectedRoot, 'routes', 'web.php')),
    nextConfig: await pathExists(join(selectedRoot, 'next.config.js')) || await pathExists(join(selectedRoot, 'next.config.mjs')) || await pathExists(join(selectedRoot, 'next.config.ts')),
    viteConfig: await pathExists(join(selectedRoot, 'vite.config.js')) || await pathExists(join(selectedRoot, 'vite.config.ts')) || await pathExists(join(selectedRoot, 'vite.config.mjs')),
    packageJson: await pathExists(join(selectedRoot, 'package.json')),
    resourcesViews: await pathExists(join(selectedRoot, 'resources', 'views')),
    resourcesJs: await pathExists(join(selectedRoot, 'resources', 'js'))
  }
  logs.push(`Root signals: ${JSON.stringify(rootSignals)}`)

  const candidateRoots = await findLikelyAppRoots(selectedRoot)
  logs.push(`Likely app roots: ${candidateRoots.length}`)

  const targets = await resolveImportTargets(selectedRoot)
  logs.push(`Detected ${targets.length} import target(s)`)

  const candidates: ImportCandidate[] = []
  for (const target of targets) {
    const pages = await discoverSourcePages(target.root, target.framework, target.entryFile)
    logs.push(`- ${target.framework} at ${target.root} (${pages.length} page candidates)`)

    candidates.push({
      root: target.root,
      framework: target.framework,
      entryFile: target.entryFile,
      pageCount: pages.length,
      samplePages: pages.slice(0, 8).map((page) => ({
        route: page.route,
        name: page.name,
        file: relative(target.root, page.file)
      }))
    })
  }

  const manualEntryHints = targets.length === 0
    ? (await findFilesInTree(selectedRoot, [
      'routes/web.php',
      '.blade.php',
      'src/App.tsx',
      'src/App.jsx',
      'src/main.tsx',
      'src/main.jsx',
      'app/page.tsx',
      'app/page.jsx',
      'index.html'
    ], 7, 40)).map((filePath) => relative(selectedRoot, filePath))
    : []

  if (manualEntryHints.length > 0) {
    logs.push(`No direct target found. Generated ${manualEntryHints.length} manual entry hint(s).`)
  }

  return {
    selectedRoot,
    candidates,
    recommendedCandidateIndex: candidates.length > 0 ? 0 : null,
    logs,
    manualEntryHints,
    diagnostics: {
      rootSignals,
      candidateRoots
    }
  }
}

function viewNameToBladePath(sourceRoot: string, viewName: string): string {
  const normalized = viewName.trim().replace(/::/g, '/').replace(/\./g, '/')
  return join(sourceRoot, 'resources', 'views', `${normalized}.blade.php`)
}

async function detectLaravelEntryFromRoutes(sourceRoot: string): Promise<string | null> {
  const routesFile = join(sourceRoot, 'routes', 'web.php')
  if (!(await pathExists(routesFile))) return null

  const routesContent = await fs.readFile(routesFile, 'utf-8')

  const routeViewMatch = routesContent.match(/Route::view\(\s*['"]\/['"]\s*,\s*['"]([a-zA-Z0-9_\-.:]+)['"]\s*\)/)
  if (routeViewMatch?.[1]) {
    const routeViewPath = viewNameToBladePath(sourceRoot, routeViewMatch[1])
    if (await pathExists(routeViewPath)) return routeViewPath
  }

  const routeGetInlineViewMatch = routesContent.match(/Route::get\(\s*['"]\/['"]\s*,\s*function\s*\(\s*\)\s*\{[\s\S]*?return\s+view\(\s*['"]([a-zA-Z0-9_\-.:]+)['"]\s*\)/)
  if (routeGetInlineViewMatch?.[1]) {
    const inlineViewPath = viewNameToBladePath(sourceRoot, routeGetInlineViewMatch[1])
    if (await pathExists(inlineViewPath)) return inlineViewPath
  }

  const routeControllerViewMatch = routesContent.match(/Route::get\(\s*['"]\/['"]\s*,[\s\S]*?->name\(\s*['"][^'"]+['"]\s*\)/)
  if (routeControllerViewMatch) {
    const homeFallback = await findFirstFileInTree(sourceRoot, [
      'resources/views/home.blade.php',
      'resources/views/welcome.blade.php'
    ], 6)
    if (homeFallback) return homeFallback
  }

  const inertiaRootMatch = routesContent.match(/Inertia::render\(\s*['"]([A-Za-z0-9_\-\/]+)['"]\s*[,\)]/)
  if (inertiaRootMatch?.[1]) {
    const pageName = inertiaRootMatch[1]
    const inertiaCandidates = [
      join(sourceRoot, 'resources', 'js', 'Pages', `${pageName}.vue`),
      join(sourceRoot, 'resources', 'js', 'Pages', `${pageName}.tsx`),
      join(sourceRoot, 'resources', 'js', 'Pages', `${pageName}.jsx`),
      join(sourceRoot, 'resources', 'js', 'Pages', `${pageName}.ts`),
      join(sourceRoot, 'resources', 'js', 'Pages', `${pageName}.js`)
    ]

    for (const candidate of inertiaCandidates) {
      if (await pathExists(candidate)) return candidate
    }
  }

  return null
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

  const laravelSignals = await findFirstExisting([
    join(sourceRoot, 'artisan'),
    join(sourceRoot, 'composer.json')
  ])

  const laravelEntry = await findFirstExisting([
    join(sourceRoot, 'resources', 'views', 'welcome.blade.php'),
    join(sourceRoot, 'resources', 'views', 'home.blade.php'),
    join(sourceRoot, 'resources', 'views', 'layouts', 'app.blade.php'),
    join(sourceRoot, 'resources', 'views', 'app.blade.php'),
    join(sourceRoot, 'resources', 'js', 'app.tsx'),
    join(sourceRoot, 'resources', 'js', 'app.jsx'),
    join(sourceRoot, 'resources', 'js', 'app.ts'),
    join(sourceRoot, 'resources', 'js', 'app.js')
  ])

  if (laravelSignals || laravelEntry) {
    const routeDerivedEntry = await detectLaravelEntryFromRoutes(sourceRoot)
    if (routeDerivedEntry) {
      return { framework: 'laravel', entryFile: routeDerivedEntry }
    }

    if (laravelEntry) {
      return { framework: 'laravel', entryFile: laravelEntry }
    }

    const discoveredLaravelEntry = await findFirstFileInTree(sourceRoot, [
      'resources/views/welcome.blade.php',
      'resources/views/home.blade.php',
      'resources/views/layouts/app.blade.php',
      'resources/views/app.blade.php',
      '.blade.php',
      'resources/js/app.tsx',
      'resources/js/app.jsx',
      'resources/js/app.ts',
      'resources/js/app.js',
      'resources/js/Pages/.vue',
      'resources/js/Pages/.tsx',
      'resources/js/Pages/.jsx',
      'resources/js/Pages/.ts',
      'resources/js/Pages/.js'
    ])

    return { framework: 'laravel', entryFile: discoveredLaravelEntry }
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
    join(sourceRoot, 'src', 'main.js'),
    join(sourceRoot, 'resources', 'js', 'app.tsx'),
    join(sourceRoot, 'resources', 'js', 'app.jsx'),
    join(sourceRoot, 'resources', 'js', 'app.ts'),
    join(sourceRoot, 'resources', 'js', 'app.js')
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
      'src/main.js',
      'resources/js/app.tsx',
      'resources/js/app.jsx',
      'resources/js/app.ts',
      'resources/js/app.js'
    ])

    if (discoveredViteEntry) {
      return { framework: 'react-vite', entryFile: discoveredViteEntry }
    }
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
    'src/app/page.js',
    'resources/views/welcome.blade.php',
    '.blade.php'
  ])

  return { framework: 'unknown', entryFile: discoveredGenericEntry }
}

function titleFromRoute(route: string): string {
  if (route === '/') return 'Home'
  return route
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Page'
}

function parseLaravelControllerUses(routesContent: string): Record<string, string> {
  const map: Record<string, string> = {}
  const useRegex = /^\s*use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+([A-Za-z0-9_]+))?\s*;/gm
  let match: RegExpExecArray | null

  while ((match = useRegex.exec(routesContent)) !== null) {
    const full = match[1]
    const alias = match[2] || full.split('\\').pop() || full
    map[alias] = full
  }

  return map
}

function fqcnToControllerPath(sourceRoot: string, fqcn: string): string | null {
  if (!fqcn.startsWith('App\\')) return null
  const relativeClassPath = fqcn.replace(/^App\\/, '').replace(/\\/g, '/')
  return join(sourceRoot, 'app', `${relativeClassPath}.php`)
}

async function findViewFromControllerMethod(sourceRoot: string, controllerFqcn: string, methodName: string): Promise<string | null> {
  const controllerPath = fqcnToControllerPath(sourceRoot, controllerFqcn)
  if (!controllerPath || !(await pathExists(controllerPath))) return null

  const controllerContent = await fs.readFile(controllerPath, 'utf-8')
  const methodRegex = new RegExp(`function\\s+${methodName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const methodMatch = controllerContent.match(methodRegex)
  if (!methodMatch?.[1]) return null

  const body = methodMatch[1]
  const viewMatch = body.match(/return\s+view\(\s*['"]([A-Za-z0-9_.\-]+)['"]/)
  if (!viewMatch?.[1]) return null

  const viewPath = viewNameToBladePath(sourceRoot, viewMatch[1])
  if (!(await pathExists(viewPath))) return null
  return viewPath
}

async function discoverLaravelPages(sourceRoot: string, fallbackEntry: string): Promise<DiscoveredPage[]> {
  const pages = new Map<string, DiscoveredPage>()
  const routesFile = join(sourceRoot, 'routes', 'web.php')

  if (await pathExists(routesFile)) {
    const routesContent = await fs.readFile(routesFile, 'utf-8')
    const controllerUses = parseLaravelControllerUses(routesContent)

    const routeViewRegex = /Route::view\(\s*['"]([^'"]+)['"]\s*,\s*['"]([a-zA-Z0-9_\-.:]+)['"]\s*\)/g
    let routeViewMatch: RegExpExecArray | null
    while ((routeViewMatch = routeViewRegex.exec(routesContent)) !== null) {
      const route = normalizeRoute(routeViewMatch[1])
      const viewPath = viewNameToBladePath(sourceRoot, routeViewMatch[2])
      if (!(await pathExists(viewPath))) continue

      pages.set(route, {
        route,
        name: titleFromRoute(route),
        file: viewPath,
        framework: 'laravel'
      })
    }

    const inlineViewRegex = /Route::get\(\s*['"]([^'"]+)['"]\s*,\s*function\s*\(\s*\)\s*\{[\s\S]*?return\s+view\(\s*['"]([a-zA-Z0-9_\-.:]+)['"]\s*\)/g
    let inlineViewMatch: RegExpExecArray | null
    while ((inlineViewMatch = inlineViewRegex.exec(routesContent)) !== null) {
      const route = normalizeRoute(inlineViewMatch[1])
      const viewPath = viewNameToBladePath(sourceRoot, inlineViewMatch[2])
      if (!(await pathExists(viewPath))) continue

      pages.set(route, {
        route,
        name: titleFromRoute(route),
        file: viewPath,
        framework: 'laravel'
      })
    }

    const controllerRouteRegex = /Route::get\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([A-Za-z0-9_\\]+)::class\s*,\s*['"]([A-Za-z0-9_]+)['"]\s*\]\s*\)/g
    let controllerRouteMatch: RegExpExecArray | null
    while ((controllerRouteMatch = controllerRouteRegex.exec(routesContent)) !== null) {
      const route = normalizeRoute(controllerRouteMatch[1])
      const alias = controllerRouteMatch[2]
      const method = controllerRouteMatch[3]

      const controllerFqcn = alias.includes('\\') ? alias : controllerUses[alias]
      if (!controllerFqcn) continue

      const viewPath = await findViewFromControllerMethod(sourceRoot, controllerFqcn, method)
      if (!viewPath) continue

      pages.set(route, {
        route,
        name: titleFromRoute(route),
        file: viewPath,
        framework: 'laravel'
      })
    }
  }

  if (pages.size === 0) {
    const bladePaths = await findFirstFileInTree(sourceRoot, ['resources/views/welcome.blade.php', '.blade.php'], 6)
    if (bladePaths) {
      pages.set('/', {
        route: '/',
        name: 'Home',
        file: bladePaths,
        framework: 'laravel'
      })
    }
  }

  if (pages.size === 0) {
    pages.set('/', {
      route: '/',
      name: 'Home',
      file: fallbackEntry,
      framework: 'laravel'
    })
  }

  return Array.from(pages.values()).sort((a, b) => a.route.localeCompare(b.route))
}

async function discoverSourcePages(sourceRoot: string, framework: SupportedFramework, entryFile: string): Promise<DiscoveredPage[]> {
  if (framework === 'laravel') {
    return discoverLaravelPages(sourceRoot, entryFile)
  }

  return [
    {
      route: '/',
      name: 'Home',
      file: entryFile,
      framework
    }
  ]
}

function buildImportedNodes(sourceCode: string, sourcePath: string, sourceRoot: string, pageId: string): { nodes: ImportedNode[]; mappings: SourceMappingItem[] } {
  const elementRegex = /<([a-zA-Z][a-zA-Z0-9:._-]*)\b([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z][a-zA-Z0-9:._-]*)\b([^>]*)\/>/g
  const nodes: ImportedNode[] = []
  const mappings: SourceMappingItem[] = []
  const sourcePathRelative = relative(sourceRoot, sourcePath)
  let match: RegExpExecArray | null
  let visualIndex = 0
  const perTagCount = new Map<string, number>()

  while ((match = elementRegex.exec(sourceCode)) !== null) {
    const tag = (match[1] || match[4] || '').toLowerCase()
    const attrsBlock = match[2] || match[5] || ''
    const innerHtml = match[3] || ''
    if (tag === 'script' || tag === 'style') continue

    const isBladeComponentTag = tag.startsWith('x-')
    const componentType = TAG_TO_COMPONENT[tag] || (isBladeComponentTag ? 'card' : undefined)
    if (!componentType) continue

    if (componentType === 'container') {
      continue
    }

    const rawText = extractTextContent(innerHtml)
    const text = sanitizeBladeText(rawText)

    if (componentType === 'text' && text.length < 3) continue
    if (componentType === 'heading' && text.length < 2) continue
    if (componentType === 'card' && !isBladeComponentTag && text.length < 6) continue

    const nodeId = makeNodeId('node')
    const y = 24 + Math.floor(visualIndex / 2) * 86
    const x = 24 + (visualIndex % 2) * 400

    const node: ImportedNode = {
      id: nodeId,
      type: componentType,
      pageId,
      parentId: null,
      position: { x, y },
      size: {
        width: componentType === 'container' ? 420 : componentType === 'heading' ? 420 : 320,
        height: componentType === 'textarea' ? 120 : componentType === 'heading' ? 56 : 44
      },
      style: {
        boxSizing: 'border-box'
      },
      props: {},
      children: [],
      name: isBladeComponentTag ? tag : componentType[0].toUpperCase() + componentType.slice(1),
      locked: false,
      visible: true
    }

    if (componentType === 'heading') {
      node.props.text = text || 'Heading'
      node.props.level = Number(tag.replace('h', '')) || 2
      node.style = {
        ...node.style,
        color: '#111827'
      }
    } else if (componentType === 'text') {
      node.props.content = text || 'Text'
      node.style = {
        ...node.style,
        color: '#374151'
      }
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
      const cardTitle = isBladeComponentTag ? tag : (text || 'Card')
      node.props.title = cardTitle
      node.size = { width: 420, height: 160 }
      node.style = {
        ...node.style,
        border: '1px solid #D1D5DB',
        borderRadius: '10px',
        backgroundColor: '#FFFFFF',
        color: '#111827',
        padding: '12px'
      }
    } else if (componentType === 'container') {
      node.style = {
        ...node.style,
        border: '1px dashed #93C5FD',
        backgroundColor: '#F8FAFC'
      }
    }

    nodes.push(node)
    const currentTagCount = (perTagCount.get(tag) || 0) + 1
    perTagCount.set(tag, currentTagCount)

    mappings.push({
      nodeId,
      pageId,
      sourcePath: sourcePathRelative,
      selector: `${tag}:nth-of-type(${currentTagCount})`,
      kind: 'element'
    })

    visualIndex += 1
    if (nodes.length >= 100) break
  }

  if (nodes.length <= 2) {
    const fallbackChunks = collectFallbackTextChunks(sourceCode)
    fallbackChunks.forEach((chunk, chunkIndex) => {
      if (nodes.length >= 100) return
      const nodeId = makeNodeId('node')
      nodes.push({
        id: nodeId,
        type: chunkIndex === 0 ? 'heading' : 'text',
        pageId,
        parentId: null,
        position: { x: 32, y: 36 + chunkIndex * 72 },
        size: { width: 680, height: chunkIndex === 0 ? 56 : 52 },
        style: {
          boxSizing: 'border-box',
          color: '#111827',
          fontSize: chunkIndex === 0 ? '22px' : '15px',
          fontWeight: chunkIndex === 0 ? '700' : '400',
          lineHeight: '1.5'
        },
        props: chunkIndex === 0
          ? { text: chunk.slice(0, 90), level: 2 }
          : { content: chunk.slice(0, 180) },
        children: [],
        name: chunkIndex === 0 ? 'Imported Heading' : 'Imported Text',
        locked: false,
        visible: true
      })
    })
  }

  if (nodes.length === 0) {
    const fallbackNodeId = makeNodeId('node')
    nodes.push({
      id: fallbackNodeId,
      type: 'heading',
      pageId,
      parentId: null,
      position: { x: 32, y: 36 },
      size: { width: 620, height: 58 },
      style: {
        boxSizing: 'border-box',
        fontSize: '22px',
        fontWeight: '700',
        color: '#111827'
      },
      props: {
        text: `Imported: ${sourcePathRelative}`,
        level: 2
      },
      children: [],
      name: 'Imported Page',
      locked: false,
      visible: true
    })
  }

  return { nodes, mappings }
}

async function readSourceMapManifest(projectPath: string): Promise<SourceMappingManifest> {
  const manifestPath = join(projectPath, '.aiuiedit', 'source-map.json')
  const raw = await fs.readFile(manifestPath, 'utf-8')
  return JSON.parse(raw)
}

function parseSelector(selector: string): { tag: string; nth: number } | null {
  const match = selector.match(/^([a-zA-Z][a-zA-Z0-9:._-]*):nth-of-type\((\d+)\)$/)
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

async function writeImportAnalysisReport(analysis: ImportAnalysisResult): Promise<string> {
  await ensureaiuieditDir()
  const cacheDir = join(AIUIEDIT_DIR, 'cache')
  await fs.mkdir(cacheDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = join(cacheDir, `import-analysis-${timestamp}.json`)
  const latestPath = join(cacheDir, 'import-analysis-latest.json')
  const payload = {
    generatedAt: new Date().toISOString(),
    ...analysis
  }

  await Promise.all([
    fs.writeFile(reportPath, JSON.stringify(payload, null, 2)),
    fs.writeFile(latestPath, JSON.stringify(payload, null, 2))
  ])

  return reportPath
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

  ipcMain.handle('app:open-external', async (_event, url: string) => {
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle('preview:capture-route', async (_event, payload: PreviewCapturePayload): Promise<PreviewCaptureResult> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    try {
      const response = await fetch(payload.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'aiuiedit-render-capture/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Preview request failed (${response.status})`)
      }

      const html = await response.text()
      const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
      const title = titleMatch ? htmlToText(titleMatch[1]) : 'Rendered Page'
      const blocks = extractRenderedPreviewBlocks(html)
      const htmlPayload = html.length > 1_500_000 ? html.slice(0, 1_500_000) : html

      return {
        url: payload.url,
        title,
        html: htmlPayload,
        blocks
      }
    } catch (error: any) {
      const reason = error?.name === 'AbortError' ? 'Preview request timed out' : (error?.message || 'Preview capture failed')
      throw new Error(reason)
    } finally {
      clearTimeout(timeout)
    }
  })

  const importSourceProject = async (
    sourceRoot: string,
    entryFile: string,
    framework: SupportedFramework,
    discoveredPagesOverride?: DiscoveredPage[],
    debugContext?: {
      mode: 'auto' | 'plan' | 'manual'
      analysis?: ImportAnalysisResult
    }
  ) => {
    const workspaceRoot = await getWorkspaceRoot()
    const projectsDir = join(workspaceRoot, 'projects')
    await fs.mkdir(projectsDir, { recursive: true })

    const entryRelative = relative(sourceRoot, entryFile)
    if (entryRelative.startsWith('..')) {
      throw new Error('Selected entry file must be inside the selected source directory')
    }

    const discoveredPages = discoveredPagesOverride || await discoverSourcePages(sourceRoot, framework, entryFile)
    const pagesWithIds = discoveredPages.map((page, index) => ({
      ...page,
      id: `page-${index + 1}`
    }))

    const nodes: ImportedNode[] = []
    const mappings: SourceMappingItem[] = []

    for (const page of pagesWithIds) {
      const pageSource = await fs.readFile(page.file, 'utf-8')
      const imported = buildImportedNodes(pageSource, page.file, sourceRoot, page.id)
      nodes.push(...imported.nodes)
      mappings.push(...imported.mappings)
    }

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
      pages: pagesWithIds.map((page) => ({
        id: page.id,
        name: page.name,
        route: page.route,
        title: page.name,
        description: '',
        template: 'default',
        noIndex: false,
        authRequired: false
      })),
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
        framework,
        entryFile: entryRelative,
        roundTrip: true,
        pages: Object.fromEntries(
          pagesWithIds.map((page) => [
            page.id,
            {
              file: relative(sourceRoot, page.file),
              route: page.route,
              framework: page.framework
            }
          ])
        )
      }
    }

    const manifest: SourceMappingManifest = {
      version: 1,
      framework,
      sourceRoot,
      entryFile: entryRelative,
      generatedAt: new Date().toISOString(),
      mappings
    }

    const canvas = {
      nodes,
      selectedIds: [],
      zoom: 1,
      viewport: { x: 0, y: 0 }
    }

    await Promise.all([
      fs.writeFile(join(projectDir, 'project.json'), JSON.stringify(project, null, 2)),
      fs.writeFile(join(projectDir, 'canvas-state.json'), JSON.stringify(canvas, null, 2)),
      fs.writeFile(join(projectDir, '.aiuiedit', 'source-map.json'), JSON.stringify(manifest, null, 2))
    ])

    const importDebugReport: ImportDebugReport = {
      generatedAt: new Date().toISOString(),
      selectedRoot: sourceRoot,
      sourceRoot,
      framework,
      mode: debugContext?.mode || 'auto',
      entryFile: entryRelative,
      pageCount: pagesWithIds.length,
      mappingCount: mappings.length,
      pages: pagesWithIds.map((page) => ({
        id: page.id,
        name: page.name,
        route: page.route,
        framework: page.framework,
        sourceFile: relative(sourceRoot, page.file)
      })),
      analysis: debugContext?.analysis
    }

    const importDebugPath = join(projectDir, '.aiuiedit', 'import-debug-report.json')
    await fs.writeFile(importDebugPath, JSON.stringify(importDebugReport, null, 2))

    return {
      path: projectDir,
      project,
      canvas,
      importDebugPath
    }
  }

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

  ipcMain.handle('dialog:select-entry-file', async (_event, sourceRoot?: string) => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      console.error('No main window available')
      return null
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select App Entry File',
      defaultPath: sourceRoot,
      buttonLabel: 'Use Entry File',
      filters: [
        {
          name: 'Web Source Files',
          extensions: ['tsx', 'ts', 'jsx', 'js', 'html', 'php']
        }
      ]
    })

    if (result.canceled) {
      return null
    }

    return result.filePaths[0] || null
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
    const analysis = await buildImportAnalysis(sourceRoot)
    const analysisReportPath = await writeImportAnalysisReport(analysis)

    const targets = await resolveImportTargets(sourceRoot)
    if (targets.length === 0) {
      throw new Error('Could not detect an entry file. Select the app folder (for monorepos, choose the frontend package directory).')
    }

    const allPages: DiscoveredPage[] = []
    for (const target of targets) {
      const discoveredPages = await discoverSourcePages(target.root, target.framework, target.entryFile)
      const rootPrefix = relative(sourceRoot, target.root).replace(/\\/g, '/')

      for (const page of discoveredPages) {
        allPages.push({
          ...page,
          framework: target.framework,
          name: rootPrefix && rootPrefix !== '.' ? `${rootPrefix} / ${page.name}` : page.name,
          route: rootPrefix && rootPrefix !== '.' && !page.route.startsWith('file:')
            ? `${normalizeRoute(`/${rootPrefix}`)}${page.route === '/' ? '' : page.route}`
            : page.route
        })
      }
    }

    const uniquePagesMap = new Map<string, DiscoveredPage>()
    allPages.forEach((page) => {
      const key = `${page.file}|${page.route}`
      if (!uniquePagesMap.has(key)) {
        uniquePagesMap.set(key, page)
      }
    })
    const uniquePages = Array.from(uniquePagesMap.values())

    const primary = targets[0]
    const primaryFramework = new Set(targets.map((target) => target.framework)).size > 1 ? 'mixed' : primary.framework

    const imported = await importSourceProject(sourceRoot, primary.entryFile, primaryFramework, uniquePages, {
      mode: 'auto',
      analysis: {
        ...analysis,
        reportPath: analysisReportPath
      }
    })

    return {
      ...imported,
      analysisReportPath
    }
  })

  ipcMain.handle('projects:analyze-source', async (_event, sourceRoot: string) => {
    const analysis = await buildImportAnalysis(sourceRoot)
    const reportPath = await writeImportAnalysisReport(analysis)
    return {
      ...analysis,
      reportPath
    }
  })

  ipcMain.handle('projects:import-source-plan', async (
    _event,
    payload: {
      selectedRoot: string
      root: string
      framework: SupportedFramework
      entryFile: string
    }
  ) => {
    const sourceRoot = payload.selectedRoot || payload.root
    const root = payload.root || sourceRoot
    const discoveredPages = await discoverSourcePages(root, payload.framework, payload.entryFile)

    const rootedPages = discoveredPages.map((page) => {
      const prefix = relative(sourceRoot, root).replace(/\\/g, '/')
      return {
        ...page,
        name: prefix && prefix !== '.' ? `${prefix} / ${page.name}` : page.name,
        route: prefix && prefix !== '.' && !page.route.startsWith('file:')
          ? `${normalizeRoute(`/${prefix}`)}${page.route === '/' ? '' : page.route}`
          : page.route
      }
    })

    const imported = await importSourceProject(sourceRoot, payload.entryFile, payload.framework, rootedPages, {
      mode: 'plan'
    })
    return imported
  })

  ipcMain.handle('projects:import-source-with-entry', async (_event, sourceRoot: string, entryFile: string) => {
    const detected = await detectFramework(sourceRoot)
    const framework = detected.framework === 'unknown' ? 'unknown' : detected.framework
    return importSourceProject(sourceRoot, entryFile, framework, undefined, {
      mode: 'manual'
    })
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
    const sourcePages = { ...(project.source.pages || {}) } as Record<string, { file: string; route: string; framework?: SupportedFramework }>
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
      route: normalizedRoute,
      framework: 'nextjs'
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
    const sourcePages: Record<string, { file: string; route: string; framework?: SupportedFramework }> = project.source.pages || {
      'page-1': {
        file: project.source.entryFile,
        route: '/'
      }
    }

    const nodes: ImportedNode[] = []
    const mappings: SourceMappingItem[] = []

    for (const [pageId, pageSource] of Object.entries(sourcePages)) {
      const absolutePath = join(sourceRoot, pageSource.file)
      if (!(await pathExists(absolutePath))) continue

      const sourceCode = await fs.readFile(absolutePath, 'utf-8')
      const builtPage = buildImportedNodes(sourceCode, absolutePath, sourceRoot, pageId)
      nodes.push(...builtPage.nodes)
      mappings.push(...builtPage.mappings)
    }

    const manifest: SourceMappingManifest = {
      version: 1,
      framework: project.source.framework as SupportedFramework,
      sourceRoot,
      entryFile: project.source.entryFile,
      generatedAt: new Date().toISOString(),
      mappings
    }

    const canvas = {
      nodes,
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
