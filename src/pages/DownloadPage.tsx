import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Download,
  Loader2,
  X,
  Clock,
  Globe,
  Eye,
  Calendar,
  Video,
  User,
} from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useClipboardMonitor } from '@/hooks/use-clipboard-monitor'
import { useDownloadsStore } from '@/stores/downloads-store'
import type { VideoInfo } from '@/stores/downloads-store'
import {
  cn,
  formatViewCount,
  formatUploadDate,
  formatFileSize,
  formatResolution,
} from '@/lib/utils'

export function DownloadPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 使用全局 store 的状态
  const currentUrl = useDownloadsStore((state) => state.currentUrl)
  const videoInfo = useDownloadsStore((state) => state.videoInfo)
  const isFetchingInfo = useDownloadsStore((state) => state.isFetchingInfo)
  const fetchError = useDownloadsStore((state) => state.fetchError)
  const setCurrentUrl = useDownloadsStore((state) => state.setCurrentUrl)
  const fetchVideoInfo = useDownloadsStore((state) => state.fetchVideoInfo)
  const clearVideoInfo = useDownloadsStore((state) => state.clearVideoInfo)
  const startDownload = useDownloadsStore((state) => state.startDownload)

  // 本地 URL 输入状态（用于实时输入）
  const [url, setUrl] = useState(currentUrl)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedType, setSelectedType] = useState<'video' | 'audio'>('video')
  const [selectedVideoFormat, setSelectedVideoFormat] = useState<string>('best')
  const [selectedAudioFormat, setSelectedAudioFormat] = useState<'mp3' | 'm4a'>(
    'mp3'
  )
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [isExpanded, setIsExpanded] = useState(false)
  const { clipboardUrl, clearClipboardUrl } = useClipboardMonitor(true)

  // 同步 URL 到 store
  useEffect(() => {
    if (url !== currentUrl) {
      setCurrentUrl(url)
    }
  }, [url, currentUrl, setCurrentUrl])

  // 当 store 中的 URL 变化时，更新本地输入
  useEffect(() => {
    setUrl(currentUrl)
  }, [currentUrl])

  const normalizeUrl = (value: string) => {
    return value.trim()
  }

  const normalizedInput = normalizeUrl(url)

  const urlError = useMemo(() => {
    if (!normalizedInput) return null
    try {
      const parsed = new URL(normalizedInput)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return t('download.errors.invalidUrl')
      }
      return null
    } catch (error) {
      console.warn('Invalid url format', error)
      return t('download.errors.invalidUrl')
    }
  }, [normalizedInput, t])

  // 剪贴板检测到 URL 时提示用户
  useEffect(() => {
    // 只有在没有 URL 且没有视频信息时才显示剪贴板提示
    if (clipboardUrl && !url && !videoInfo && !isFetchingInfo) {
      toast(
        <div className='flex flex-col gap-2 max-w-md'>
          <p className='text-sm font-medium'>
            {t('download.clipboardDetected')}
          </p>
          <p className='text-xs text-muted-foreground break-all line-clamp-2'>
            {clipboardUrl}
          </p>
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                clearClipboardUrl()
                toast.dismiss()
              }}>
              {t('download.clipboardIgnore')}
            </Button>
            <Button
              size='sm'
              onClick={() => {
                setUrl(clipboardUrl)
                clearClipboardUrl()
                toast.dismiss()
              }}>
              {t('download.clipboardUse')}
            </Button>
          </div>
        </div>,
        { duration: 10000 }
      )
    }
  }, [clipboardUrl, url, videoInfo, isFetchingInfo, clearClipboardUrl, t])

  // 粘贴按钮处理
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text)
      }
    } catch {
      toast.error(t('download.errors.fetchFailed'))
    }
  }

  // 获取视频信息
  const handleFetchInfo = async () => {
    if (!normalizedInput) {
      toast.error(t('download.errors.noUrl'))
      return
    }

    if (urlError) {
      toast.error(urlError)
      return
    }

    // 调用 store 方法，它会在后台运行并持久化状态
    await fetchVideoInfo(normalizedInput)
    setSelectedType('video') // 重置为默认
    setSelectedVideoFormat('best')
    setSelectedAudioFormat('mp3')
  }

  const handleOpenExternal = useCallback(
    async (targetUrl?: string) => {
      const trimmed = targetUrl?.trim()
      if (!trimmed) {
        toast.error(t('download.errors.noUrl'))
        return
      }

      if (typeof window !== 'undefined' && window.ipcRenderer) {
        try {
          await window.ipcRenderer.invoke('app:open-external', trimmed)
          return
        } catch (error) {
          console.error('Failed to open external url', error)
          toast.error(t('download.errors.downloadFailed'))
          return
        }
      }

      try {
        window.open(trimmed, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('Failed to open url in fallback window', error)
        toast.error(t('download.errors.downloadFailed'))
      }
    },
    [t]
  )

  // 计算可用分辨率列表
  const availableResolutions = useMemo(() => {
    if (!videoInfo) return []
    if (videoInfo._type === 'playlist') {
      const firstWithFormats = videoInfo.entries?.find(
        (entry) => entry.formats && entry.formats.length > 0
      )
      return firstWithFormats?.formats ?? videoInfo.formats ?? []
    }
    if (!videoInfo.formats || videoInfo.formats.length === 0) return []
    return videoInfo.formats
  }, [videoInfo])

  const playlistEntries = useMemo(() => {
    if (videoInfo?._type === 'playlist' && Array.isArray(videoInfo.entries)) {
      return videoInfo.entries
    }
    return []
  }, [videoInfo])

  // 当切换下载类型时，重置格式选择
  useEffect(() => {
    if (selectedType === 'video') {
      setSelectedVideoFormat('best')
    } else {
      setSelectedAudioFormat('mp3')
    }
  }, [selectedType])

  useEffect(() => {
    setSelectedVideos(new Set())
    setIsExpanded(false)
  }, [videoInfo?.url])

  // 开始下载
  const handleDownload = async () => {
    if (!videoInfo) return

    setIsDownloading(true)
    try {
      await startDownload(videoInfo.url, {
        downloadType: selectedType,
        videoFormat: selectedType === 'video' ? selectedVideoFormat : undefined,
        audioFormat: selectedType === 'audio' ? selectedAudioFormat : undefined,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        durationText: videoInfo.durationText,
        source: videoInfo.source,
      })
      toast.success(t('download.success.downloadStarted'))
      // 跳转到下载管理页，不清空状态
      navigate('/active')
    } catch (error) {
      console.error('Failed to start download', error)
      toast.error(t('download.errors.downloadFailed'))
    } finally {
      setIsDownloading(false)
    }
  }

  const handleToggleVideo = (index: number) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (playlistEntries.length === 0) {
      return
    }

    const selectableIndices = playlistEntries
      .map((entry, index) => (entry?.url ? index : null))
      .filter((index): index is number => index !== null)

    if (selectableIndices.length === 0) {
      setSelectedVideos(new Set())
      return
    }

    setSelectedVideos((prev) => {
      if (prev.size === selectableIndices.length) {
        return new Set()
      }
      return new Set(selectableIndices)
    })
  }

  const handleBatchDownload = async () => {
    if (!videoInfo || videoInfo._type !== 'playlist') {
      return
    }

    if (selectedVideos.size === 0) {
      toast.error(t('download.errors.noVideoInfo'))
      return
    }

    const indices = Array.from(selectedVideos)
    const count = indices.length
    const failedEntries: string[] = []
    setIsDownloading(true)

    try {
      for (const index of indices) {
        const entry = videoInfo.entries?.[index]
        if (!entry?.url) {
          failedEntries.push(`视频 ${index + 1}`)
          continue
        }
        try {
          await startDownload(entry.url, {
            downloadType: selectedType,
            videoFormat:
              selectedType === 'video' ? selectedVideoFormat : undefined,
            audioFormat:
              selectedType === 'audio' ? selectedAudioFormat : undefined,
            title: entry.title,
            thumbnail: entry.thumbnail,
            duration: entry.duration,
            durationText: entry.durationText,
            source: entry.source,
          })
        } catch (error) {
          console.error('Failed to start playlist entry download', error)
          failedEntries.push(entry.title ?? entry.url ?? `视频 ${index + 1}`)
        }
      }
    } finally {
      setIsDownloading(false)
    }

    if (failedEntries.length === count) {
      toast.error(t('download.errors.downloadFailed'))
      return
    }

    const successCount = count - failedEntries.length
    setSelectedVideos(new Set())

    if (successCount > 0) {
      toast.success(`已添加 ${successCount} 个视频到下载队列`)
      navigate('/active')
    }

    if (failedEntries.length > 0) {
      toast.error(`以下视频添加失败: ${failedEntries.join('、')}`)
    }
  }

  const handleSingleEntryDownload = async (entry: VideoInfo, index: number) => {
    if (!entry.url) {
      toast.error(t('download.errors.fetchFailed'))
      return
    }

    setIsDownloading(true)
    try {
      await startDownload(entry.url, {
        downloadType: selectedType,
        videoFormat: selectedType === 'video' ? selectedVideoFormat : undefined,
        audioFormat: selectedType === 'audio' ? selectedAudioFormat : undefined,
        title: entry.title,
        thumbnail: entry.thumbnail,
        duration: entry.duration,
        durationText: entry.durationText,
        source: entry.source,
      })
      toast.success(`已添加视频 ${index + 1} 到下载队列`)
      navigate('/active')
    } catch (error) {
      console.error('Failed to start single entry download', error)
      toast.error(t('download.errors.downloadFailed'))
    } finally {
      setIsDownloading(false)
    }
  }

  const handleClearVideoInfo = () => {
    clearVideoInfo()
    setSelectedType('video')
    setSelectedVideoFormat('best')
    setSelectedAudioFormat('mp3')
    toast.info(t('download.success.downloadStarted'))
  }

  const renderSingleVideoCard = () => {
    if (!videoInfo || videoInfo._type === 'playlist') {
      return null
    }

    return (
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>{t('download.videoInfo')}</CardTitle>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleClearVideoInfo}
              title={t('common.close')}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='overflow-visible'>
          <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_1fr_auto]'>
            {videoInfo.thumbnail && (
              <div className='w-full flex-shrink-0 lg:w-52'>
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title || t('common.video')}
                  className='h-36 w-full rounded-md object-cover'
                  crossOrigin='anonymous'
                  referrerPolicy='no-referrer'
                />
              </div>
            )}

            <div className='min-w-0 space-y-3'>
              <button
                type='button'
                onClick={() => handleOpenExternal(videoInfo.url)}
                className='group line-clamp-2 text-left text-lg font-semibold text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground'
                disabled={!videoInfo.url}>
                <span className='group-hover:underline'>
                  {videoInfo.title || t('download.title')}
                </span>
              </button>

              <div className='flex flex-wrap gap-2'>
                {videoInfo.uploader && (
                  <span className='inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/30'>
                    <User className='h-3 w-3' />
                    {videoInfo.uploader}
                  </span>
                )}
                {videoInfo.durationText && (
                  <span className='inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30'>
                    <Clock className='h-3 w-3' />
                    {videoInfo.durationText}
                  </span>
                )}
                {videoInfo.source && (
                  <span className='inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30'>
                    <Globe className='h-3 w-3' />
                    {videoInfo.source}
                  </span>
                )}
                {videoInfo.viewCount !== undefined && (
                  <span className='inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/30'>
                    <Eye className='h-3 w-3' />
                    {formatViewCount(videoInfo.viewCount)}
                  </span>
                )}
                {videoInfo.uploadDate && (
                  <span className='inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20'>
                    <Calendar className='h-3 w-3' />
                    {formatUploadDate(videoInfo.uploadDate)}
                  </span>
                )}
              </div>
            </div>

            <div className='flex w-full flex-col justify-center space-y-4 lg:w-80 lg:self-end lg:justify-self-start'>
              <div className='flex items-center gap-2 min-w-0'>
                <span className='w-20 flex-shrink-0 text-sm font-medium'>
                  {selectedType === 'video'
                    ? t('common.video')
                    : t('download.audioOnly')}
                </span>
                <Switch
                  checked={selectedType === 'audio'}
                  onCheckedChange={(checked) =>
                    setSelectedType(checked ? 'audio' : 'video')
                  }
                  disabled={isDownloading}
                />
              </div>

              {selectedType === 'video' && availableResolutions.length > 0 && (
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-20 flex-shrink-0 text-sm text-muted-foreground'>
                    {t('download.resolution')}:
                  </span>
                  <Select
                    value={selectedVideoFormat}
                    onValueChange={setSelectedVideoFormat}
                    disabled={isDownloading}>
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='best'>
                        {t('download.bestQuality')}
                      </SelectItem>
                      {availableResolutions.map((res) => (
                        <SelectItem key={res.format_id} value={res.format_id}>
                          {formatResolution(res.width, res.height)}
                          {res.filesize && ` (${formatFileSize(res.filesize)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedType === 'audio' && (
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-20 flex-shrink-0 text-sm text-muted-foreground'>
                    格式:
                  </span>
                  <Select
                    value={selectedAudioFormat}
                    onValueChange={(value) =>
                      setSelectedAudioFormat(value as 'mp3' | 'm4a')
                    }
                    disabled={isDownloading}>
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='mp3'>MP3</SelectItem>
                      <SelectItem value='m4a'>M4A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className='pt-2'>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className='w-full'>
                  {isDownloading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      {t('download.downloading')}
                    </>
                  ) : (
                    <>
                      <Download className='mr-2 h-4 w-4' />
                      {t('download.startDownload')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderPlaylistCard = () => {
    if (!videoInfo || videoInfo._type !== 'playlist') {
      return null
    }

    const selectableCount = playlistEntries.filter((entry) => entry?.url).length
    const allSelected =
      selectableCount > 0 && selectedVideos.size === selectableCount
    const selectedCount = selectedVideos.size
    const videoCount = videoInfo.playlistCount ?? playlistEntries.length
    const disableActions = isDownloading || selectableCount === 0

    return (
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>{t('download.playlistInfo')}</CardTitle>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleClearVideoInfo}
              title={t('common.close')}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_1fr_auto]'>
            {videoInfo.thumbnail && (
              <div className='w-full flex-shrink-0 lg:w-52'>
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.playlistTitle || videoInfo.title || '合集封面'}
                  className='h-36 w-full rounded-md object-cover'
                  crossOrigin='anonymous'
                  referrerPolicy='no-referrer'
                />
              </div>
            )}

            <div className='min-w-0 space-y-3'>
              <button
                type='button'
                onClick={() => handleOpenExternal(videoInfo.url)}
                className='group line-clamp-2 text-left text-lg font-semibold text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground'
                disabled={!videoInfo.url}>
                <span className='group-hover:underline'>
                  {videoInfo.playlistTitle || videoInfo.title || '未命名合集'}
                </span>
              </button>
              <div className='flex flex-wrap gap-2'>
                {videoInfo.uploader && (
                  <span className='inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/30'>
                    <User className='h-3 w-3' />
                    {videoInfo.uploader}
                  </span>
                )}
                <span className='inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30'>
                  <Video className='h-3 w-3' />
                  {videoCount}
                </span>
                <span className='inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20'>
                  <Calendar className='h-3 w-3' />
                  {videoInfo.uploadDate
                    ? formatUploadDate(videoInfo.uploadDate)
                    : videoInfo.modified_date
                    ? formatUploadDate(videoInfo.modified_date)
                    : '未知'}
                </span>
              </div>
            </div>

            <div className='flex w-full flex-col justify-center space-y-4 lg:w-90 lg:self-end lg:justify-self-start'>
              <div className='flex items-center gap-2 min-w-0'>
                <span className='w-20 flex-shrink-0 text-sm font-medium'>
                  {selectedType === 'video'
                    ? t('common.video')
                    : t('download.audioOnly')}
                </span>
                <Switch
                  checked={selectedType === 'audio'}
                  onCheckedChange={(checked) =>
                    setSelectedType(checked ? 'audio' : 'video')
                  }
                  disabled={isDownloading}
                />
              </div>

              {selectedType === 'video' && availableResolutions.length > 0 && (
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-20 flex-shrink-0 text-sm text-muted-foreground'>
                    {t('download.resolution')}:
                  </span>
                  <Select
                    value={selectedVideoFormat}
                    onValueChange={setSelectedVideoFormat}
                    disabled={isDownloading}>
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='best'>
                        {t('download.bestQuality')}
                      </SelectItem>
                      {availableResolutions.map((res) => (
                        <SelectItem key={res.format_id} value={res.format_id}>
                          {formatResolution(res.width, res.height)}
                          {res.filesize && ` (${formatFileSize(res.filesize)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedType === 'audio' && (
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-20 flex-shrink-0 text-sm text-muted-foreground'>
                    格式:
                  </span>
                  <Select
                    value={selectedAudioFormat}
                    onValueChange={(value) =>
                      setSelectedAudioFormat(value as 'mp3' | 'm4a')
                    }
                    disabled={isDownloading}>
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='mp3'>MP3</SelectItem>
                      <SelectItem value='m4a'>M4A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className='flex flex-col gap-2 pt-2 sm:flex-row'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleSelectAll}
                  disabled={disableActions}
                  className='flex-1'>
                  {allSelected
                    ? t('download.selectAll')
                    : t('download.selectAll')}
                </Button>
                <Button
                  type='button'
                  onClick={handleBatchDownload}
                  disabled={isDownloading || selectedCount === 0}
                  className='flex-1'>
                  {isDownloading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      {t('download.downloading')}
                    </>
                  ) : (
                    <>
                      {t('download.startBatchDownload', {
                        type:
                          selectedType === 'video'
                            ? t('common.video')
                            : t('common.audio'),
                      })}{' '}
                      ({selectedCount})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className='flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-sm text-muted-foreground'>
              {selectableCount > 0
                ? t('download.selectedCount', {
                    selected: `${selectedCount} / ${selectableCount}`,
                  })
                : t('download.noVideoInfo')}
            </div>
            <Button
              size='sm'
              variant='outline'
              onClick={() => setIsExpanded((prev) => !prev)}
              disabled={playlistEntries.length === 0}>
              {isExpanded ? t('download.clearAll') : t('download.selectVideos')}
            </Button>
          </div>

          {isExpanded && (
            <div className='space-y-3'>
              {playlistEntries.length === 0 ? (
                <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  {t('download.noVideoInfo')}
                </div>
              ) : (
                <Accordion type='multiple' className='space-y-2'>
                  {playlistEntries.map((entry, index) => {
                    const isSelected = selectedVideos.has(index)
                    const hasUrl = Boolean(entry?.url)
                    const key = entry?.url ?? `${index}`
                    return (
                      <AccordionItem
                        key={key}
                        value={`entry-${index}`}
                        className='overflow-hidden rounded-md border'>
                        <AccordionTrigger
                          disabled={isDownloading}
                          className={cn(
                            'w-full border-none bg-background px-4 py-3 text-left shadow-none hover:no-underline transition-all duration-200 hover:bg-primary/10',
                            isSelected && 'bg-accent/40',
                            !hasUrl && 'cursor-not-allowed opacity-60'
                          )}>
                          <div className='flex w-full items-center gap-3'>
                            <div
                              className='flex items-center'
                              onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                disabled={!hasUrl || isDownloading}
                                onCheckedChange={() => handleToggleVideo(index)}
                              />
                            </div>
                            {entry?.thumbnail && (
                              <img
                                src={entry.thumbnail}
                                alt={entry.title || `视频 ${index + 1}`}
                                className='h-20 w-28 flex-shrink-0 rounded-md object-cover'
                                crossOrigin='anonymous'
                                referrerPolicy='no-referrer'
                              />
                            )}
                            <div className='min-w-0 flex-1 space-y-1.5'>
                              <button
                                type='button'
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleOpenExternal(entry?.url)
                                }}
                                className='group line-clamp-2 text-left text-sm font-medium text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground'
                                disabled={!entry?.url}>
                                <span className='group-hover:underline'>
                                  {entry?.title || `视频 ${index + 1}`}
                                </span>
                              </button>
                              <div className='flex flex-wrap gap-1.5'>
                                {entry?.durationText && (
                                  <span className='inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30'>
                                    <Clock className='h-3 w-3' />
                                    {entry.durationText}
                                  </span>
                                )}
                                {entry?.source && (
                                  <span className='inline-flex items-center gap-1 rounded-md bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30'>
                                    <Globe className='h-3 w-3' />
                                    {entry.source}
                                  </span>
                                )}
                                {typeof entry?.viewCount === 'number' && (
                                  <span className='inline-flex items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/30'>
                                    <Eye className='h-3 w-3' />
                                    {formatViewCount(entry.viewCount)}
                                  </span>
                                )}
                                {entry?.uploadDate && (
                                  <span className='inline-flex items-center gap-1 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20'>
                                    <Calendar className='h-3 w-3' />
                                    {formatUploadDate(entry.uploadDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className='px-4 pb-4'>
                          <div className='flex flex-col items-start gap-3 border-t pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between'>
                            <span>
                              {t('download.willUseAboveConfig', {
                                type:
                                  selectedType === 'video'
                                    ? t('common.video')
                                    : t('common.audio'),
                              })}
                            </span>
                            <Button
                              size='sm'
                              type='button'
                              onClick={() =>
                                entry && handleSingleEntryDownload(entry, index)
                              }
                              disabled={isDownloading || !hasUrl}>
                              {isDownloading ? (
                                <>
                                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                  {t('download.downloading')}
                                </>
                              ) : (
                                <>
                                  <Download className='mr-2 h-4 w-4' />
                                  {t('download.downloadThisItem', {
                                    type:
                                      selectedType === 'video'
                                        ? t('common.video')
                                        : t('common.audio'),
                                  })}
                                </>
                              )}
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='flex min-h-full flex-col gap-6 px-8 py-11'>
      <Card>
        <CardHeader>
          <CardTitle>{t('download.pageTitle')}</CardTitle>
          <CardDescription>{t('download.pageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex gap-2'>
            <Input
              placeholder='https://'
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={isFetchingInfo}
              autoComplete='off'
              autoCorrect='off'
              spellCheck={false}
            />
            <Button
              variant='outline'
              onClick={handlePaste}
              disabled={isFetchingInfo}>
              {t('download.clipboardUse')}
            </Button>
            <Button
              onClick={handleFetchInfo}
              disabled={
                !normalizedInput || Boolean(urlError) || isFetchingInfo
              }>
              {isFetchingInfo ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {t('download.fetching')}
                </>
              ) : (
                t('download.fetchInfo')
              )}
            </Button>
          </div>
          {urlError && (
            <p className='mt-2 text-xs text-destructive'>{urlError}</p>
          )}
          {fetchError && !urlError && (
            <p className='mt-2 text-xs text-destructive'>❌ {fetchError}</p>
          )}
        </CardContent>
      </Card>

      {videoInfo &&
        (videoInfo._type === 'playlist'
          ? renderPlaylistCard()
          : renderSingleVideoCard())}
    </div>
  )
}
