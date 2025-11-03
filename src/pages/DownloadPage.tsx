import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Download, Loader2, X } from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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
        return '仅支持 http/https 链接'
      }
      return null
    } catch (error) {
      console.warn('Invalid url format', error)
      return '请输入合法的链接地址'
    }
  }, [normalizedInput])

  // 剪贴板检测到 URL 时提示用户
  useEffect(() => {
    // 只有在没有 URL 且没有视频信息时才显示剪贴板提示
    if (clipboardUrl && !url && !videoInfo && !isFetchingInfo) {
      toast(
        <div className='flex flex-col gap-2 max-w-md'>
          <p className='text-sm font-medium'>检测到剪贴板中的视频链接</p>
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
              忽略
            </Button>
            <Button
              size='sm'
              onClick={() => {
                setUrl(clipboardUrl)
                clearClipboardUrl()
                toast.dismiss()
              }}>
              使用此链接
            </Button>
          </div>
        </div>,
        { duration: 10000 }
      )
    }
  }, [clipboardUrl, url, videoInfo, isFetchingInfo, clearClipboardUrl])

  // 粘贴按钮处理
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text)
      }
    } catch {
      toast.error('无法读取剪贴板')
    }
  }

  // 获取视频信息
  const handleFetchInfo = async () => {
    if (!normalizedInput) {
      toast.error('请输入视频链接')
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
      toast.success(
        selectedType === 'audio' ? '音频下载已开始' : '视频下载已开始'
      )
      // 跳转到下载管理页，不清空状态
      navigate('/active')
    } catch (error) {
      console.error('Failed to start download', error)
      toast.error('下载失败')
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
      toast.error('请至少选择一个视频')
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
      toast.error('批量下载失败，请稍后重试')
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

  const handleSingleEntryDownload = async (
    entry: VideoInfo,
    index: number
  ) => {
    if (!entry.url) {
      toast.error('无法获取该视频的链接')
      return
    }

    setIsDownloading(true)
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
      toast.success(`已添加视频 ${index + 1} 到下载队列`)
      navigate('/active')
    } catch (error) {
      console.error('Failed to start single entry download', error)
      toast.error('下载失败，请稍后重试')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleClearVideoInfo = () => {
    clearVideoInfo()
    setSelectedType('video')
    setSelectedVideoFormat('best')
    setSelectedAudioFormat('mp3')
    toast.info('已清除视频信息')
  }

  const renderSingleVideoCard = () => {
    if (!videoInfo || videoInfo._type === 'playlist') {
      return null
    }

    return (
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>视频信息</CardTitle>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleClearVideoInfo}
              title='清除视频信息'>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='overflow-visible'>
          <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_1fr_auto]'>
            {videoInfo.thumbnail && (
              <div className='w-full flex-shrink-0 lg:w-80'>
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title || '视频封面'}
                  className='h-44 w-full rounded-md object-cover'
                  crossOrigin='anonymous'
                  referrerPolicy='no-referrer'
                />
              </div>
            )}

            <div className='min-w-0 space-y-3'>
              <h3 className='text-lg font-semibold line-clamp-2'>
                {videoInfo.title || '未知标题'}
              </h3>

              <div className='space-y-2 text-sm'>
                {videoInfo.uploader && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>上传者:</span>
                    <span className='font-medium truncate'>{videoInfo.uploader}</span>
                  </div>
                )}
                {videoInfo.durationText && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>时长:</span>
                    <span className='font-medium'>{videoInfo.durationText}</span>
                  </div>
                )}
                {videoInfo.source && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>来源:</span>
                    <span className='font-medium truncate'>{videoInfo.source}</span>
                  </div>
                )}
                {videoInfo.viewCount !== undefined && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>观看数:</span>
                    <span className='font-medium'>
                      {formatViewCount(videoInfo.viewCount)}
                    </span>
                  </div>
                )}
                {videoInfo.uploadDate && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>上传日期:</span>
                    <span className='font-medium'>
                      {formatUploadDate(videoInfo.uploadDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className='flex w-full flex-col justify-center space-y-4 lg:w-60 lg:self-end lg:justify-self-start'>
              <div className='flex items-center gap-2 min-w-0'>
                <span className='w-20 flex-shrink-0 text-sm font-medium'>
                  {selectedType === 'video' ? '视频' : '仅音频'}
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
                    分辨率:
                  </span>
                  <Select
                    value={selectedVideoFormat}
                    onValueChange={setSelectedVideoFormat}
                    disabled={isDownloading}>
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='best'>最佳质量</SelectItem>
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
                      下载中...
                    </>
                  ) : (
                    <>
                      <Download className='mr-2 h-4 w-4' />
                      下载{selectedType === 'audio' ? '音频' : '视频'}
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
            <CardTitle>合集信息</CardTitle>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleClearVideoInfo}
              title='清除视频信息'>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_1fr_auto]'>
            {videoInfo.thumbnail && (
              <div className='w-full flex-shrink-0 lg:w-80'>
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.playlistTitle || videoInfo.title || '合集封面'}
                  className='h-44 w-full rounded-md object-cover'
                  crossOrigin='anonymous'
                  referrerPolicy='no-referrer'
                />
              </div>
            )}

            <div className='min-w-0 space-y-3'>
              <h3 className='text-lg font-semibold line-clamp-2'>
                {videoInfo.playlistTitle || videoInfo.title || '未命名合集'}
              </h3>
              <div className='space-y-2 text-sm'>
                <div className='flex items-center gap-2'>
                  <span className='text-muted-foreground'>视频数量:</span>
                  <span className='font-medium'>{videoCount}</span>
                </div>
                {videoInfo.modified_date && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>更新时间:</span>
                    <span className='font-medium'>
                      {formatUploadDate(videoInfo.modified_date)}
                    </span>
                  </div>
                )}
                {videoInfo.source && (
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground'>来源:</span>
                    <span className='font-medium truncate'>{videoInfo.source}</span>
                  </div>
                )}
              </div>
            </div>

            <div className='flex w-full flex-col justify-center space-y-4 lg:w-60 lg:self-end lg:justify-self-start'>
              <div className='flex items-center gap-2 min-w-0'>
                <span className='w-20 flex-shrink-0 text-sm font-medium'>
                  {selectedType === 'video' ? '视频' : '仅音频'}
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
                    分辨率:
                  </span>
                  <Select
                    value={selectedVideoFormat}
                    onValueChange={setSelectedVideoFormat}
                    disabled={isDownloading}>
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='best'>最佳质量</SelectItem>
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
                  {allSelected ? '取消全选' : '全选'}
                </Button>
                <Button
                  type='button'
                  onClick={handleBatchDownload}
                  disabled={isDownloading || selectedCount === 0}
                  className='flex-1'>
                  {isDownloading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      处理中...
                    </>
                  ) : (
                    <>批量下载 ({selectedCount})</>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className='flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-sm text-muted-foreground'>
              {selectableCount > 0
                ? `已选 ${selectedCount} / ${selectableCount} 个可下载视频`
                : '该合集中的视频暂时不可下载'}
            </div>
            <Button
              size='sm'
              variant='outline'
              onClick={() => setIsExpanded((prev) => !prev)}
              disabled={playlistEntries.length === 0}>
              {isExpanded ? '收起视频列表' : '展开视频列表'}
            </Button>
          </div>

          {isExpanded && (
            <div className='space-y-3'>
              {playlistEntries.length === 0 ? (
                <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  合集中没有可用的视频内容。
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
                            'w-full border-none bg-background px-4 py-3 text-left shadow-none transition-colors hover:bg-muted/40',
                            isSelected && 'bg-accent/40',
                            !hasUrl && 'cursor-not-allowed opacity-60'
                          )}>
                          <div className='flex w-full items-start gap-3'>
                            <div
                              className='mt-1'
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
                                className='h-24 w-40 rounded-md object-cover'
                                crossOrigin='anonymous'
                                referrerPolicy='no-referrer'
                              />
                            )}
                            <div className='min-w-0 flex-1 space-y-1'>
                              <p className='text-sm font-medium line-clamp-2'>
                                {entry?.title || `视频 ${index + 1}`}
                              </p>
                              <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                                {entry?.uploader && <span>上传者 {entry.uploader}</span>}
                                {entry?.durationText && <span>时长 {entry.durationText}</span>}
                                {entry?.source && <span>来源 {entry.source}</span>}
                                {typeof entry?.viewCount === 'number' && (
                                  <span>观看 {formatViewCount(entry.viewCount)}</span>
                                )}
                                {entry?.uploadDate && (
                                  <span>上传 {formatUploadDate(entry.uploadDate)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className='px-4 pb-4'>
                          <div className='flex flex-col items-start gap-3 border-t pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between'>
                            <span>
                              下载该视频将使用上方统一配置
                              ({selectedType === 'video' ? '视频' : '音频'})
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
                                  处理中...
                                </>
                              ) : (
                                <>
                                  <Download className='mr-2 h-4 w-4' />
                                  下载该视频
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
    <div className='flex min-h-full flex-col gap-6 px-8 py-10'>
      <Card>
        <CardHeader>
          <CardTitle>下载视频</CardTitle>
          <CardDescription>
            输入视频链接，点击获取视频信息，然后选择下载类型并点击下载。
          </CardDescription>
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
              粘贴
            </Button>
            <Button
              onClick={handleFetchInfo}
              disabled={
                !normalizedInput || Boolean(urlError) || isFetchingInfo
              }>
              {isFetchingInfo ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  获取中...
                </>
              ) : (
                '获取视频信息'
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
