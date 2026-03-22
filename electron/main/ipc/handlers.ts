import { ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { getMainWindow } from '../index.js'

const AIUIEDIT_DIR = join(homedir(), 'aiuiedit')
const SETTINGS_FILE = join(AIUIEDIT_DIR, 'settings.json')

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
      return JSON.parse(data)
    } catch {
      // Return default settings
      return {
        workspacePath: AIUIEDIT_DIR,
        theme: 'system',
        aiModel: 'kimi-latest',
        recentProjects: [],
        shortcuts: {}
      }
    }
  })

  // List projects
  ipcMain.handle('projects:list', async () => {
    await ensureaiuieditDir()
    const projectsDir = join(AIUIEDIT_DIR, 'projects')
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
    await ensureaiuieditDir()
    const projectDir = join(AIUIEDIT_DIR, 'projects', `${name}.canvas`)
    
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
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: [
        {
          id: 'page-1',
          name: 'Home',
          route: '/'
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

  console.log('IPC handlers registered')
}
