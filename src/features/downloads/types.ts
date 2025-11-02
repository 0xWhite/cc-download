export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'canceled'

export type DownloadType = 'video' | 'audio'

export interface DownloadProgress {
  percent: number
  speed?: string
  eta?: string
}

export interface DownloadItem {
  id: string
  url: string
  title?: string
  filePath?: string
  thumbnail?: string
  duration?: number
  durationText?: string
  source?: string
  directory?: string
  downloadType?: DownloadType
  status: DownloadStatus
  progress: DownloadProgress
  error?: string
  createdAt: number
  updatedAt: number
}

export type DownloadEvent =
  | { type: 'queued'; payload: DownloadItem }
  | {
    type: 'progress'
    payload: {
      id: string
      progress: Partial<DownloadProgress>
      status?: DownloadStatus
      title?: string
      filePath?: string
      thumbnail?: string
      duration?: number
      durationText?: string
      source?: string
      directory?: string
    }
  }
  | { type: 'completed'; payload: { id: string; filePath?: string; title?: string; directory?: string } }
  | { type: 'failed'; payload: { id: string; error: string } }
  | { type: 'removed'; payload: { id: string } }
