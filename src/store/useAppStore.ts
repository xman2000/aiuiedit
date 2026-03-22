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
        shortcuts: {}
      },
      isWelcomeOpen: true,
      isLoading: false,
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
      setWelcomeOpen: (open) => set({ isWelcomeOpen: open }),
      setLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: 'aiuiedit-storage'
    }
  )
)
