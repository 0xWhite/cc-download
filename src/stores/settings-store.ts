import { create } from 'zustand'

interface SettingsState {
  downloadDir: string | null
  isLoading: boolean
  setDownloadDir: (dir: string | null) => void
  setIsLoading: (loading: boolean) => void
  chooseDownloadDir: () => Promise<string | null>
  ensureDownloadDir: () => Promise<string | null>
  loadDownloadDir: () => Promise<void>
}

async function invokeIpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof window === 'undefined' || !window.ipcRenderer) {
    throw new Error('IPC is not available in the current context')
  }
  return window.ipcRenderer.invoke(channel, ...args) as Promise<T>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  downloadDir: null,
  isLoading: true,

  setDownloadDir: (dir) => set({ downloadDir: dir }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  loadDownloadDir: async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) {
      set({ isLoading: false })
      return
    }

    try {
      const dir = await invokeIpc<string | null>('settings:get-download-dir')
      set({ downloadDir: dir })
    } finally {
      set({ isLoading: false })
    }
  },

  chooseDownloadDir: async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) {
      return null
    }
    const dir = await invokeIpc<string | null>('settings:choose-download-dir')
    if (dir) {
      set({ downloadDir: dir })
    }
    return dir
  },

  ensureDownloadDir: async () => {
    const { downloadDir, chooseDownloadDir } = get()
    if (downloadDir) {
      return downloadDir
    }
    const dir = await chooseDownloadDir()
    return dir
  },
}))
