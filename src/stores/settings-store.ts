import { create } from 'zustand'

interface SettingsState {
  downloadDir: string | null
  isLoading: boolean
  maxConcurrentDownloads: number
  setDownloadDir: (dir: string | null) => void
  setIsLoading: (loading: boolean) => void
  chooseDownloadDir: () => Promise<string | null>
  ensureDownloadDir: () => Promise<string | null>
  loadDownloadDir: () => Promise<void>
  loadMaxConcurrentDownloads: () => Promise<void>
  setMaxConcurrentDownloads: (count: number) => void
}

const CONCURRENCY_STORAGE_KEY = 'ccd-max-concurrent-downloads'
const DEFAULT_MAX_CONCURRENT = 3

function clampConcurrentDownloads(value: unknown): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return DEFAULT_MAX_CONCURRENT
  }
  const rounded = Math.round(numberValue)
  return Math.min(Math.max(rounded, 1), 10)
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
  maxConcurrentDownloads: DEFAULT_MAX_CONCURRENT,

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

  loadMaxConcurrentDownloads: async () => {
    let localValue = DEFAULT_MAX_CONCURRENT

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(CONCURRENCY_STORAGE_KEY)
      if (stored != null) {
        localValue = clampConcurrentDownloads(stored)
        set({ maxConcurrentDownloads: localValue })
      }
    }

    if (typeof window === 'undefined' || !window.ipcRenderer) {
      set({ maxConcurrentDownloads: localValue })
      return
    }

    try {
      const remote = await invokeIpc<number>(
        'settings:get-max-concurrent-downloads'
      )
      const clamped = clampConcurrentDownloads(remote)
      set({ maxConcurrentDownloads: clamped })
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          CONCURRENCY_STORAGE_KEY,
          String(clamped)
        )
      }
    } catch (error) {
      console.error('Failed to load max concurrent downloads', error)
    }
  },

  setMaxConcurrentDownloads: (count) => {
    const clamped = clampConcurrentDownloads(count)
    set({ maxConcurrentDownloads: clamped })

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONCURRENCY_STORAGE_KEY, String(clamped))

      if (window.ipcRenderer) {
        invokeIpc<number>('settings:set-max-concurrent-downloads', clamped).catch(
          (error) => {
            console.error('Failed to update max concurrent downloads', error)
          }
        )
      }
    }
  },
}))
