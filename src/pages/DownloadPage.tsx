import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Download, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import {
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
  const { clipboardUrl, clearClipboardUrl } = useClipboardMonitor(true)

  // 同步 URL 到 store
  useEffect(() => {
    if (url !== currentUrl) {
      setCurrentUrl(url)
    }
  }, [url, currentUrl, setCurrentUrl])

  // 当 store 中的 URL 变化时，更新本地状态
  useEffect(() => {
    if (currentUrl !== url) {
      setUrl(currentUrl)
    }
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
    } catch (error) {
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
  }

  // 计算可用分辨率列表
  const availableResolutions = useMemo(() => {
    if (!videoInfo?.formats || videoInfo.formats.length === 0) return []
    return videoInfo.formats
  }, [videoInfo?.formats])

  // 当切换下载类型时，重置格式选择
  useEffect(() => {
    if (selectedType === 'video') {
      setSelectedVideoFormat('best')
    } else {
      setSelectedAudioFormat('mp3')
    }
  }, [selectedType])

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

      {/* 视频信息卡片 */}
      {videoInfo && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>视频信息</CardTitle>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => {
                  clearVideoInfo()
                  setSelectedType('video') // 重置为默认
                  toast.info('已清除视频信息')
                }}
                title='清除视频信息'>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </CardHeader>
          <CardContent className='overflow-visible'>
            {/* 网格布局：预览图、信息区、操作区（自适应换行） */}
            <div className='grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 items-start'>
              {/* 区域1：视频封面 */}
              {videoInfo.thumbnail && (
                <div className='w-full lg:w-80 flex-shrink-0'>
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title || '视频封面'}
                    className='h-44 w-full rounded-md object-cover'
                    crossOrigin='anonymous'
                    referrerPolicy='no-referrer'
                  />
                </div>
              )}

              {/* 区域2：信息展示 */}
              <div className='space-y-3 min-w-0'>
                <h3 className='text-lg font-semibold line-clamp-2'>
                  {videoInfo.title || '未知标题'}
                </h3>

                {/* 元数据列表 */}
                <div className='space-y-2 text-sm'>
                  {videoInfo.uploader && (
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground'>上传者:</span>
                      <span className='font-medium truncate'>
                        {videoInfo.uploader}
                      </span>
                    </div>
                  )}
                  {videoInfo.durationText && (
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground'>时长:</span>
                      <span className='font-medium'>
                        {videoInfo.durationText}
                      </span>
                    </div>
                  )}
                  {videoInfo.source && (
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground'>来源:</span>
                      <span className='font-medium truncate'>
                        {videoInfo.source}
                      </span>
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
                    <div className='flex items-center gap-2 '>
                      <span className='text-muted-foreground'>上传日期:</span>
                      <span className='font-medium'>
                        {formatUploadDate(videoInfo.uploadDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 区域3：操作区 */}
              <div className='flex flex-col justify-center space-y-4 w-full lg:w-60 lg:self-end lg:justify-self-start'>
                {/* 下载类型切换 */}
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='text-sm font-medium w-20 flex-shrink-0'>
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

                {/* 视频分辨率选择器 */}
                {selectedType === 'video' &&
                  availableResolutions.length > 0 && (
                    <div className='flex items-center gap-2 min-w-0'>
                      <span className='text-sm text-muted-foreground w-20 flex-shrink-0'>
                        分辨率:
                      </span>
                      <Select
                        value={selectedVideoFormat}
                        onValueChange={setSelectedVideoFormat}
                        disabled={isDownloading}>
                        <SelectTrigger className='flex-1 min-w-0'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='best'>最佳质量</SelectItem>
                          {availableResolutions.map((res) => (
                            <SelectItem
                              key={res.format_id}
                              value={res.format_id}>
                              {formatResolution(res.width, res.height)}
                              {res.filesize &&
                                ` (${formatFileSize(res.filesize)})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                {/* 音频格式选择器 */}
                {selectedType === 'audio' && (
                  <div className='flex items-center gap-2 min-w-0'>
                    <span className='text-sm text-muted-foreground w-20 flex-shrink-0'>
                      格式:
                    </span>
                    <Select
                      value={selectedAudioFormat}
                      onValueChange={(value) =>
                        setSelectedAudioFormat(value as 'mp3' | 'm4a')
                      }
                      disabled={isDownloading}>
                      <SelectTrigger className='flex-1 min-w-0'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='mp3'>MP3</SelectItem>
                        <SelectItem value='m4a'>M4A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 下载按钮 */}
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
      )}
    </div>
  )
}
