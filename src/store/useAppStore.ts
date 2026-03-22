import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/types'

interface AppState {
  settings: AppSettings
  isWelcomeOpen: boolean
  isLoading: boolean
  setSettings: (settings: Partial<AppSettings>) => void
  setWelcomeOpen: (open: boolean) => void
  setLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        workspacePath: '',
        theme: 'system',
        aiModel: 'kimi-latest',
        recentProjects: [],
        shortcuts: {},
        canvasViewMode: 'layout',
        livePreviewBaseUrl: 'http://127.0.0.1:8000'
      },
      isWelcomeOpen: true,
      isLoading: false,
      setSettings: (newSettings) =>
        set((state) => {
          const normalized = { ...newSettings }
          if (normalized.canvasViewMode === 'design') {
            normalized.canvasViewMode = 'layout'
          }

          return {
            settings: { ...state.settings, ...normalized }
          }
        }),
      setWelcomeOpen: (open) => set({ isWelcomeOpen: open }),
      setLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: 'aiuiedit-storage'
    }
  )
)
