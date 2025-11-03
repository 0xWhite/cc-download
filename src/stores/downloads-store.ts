import { create } from 'zustand'
import { toast } from 'sonner'
import {
  type DownloadEvent,
  type DownloadItem,
  type DownloadProgress,
} from '@/features/downloads/types'
import { useSettingsStore } from './settings-store'

export type VideoFormat = {
  format_id: string
  ext: string
  resolution?: string
  height?: number
  width?: number
  fps?: number
  filesize?: number
  format_note?: string
}

export type VideoInfo = {
  url: string
  title?: string
  thumbnail?: string
  duration?: number
  durationText?: string
  source?: string
  uploader?: string
  channel?: string
  viewCount?: number
  likeCount?: number
  uploadDate?: string
  width?: number
  height?: number
  filesize?: number
  description?: string
  formats?: VideoFormat[]
}

interface DownloadsState {
  downloads: DownloadItem[]
  // 视频信息获取状态
  currentUrl: string
  videoInfo: VideoInfo | null
  isFetchingInfo: boolean
  fetchError: string | null

  addDownload: (item: DownloadItem) => void
  updateDownload: (
    id: string,
    data: Partial<Omit<DownloadItem, 'progress'>> & {
      progress?: Partial<DownloadProgress>
    }
  ) => void
  removeDownload: (id: string) => void
  clearHistory: () => void
  startDownload: (
    url: string,
    options?: {
      downloadType?: 'video' | 'audio'
      videoFormat?: string
      audioFormat?: 'mp3' | 'm4a'
      force?: boolean
      overrideId?: string
      existingFilePath?: string
      existingTitle?: string
      title?: string
      thumbnail?: string
      duration?: number
      durationText?: string
      source?: string
    }
  ) => Promise<void>
  restartDownload: (item: DownloadItem) => Promise<void>
  openLocation: (item: {
    filePath?: string
    directory?: string
  }) => Promise<void>
  deleteDownload: (id: string, filePath?: string) => Promise<void>
  setupEventListener: () => () => void
  loadHistory: () => void

  // 视频信息获取方法
  setCurrentUrl: (url: string) => void
  fetchVideoInfo: (url: string) => Promise<void>
  clearVideoInfo: () => void
}

function createPlaceholder(url: string): DownloadItem {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    url,
    status: 'queued',
    progress: { percent: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

const STORAGE_KEY = 'ccd-download-history'
const VIDEO_STATE_KEY = 'ccd-video-state'
const MAX_HISTORY = 100

function saveToStorage(downloads: DownloadItem[]) {
  try {
    // 限制历史数量，只保留最新的
    const toSave = downloads.slice(0, MAX_HISTORY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('Failed to save download history', error)
  }
}

function loadFromStorage(): DownloadItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved) as DownloadItem[]
    // 验证数据结构
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item.id && item.url)
    }
  } catch (error) {
    console.error('Failed to load download history', error)
  }
  return []
}

// 持久化视频状态
function saveVideoState(state: {
  currentUrl: string
  videoInfo: VideoInfo | null
  isFetchingInfo: boolean
}) {
  try {
    sessionStorage.setItem(VIDEO_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save video state', error)
  }
}

function loadVideoState(): {
  currentUrl: string
  videoInfo: VideoInfo | null
  isFetchingInfo: boolean
} {
  try {
    const saved = sessionStorage.getItem(VIDEO_STATE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load video state', error)
  }
  return {
    currentUrl: '',
    videoInfo: null,
    isFetchingInfo: false,
  }
}

export const useDownloadsStore = create<DownloadsState>((set, get) => {
  // 初始化时加载持久化的视频状态
  const savedVideoState = loadVideoState()

  return {
    downloads: [],
    currentUrl: savedVideoState.currentUrl,
    videoInfo: savedVideoState.videoInfo,
    isFetchingInfo: savedVideoState.isFetchingInfo,
    fetchError: null,

    loadHistory: () => {
      const history = loadFromStorage()
      set({ downloads: history })
    },

    setCurrentUrl: (url) => {
      const state = get()
      // 如果 URL 变化且有错误，清除错误提示
      if (url !== state.currentUrl && state.fetchError) {
        set({ currentUrl: url, fetchError: null })
      } else {
        set({ currentUrl: url })
      }

      const newState = get()
      saveVideoState({
        currentUrl: url,
        videoInfo: newState.videoInfo,
        isFetchingInfo: newState.isFetchingInfo,
      })
    },

    fetchVideoInfo: async (url) => {
      const trimmed = url.trim()
      if (!trimmed) {
        toast.error('请输入视频链接')
        return
      }

      // 设置加载状态并立即持久化
      set({
        isFetchingInfo: true,
        videoInfo: null,
        fetchError: null,
        currentUrl: trimmed,
      })
      saveVideoState({
        currentUrl: trimmed,
        videoInfo: null,
        isFetchingInfo: true,
      })

      try {
        if (typeof window !== 'undefined' && window.ipcRenderer) {
          const info = (await window.ipcRenderer.invoke(
            'download:fetch-info',
            trimmed
          )) as VideoInfo

          // 更新状态并持久化
          set({
            videoInfo: info,
            isFetchingInfo: false,
            fetchError: null,
          })
          saveVideoState({
            currentUrl: trimmed,
            videoInfo: info,
            isFetchingInfo: false,
          })
          toast.success('视频信息获取成功')
        } else {
          throw new Error('IPC Renderer not available')
        }
      } catch (error) {
        console.error('Failed to fetch video info', error)

        // 直接使用后端返回的错误信息，不再重新解析
        const errorMessage =
          error instanceof Error ? error.message : '获取视频信息失败'

        // 更新错误状态并持久化
        set({
          isFetchingInfo: false,
          fetchError: errorMessage,
          videoInfo: null,
        })
        saveVideoState({
          currentUrl: trimmed,
          videoInfo: null,
          isFetchingInfo: false,
        })
        toast.error('获取失败', {
          description: errorMessage,
          duration: 5000,
        })
      }
    },

    clearVideoInfo: () => {
      const state = get()
      set({
        videoInfo: null,
        fetchError: null,
      })
      saveVideoState({
        currentUrl: state.currentUrl, // 保留 URL
        videoInfo: null,
        isFetchingInfo: false,
      })
    },

    addDownload: (item) =>
      set((state) => {
        const existingIndex = state.downloads.findIndex((d) => d.id === item.id)
        let newDownloads: DownloadItem[]
        if (existingIndex === -1) {
          newDownloads = [item, ...state.downloads]
        } else {
          newDownloads = state.downloads.map((d, index) =>
            index === existingIndex ? { ...d, ...item } : d
          )
        }
        saveToStorage(newDownloads)
        return { downloads: newDownloads }
      }),

    updateDownload: (id, data) =>
      set((state) => {
        const newDownloads = state.downloads.map((item) => {
          if (item.id !== id) return item
          const mergedProgress: DownloadProgress = {
            percent: data.progress?.percent ?? item.progress.percent,
            speed: data.progress?.speed ?? item.progress.speed,
            eta: data.progress?.eta ?? item.progress.eta,
          }
          return {
            ...item,
            ...data,
            progress: mergedProgress,
            updatedAt: Date.now(),
          }
        })
        saveToStorage(newDownloads)
        return { downloads: newDownloads }
      }),

    removeDownload: (id) =>
      set((state) => {
        const newDownloads = state.downloads.filter((item) => item.id !== id)
        saveToStorage(newDownloads)
        return { downloads: newDownloads }
      }),

    clearHistory: () => {
      set({ downloads: [] })
      localStorage.removeItem(STORAGE_KEY)
      toast.success('下载历史已清空')
    },

    startDownload: async (inputUrl, options) => {
      const trimmed = inputUrl.trim()
      if (!trimmed) return

      if (typeof window === 'undefined' || !window.ipcRenderer) {
        const placeholder = createPlaceholder(trimmed)
        const ensuredDir = await useSettingsStore.getState().ensureDownloadDir()
        if (ensuredDir) {
          placeholder.directory = ensuredDir
        }
        get().addDownload(placeholder)
        return
      }

      const ipcRenderer = window.ipcRenderer
      const directory = await useSettingsStore.getState().ensureDownloadDir()
      if (!directory) {
        return
      }

      const force = options?.force ?? false
      const overrideId = options?.overrideId
      const existingFilePath = options?.existingFilePath
      const existingTitle = options?.existingTitle || options?.title

      // 不再自动检测并覆盖同URL的下载，每次都创建新的下载记录

      try {
        const item = (await ipcRenderer.invoke('download:start', {
          url: trimmed,
          downloadType: options?.downloadType || 'video',
          videoFormat: options?.videoFormat,
          audioFormat: options?.audioFormat,
          force,
          overrideId,
          existingFilePath,
          existingTitle,
          title: options?.title,
          thumbnail: options?.thumbnail,
          duration: options?.duration,
          durationText: options?.durationText,
          source: options?.source,
        })) as DownloadItem | undefined
        if (item) {
          item.directory = directory
          get().addDownload(item)
        }
      } catch (error) {
        console.error('Failed to start download', error)
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        toast.error('下载失败', {
          description: errorMessage,
        })
        const placeholder = createPlaceholder(trimmed)
        placeholder.status = 'failed'
        placeholder.error = errorMessage
        placeholder.directory = directory
        get().addDownload(placeholder)
      }
    },

    restartDownload: async (item) => {
      await get().startDownload(item.url, {
        downloadType: item.downloadType,
        force: true,
        overrideId: item.id,
        existingFilePath: item.filePath,
        existingTitle: item.filePath
          ? item.filePath
              .split(/[\\/]/)
              .pop()
              ?.replace(/\.[^.]+$/, '') ?? item.title
          : item.title,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        durationText: item.durationText,
        source: item.source,
      })
    },

    openLocation: async (item) => {
      if (typeof window === 'undefined' || !window.ipcRenderer) {
        return
      }
      await window.ipcRenderer.invoke('download:open', item)
    },

    deleteDownload: async (id, filePath) => {
      if (typeof window === 'undefined' || !window.ipcRenderer) {
        get().removeDownload(id)
        return
      }
      try {
        await window.ipcRenderer.invoke('download:delete', { id, filePath })
        get().removeDownload(id)
      } catch (error) {
        console.error('Failed to delete download', error)
      }
    },

    setupEventListener: () => {
      if (typeof window === 'undefined' || !window.ipcRenderer) {
        return () => {}
      }

      const ipcRenderer = window.ipcRenderer

      const handler = (
        _event: Electron.IpcRendererEvent,
        message: DownloadEvent
      ) => {
        const { addDownload, updateDownload, removeDownload, downloads } = get()

        switch (message.type) {
          case 'queued':
            addDownload(message.payload)
            break
          case 'progress': {
            const current = downloads.find(
              (item) => item.id === message.payload.id
            )
            const fallbackPercent = current?.progress.percent ?? 0

            updateDownload(message.payload.id, {
              status: message.payload.status,
              title: message.payload.title ?? current?.title,
              filePath: message.payload.filePath,
              thumbnail: message.payload.thumbnail ?? current?.thumbnail,
              duration: message.payload.duration ?? current?.duration,
              durationText:
                message.payload.durationText ?? current?.durationText,
              source: message.payload.source ?? current?.source,
              directory: message.payload.directory ?? current?.directory,
              progress: {
                percent: message.payload.progress.percent ?? fallbackPercent,
                speed:
                  message.payload.progress.speed ?? current?.progress.speed,
                eta: message.payload.progress.eta ?? current?.progress.eta,
              },
            })
            break
          }
          case 'completed': {
            const completedItem = downloads.find(
              (item) => item.id === message.payload.id
            )
            updateDownload(message.payload.id, {
              status: 'completed',
              filePath: message.payload.filePath,
              title: message.payload.title ?? completedItem?.title,
              directory: message.payload.directory ?? completedItem?.directory,
              durationText: completedItem?.durationText,
              fileSize: message.payload.fileSize,
              progress: { percent: 100 },
            })
            toast.success('下载完成', {
              description:
                message.payload.title ??
                completedItem?.title ??
                '视频已下载完成',
            })
            break
          }
          case 'failed':
            updateDownload(message.payload.id, {
              status: 'failed',
              error: message.payload.error,
            })
            toast.error('下载失败', {
              description: message.payload.error,
            })
            break
          case 'removed':
            removeDownload(message.payload.id)
            break
          default:
            break
        }
      }

      ipcRenderer.on('download:event', handler)
      return () => {
        ipcRenderer.off('download:event', handler)
      }
    },
  }
})
