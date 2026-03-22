import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

// Custom plugin to copy preload script without processing
const copyPreloadPlugin = () => ({
  name: 'copy-preload',
  buildStart() {
    try {
      mkdirSync('dist-electron/preload', { recursive: true })
      copyFileSync('electron/preload/index.cjs', 'dist-electron/preload/index.cjs')
      console.log('Preload script copied successfully')
    } catch (err) {
      console.error('Failed to copy preload:', err)
    }
  }
})

export default defineConfig({
  plugins: [
    react(),
    copyPreloadPlugin(),
    electron([
      {
        // Main process entry
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: process.env.NODE_ENV === 'production',
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html')
      }
    }
  },
  clearScreen: false
})
