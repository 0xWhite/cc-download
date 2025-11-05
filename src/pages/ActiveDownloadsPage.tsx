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
  Globe,
  HardDrive,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { Button } from '@/components/ui/button'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import { type DownloadItem } from '@/features/downloads/types'
import { useDownloadsStore } from '@/stores/downloads-store'
import {
  formatFileSize,
  formatDuration,
  formatSource,
  formatDateTime,
} from '@/lib/utils'

function formatProgress(item: DownloadItem, t: TFunction) {
  const basePercent = Number.isFinite(item.progress.percent)
    ? item.progress.percent
    : 0
  const percent = Math.max(0, Math.min(100, Math.round(basePercent)))
  const speed = item.progress.speed ? ` · ${item.progress.speed}` : ''
  const eta = item.progress.eta
    ? ` · ${t('downloads.progress.remaining')} ${item.progress.eta}`
    : ''
  return `${percent}%${speed}${eta}`
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
  const { t } = useTranslation()
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
            <p className='text-lg font-medium text-foreground'>
              {t('downloads.empty')}
            </p>
            <p className='text-sm'>{t('downloads.emptyTip')}</p>
          </div>
        </div>
      </div>
    )
  }

  const hasActive = ordered.some((item) =>
    ['queued', 'downloading', 'processing'].includes(item.status)
  )

  const handleOpenWithPlayer = async (item: DownloadItem) => {
    const targetPath = item.filePath?.trim()

    if (!targetPath) {
      toast.error(t('downloads.errors.fileNotReady'))
      return
    }

    if (typeof window === 'undefined' || !window.ipcRenderer) {
      toast.error(t('downloads.errors.fileNotReady'))
      return
    }

    try {
      await window.ipcRenderer.invoke('app:open-file', targetPath)
    } catch (error) {
      console.error('Failed to open file with default player', error)
      toast.error(t('downloads.errors.cannotOpen'))
    }
  }

  const getStatusIcon = (status: DownloadItem['status']) => {
    const iconClass = 'h-4 w-4'
    switch (status) {
      case 'queued':
        return <Clock className={iconClass} />
      case 'downloading':
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

  const getProgressColors = (item: DownloadItem) => {
    switch (item.status) {
      case 'completed':
        return {
          primary: 'rgb(34, 197, 94)', // emerald-500
          secondary: 'rgba(34, 197, 94, 0.2)',
        }
      case 'downloading':
        return {
          primary: 'rgb(59, 130, 246)', // blue-500
          secondary: 'rgba(59, 130, 246, 0.2)',
        }
      case 'processing':
        return {
          primary: 'rgb(251, 146, 60)', // amber-500
          secondary: 'rgba(251, 146, 60, 0.2)',
        }
      case 'failed':
      case 'canceled':
        return {
          primary: 'rgb(239, 68, 68)', // red-500
          secondary: 'rgba(239, 68, 68, 0.2)',
        }
      default:
        return {
          primary: 'rgb(100, 116, 139)', // slate-500
          secondary: 'rgba(100, 116, 139, 0.2)',
        }
    }
  }

  return (
    <div className='flex h-full flex-col gap-6 overflow-hidden px-8 py-11'>
      <header className='flex items-start justify-between gap-4'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>
            {t('downloads.title')}
          </h1>
          {hasActive ? (
            <p className='text-sm text-muted-foreground'>
              {t('downloads.activeTip')}
            </p>
          ) : (
            <p className='text-sm text-muted-foreground'>
              {t('downloads.inactiveTip')}
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
                  <p>{t('downloads.clearHistoryConfirm')}</p>
                  <p className='text-xs text-muted-foreground'>
                    {t('downloads.clearHistoryTip')}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => toast.dismiss()}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => {
                        toast.dismiss()
                        clearHistory()
                      }}>
                      {t('downloads.confirmClear')}
                    </Button>
                  </div>
                </div>,
                { duration: 10000 }
              )
            }}>
            {t('downloads.clearHistory')}
          </Button>
        )}
      </header>

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('all')}>
          {t('downloads.filters.all')} {counts.all}
        </Button>
        <Button
          variant={filter === 'downloading' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('downloading')}>
          {t('downloads.filters.downloading')} {counts.downloading}
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('completed')}>
          {t('downloads.filters.completed')} {counts.completed}
        </Button>
        <Button
          variant={filter === 'failed' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setFilter('failed')}>
          {t('downloads.filters.failed')} {counts.failed}
        </Button>

        <div className='h-6 w-px bg-border' />

        <Button
          variant={typeFilter === 'all' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setTypeFilter('all')}>
          {t('downloads.filters.allTypes')}
        </Button>
        <Button
          variant={typeFilter === 'video' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setTypeFilter('video')}>
          {t('common.video')} {counts.video}
        </Button>
        <Button
          variant={typeFilter === 'audio' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setTypeFilter('audio')}>
          {t('common.audio')} {counts.audio}
        </Button>
      </div>

      <div className='flex-1 space-y-4 overflow-y-auto pr-2'>
        {filtered.map((item) => (
          <article
            key={item.id}
            className='rounded-lg border bg-card p-4 shadow-sm transition-all duration-200 hover:bg-primary/5 hover:shadow-md'>
            {/* 顶部区域：预览图 + 视频信息 */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
              {/* 预览图 */}
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
                    className={`absolute top-1.5 left-1.5 z-10 inline-flex items-center justify-center rounded-full p-1.5 shadow-lg ring-2 ring-white dark:ring-gray-800 ${
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
                {/* 圆形进度条 - 仅在下载进行中时显示 */}
                {item.status !== 'completed' &&
                  item.status !== 'failed' &&
                  item.status !== 'canceled' && (
                    <div className='absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]'>
                      <AnimatedCircularProgressBar
                        value={Math.max(
                          0,
                          Math.min(100, item.progress.percent || 0)
                        )}
                        max={100}
                        min={0}
                        gaugePrimaryColor={getProgressColors(item).primary}
                        gaugeSecondaryColor={getProgressColors(item).secondary}
                        className='size-20 text-base font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]'
                      />
                    </div>
                  )}
              </div>

              {/* 视频信息 */}
              <div className='flex-1 space-y-2 min-w-0'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div className='min-w-0 flex-1 space-y-1'>
                    {/* 标题 - 可点击打开链接 */}
                    <div className='truncate'>
                      <button
                        type='button'
                        onClick={() => handleOpenWithPlayer(item)}
                        className='block w-full truncate text-left text-base font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground'
                        title={item.title ?? item.url}
                        disabled={!item.filePath}>
                        {item.title ?? '未获取标题'}
                      </button>
                    </div>

                    {/* 来源、时长和文件大小 */}
                    <div className='flex flex-wrap items-center gap-2'>
                      {item.durationText && (
                        <span className='inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30'>
                          <Clock className='h-3 w-3' />
                          {item.durationText ?? formatDuration(item.duration)}
                        </span>
                      )}
                      {item.source && (
                        <span className='inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30'>
                          <Globe className='h-3 w-3' />
                          {formatSource(item.source)}
                        </span>
                      )}
                      {item.fileSize && (
                        <span className='inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30'>
                          <HardDrive className='h-3 w-3' />
                          {formatFileSize(item.fileSize)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${getStatusColor(
                      item.status
                    )}`}>
                    {getStatusIcon(item.status)}
                    <span>{t(`downloads.status.${item.status}`)}</span>
                  </div>
                </div>

                {/* 下载时间和按钮组 */}
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {formatDateTime(item.createdAt)}
                  </span>

                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      title={t('downloads.actions.copyLink')}
                      onClick={() => {
                        navigator.clipboard.writeText(item.url)
                        toast.success(t('download.success.linkCopied'))
                      }}>
                      <Copy className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      title={t('downloads.actions.openFolder')}
                      onClick={async () => {
                        try {
                          await openLocation({
                            filePath: item.filePath,
                            directory: item.directory,
                          })
                        } catch {
                          toast.error(t('downloads.errors.cannotOpenFolder'))
                        }
                      }}>
                      <Folder className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      title={t('downloads.actions.deleteRecord')}
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
              </div>
            </div>

            {/* 底部区域：下载信息相关 */}
            {item.status !== 'completed' && (
              <div className='mt-3 rounded-md border border-dashed bg-muted/30 px-3 py-2'>
                <div className='space-y-1'>
                  {/* 只在下载进行中时显示进度 */}
                  {['queued', 'downloading', 'processing'].includes(
                    item.status
                  ) && (
                    <div className='text-xs text-muted-foreground'>
                      {formatProgress(item, t)}
                    </div>
                  )}
                  {/* 显示错误信息 */}
                  {item.error ? (
                    <p className='text-xs text-destructive'>{item.error}</p>
                  ) : null}
                </div>
              </div>
            )}
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className='flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground'>
            <p>{t('downloads.noResults')}</p>
          </div>
        ) : null}
      </div>
      {deleteTarget ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg'>
            <h3 className='text-lg font-semibold text-foreground'>
              {t('downloads.deleteDialog.title')}
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              {t('downloads.deleteDialog.message')}
            </p>
            {deleteTarget.filePath ? (
              <label className='mt-4 flex items-center gap-2 text-sm text-foreground'>
                <input
                  type='checkbox'
                  checked={deleteAlsoFile}
                  onChange={(event) => setDeleteAlsoFile(event.target.checked)}
                />
                {t('downloads.deleteDialog.alsoDeleteFile')}
              </label>
            ) : (
              <p className='mt-4 text-xs text-muted-foreground'>
                {t('downloads.deleteDialog.noLocalFile')}
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
                {t('common.cancel')}
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
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
