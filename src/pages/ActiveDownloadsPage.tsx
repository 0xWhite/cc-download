import { useMemo, useState } from 'react'
import {
  Copy,
  Folder,
  Trash2,
  Download,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  ImageIcon,
  Video,
  Music,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { type DownloadItem } from '@/features/downloads/types'
import { useDownloadsStore } from '@/stores/downloads-store'

const statusMap: Record<DownloadItem['status'], string> = {
  queued: '等待中',
  downloading: '下载中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
}

function formatProgress(item: DownloadItem) {
  const basePercent = Number.isFinite(item.progress.percent)
    ? item.progress.percent
    : 0
  const percent = Math.max(0, Math.min(100, Math.round(basePercent)))
  const speed = item.progress.speed ? ` · ${item.progress.speed}` : ''
  const eta = item.progress.eta ? ` · 剩余 ${item.progress.eta}` : ''
  return `${percent}%${speed}${eta}`
}

function formatDurationFromSeconds(seconds?: number) {
  if (!seconds || seconds <= 0) return '未知'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const parts: string[] = []
  if (hours > 0) parts.push(hours.toString())
  parts.push(minutes.toString().padStart(parts.length > 0 ? 2 : 1, '0'))
  parts.push(secs.toString().padStart(2, '0'))
  return parts.join(':')
}

function formatSource(source?: string) {
  if (!source) return '未知'
  const normalized = source.toLowerCase()
  if (normalized.includes('youtube')) return 'YouTube'
  if (normalized.includes('bilibili')) return 'Bilibili'
  if (normalized.startsWith('http')) {
    try {
      const { hostname } = new URL(source)
      return hostname
    } catch (error) {
      console.warn('failed to parse source url', error)
    }
  }
  return source
}

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '大小未知'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function sortDownloads(downloads: DownloadItem[]) {
  const priority: Record<DownloadItem['status'], number> = {
    downloading: 0,
    processing: 1,
    queued: 2,
    failed: 3,
    canceled: 4,
    completed: 5,
  }
  return [...downloads].sort((a, b) => {
    const statusDiff = priority[a.status] - priority[b.status]
    if (statusDiff !== 0) return statusDiff
    return b.createdAt - a.createdAt
  })
}

export function ActiveDownloadsPage() {
  const downloads = useDownloadsStore((state) => state.downloads)
  const openLocation = useDownloadsStore((state) => state.openLocation)
  const deleteDownload = useDownloadsStore((state) => state.deleteDownload)
  const clearHistory = useDownloadsStore((state) => state.clearHistory)
  const [filter, setFilter] = useState<
    'all' | 'downloading' | 'completed' | 'failed'
  >('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'audio'>('all')
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    filePath?: string
    directory?: string
  } | null>(null)
  const [deleteAlsoFile, setDeleteAlsoFile] = useState(false)
  const ordered = useMemo(() => sortDownloads(downloads), [downloads])
  const counts = useMemo(() => {
    const downloadingStatuses: DownloadItem['status'][] = [
      'queued',
      'downloading',
      'processing',
    ]
    const failedStatuses: DownloadItem['status'][] = ['failed', 'canceled']
    return {
      all: downloads.length,
      downloading: downloads.filter((item) =>
        downloadingStatuses.includes(item.status)
      ).length,
      completed: downloads.filter((item) => item.status === 'completed').length,
      failed: downloads.filter((item) => failedStatuses.includes(item.status))
        .length,
      video: downloads.filter((item) => item.downloadType === 'video').length,
      audio: downloads.filter((item) => item.downloadType === 'audio').length,
    }
  }, [downloads])
  const filtered = useMemo(() => {
    let result = ordered

    // 应用状态筛选
    if (filter !== 'all') {
      if (filter === 'downloading') {
        result = result.filter((item) =>
          ['queued', 'downloading', 'processing'].includes(item.status)
        )
      } else if (filter === 'completed') {
        result = result.filter((item) => item.status === 'completed')
      } else if (filter === 'failed') {
        result = result.filter((item) =>
          ['failed', 'canceled'].includes(item.status)
        )
      }
    }

    // 应用类型筛选
    if (typeFilter !== 'all') {
      result = result.filter((item) => item.downloadType === typeFilter)
    }

    return result
  }, [filter, typeFilter, ordered])

  if (downloads.length === 0) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='flex flex-col items-center gap-4 text-muted-foreground'>
          <Download className='h-12 w-12' />
          <div className='space-y-1 text-center'>
            <p className='text-lg font-medium text-foreground'>暂无下载任务</p>
            <p className='text-sm'>
              在"主页"中提交链接后，这里会显示实时进度。
            </p>
          </div>
        </div>
      </div>
    )
  }

  const hasActive = ordered.some((item) =>
    ['queued', 'downloading', 'processing'].includes(item.status)
  )

  const getStatusIcon = (status: DownloadItem['status']) => {
    const iconClass = 'h-4 w-4'
    switch (status) {
      case 'queued':
        return <Clock className={iconClass} />
      case 'downloading':
        return <Download className={iconClass} />
      case 'processing':
        return <Loader2 className={`${iconClass} animate-spin`} />
      case 'completed':
        return <CheckCircle2 className={iconClass} />
      case 'failed':
        return <XCircle className={iconClass} />
      case 'canceled':
        return <Ban className={iconClass} />
    }
  }

  const getStatusColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'queued':
        return 'text-muted-foreground'
      case 'downloading':
        return 'text-blue-600 dark:text-blue-400'
      case 'processing':
        return 'text-amber-600 dark:text-amber-400'
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400'
      case 'failed':
      case 'canceled':
        return 'text-destructive'
    }
  }

  const progressBarClass = (item: DownloadItem) => {
    switch (item.status) {
      case 'completed':
        return 'bg-emerald-500'
      case 'failed':
      case 'canceled':
        return 'bg-destructive'
      case 'processing':
        return 'bg-amber-500'
      default:
        return 'bg-primary'
    }
  }

  return (
    <div className='flex h-full flex-col gap-6 overflow-hidden px-8 py-10'>
      <header className='flex items-start justify-between gap-4'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>下载管理</h1>
          {hasActive ? (
            <p className='text-sm text-muted-foreground'>
              实时查看当前任务的进度。
            </p>
          ) : (
            <p className='text-sm text-muted-foreground'>
              当前没有正在执行的任务，以下为最近的下载状态。
            </p>
          )}
        </div>
        {downloads.length > 0 && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              toast(
                <div className='flex flex-col gap-2'>
                  <p>确定清空所有下载历史记录吗？</p>
                  <p className='text-xs text-muted-foreground'>
                    此操作不会删除已下载的文件，仅清空历史记录。
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => toast.dismiss()}>
                      取消
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => {
                        toast.dismiss()
                        clearHistory()
                      }}>
                      确定清空
                    </Button>
                  </div>
                </div>,
                { duration: 10000 }
              )
            }}>
            清空历史
          </Button>
        )}
      </header>

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('all')}>
          全部 {counts.all}
        </Button>
        <Button
          variant={filter === 'downloading' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('downloading')}>
          正在下载 {counts.downloading}
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('completed')}>
          已下载 {counts.completed}
        </Button>
        <Button
          variant={filter === 'failed' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('failed')}>
          失败 {counts.failed}
        </Button>

        <div className='h-6 w-px bg-border' />

        <Button
          variant={typeFilter === 'all' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setTypeFilter('all')}>
          全部类型
        </Button>
        <Button
          variant={typeFilter === 'video' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setTypeFilter('video')}>
          视频 {counts.video}
        </Button>
        <Button
          variant={typeFilter === 'audio' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setTypeFilter('audio')}>
          音频 {counts.audio}
        </Button>
      </div>

      <div className='flex-1 space-y-4 overflow-y-auto pr-2'>
        {filtered.map((item) => (
          <article
            key={item.id}
            className='rounded-lg border bg-card p-4 shadow-sm transition-all duration-200 hover:bg-primary/5 hover:shadow-md'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <div className='h-24 w-40 flex-shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden relative'>
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title ?? item.url}
                    className='w-full h-full object-cover rounded-md'
                    crossOrigin='anonymous'
                    referrerPolicy='no-referrer'
                  />
                ) : (
                  <ImageIcon className='h-12 w-12 text-muted-foreground/30' />
                )}
                {item.downloadType && (
                  <span
                    className={`absolute top-1.5 left-1.5 inline-flex items-center justify-center rounded-full p-1.5 shadow-lg ring-2 ring-white dark:ring-gray-800 ${
                      item.downloadType === 'audio'
                        ? 'bg-purple-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}>
                    {item.downloadType === 'audio' ? (
                      <Music className='h-3.5 w-3.5' />
                    ) : (
                      <Video className='h-3.5 w-3.5' />
                    )}
                  </span>
                )}
              </div>
              <div className='flex-1 space-y-2'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div className='min-w-0 flex-1 space-y-1'>
                    {/* 标题 - 可点击打开链接 */}
                    <div className='truncate'>
                      <a
                        href={item.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-base font-medium text-foreground hover:text-primary transition-colors cursor-pointer'
                        title={item.title ?? item.url}>
                        {item.title ?? '未获取标题'}
                      </a>
                    </div>

                    {/* 来源、时长和文件大小 */}
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300'>
                        {formatSource(item.source)}
                      </span>
                      <span className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'>
                        {item.durationText ??
                          formatDurationFromSeconds(item.duration)}
                      </span>
                      <span className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'>
                        {formatFileSize(item.fileSize)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${getStatusColor(
                      item.status
                    )}`}>
                    {getStatusIcon(item.status)}
                    <span>{statusMap[item.status]}</span>
                  </div>
                </div>

                {/* 下载时间和按钮组 - 同一行 */}
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {formatDateTime(item.createdAt)}
                  </span>

                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      title='复制视频链接'
                      onClick={() => {
                        navigator.clipboard.writeText(item.url)
                        toast.success('链接已复制到剪贴板')
                      }}>
                      <Copy className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      title='打开所在文件夹'
                      onClick={async () => {
                        try {
                          await openLocation({
                            filePath: item.filePath,
                            directory: item.directory,
                          })
                        } catch (error) {
                          toast.error('无法打开文件夹')
                        }
                      }}>
                      <Folder className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      title='删除记录'
                      onClick={() => {
                        setDeleteTarget({
                          id: item.id,
                          filePath: item.filePath,
                          directory: item.directory,
                        })
                        setDeleteAlsoFile(Boolean(item.filePath))
                      }}>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>

                {item.status === 'completed' ? null : (
                  <div className='space-y-1'>
                    <Progress
                      value={item.progress.percent}
                      indicatorClassName={progressBarClass(item)}
                    />
                    <div className='text-xs text-muted-foreground'>
                      {formatProgress(item)}
                    </div>
                    {item.error ? (
                      <p className='text-xs text-destructive'>{item.error}</p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className='flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground'>
            <p>当前筛选条件下没有记录。</p>
          </div>
        ) : null}
      </div>
      {deleteTarget ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg'>
            <h3 className='text-lg font-semibold text-foreground'>
              删除下载记录
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              请选择是否同时删除本地文件。
            </p>
            {deleteTarget.filePath ? (
              <label className='mt-4 flex items-center gap-2 text-sm text-foreground'>
                <input
                  type='checkbox'
                  checked={deleteAlsoFile}
                  onChange={(event) => setDeleteAlsoFile(event.target.checked)}
                />
                同时删除本地文件
              </label>
            ) : (
              <p className='mt-4 text-xs text-muted-foreground'>
                当前记录没有本地文件可删除。
              </p>
            )}
            <div className='mt-6 flex justify-end gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteAlsoFile(false)
                }}>
                取消
              </Button>
              <Button
                variant='destructive'
                size='sm'
                onClick={async () => {
                  if (!deleteTarget) return
                  await deleteDownload(
                    deleteTarget.id,
                    deleteAlsoFile ? deleteTarget.filePath : undefined
                  )
                  setDeleteTarget(null)
                  setDeleteAlsoFile(false)
                }}>
                删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
