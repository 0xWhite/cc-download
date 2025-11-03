import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Download, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useClipboardMonitor } from '@/hooks/use-clipboard-monitor'
import { useDownloadsStore } from '@/stores/downloads-store'

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

  // 开始下载
  const handleDownload = async () => {
    if (!videoInfo) return

    setIsDownloading(true)
    try {
      await startDownload(videoInfo.url, {
        downloadType: selectedType,
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
    <div className='flex h-full flex-col gap-6 px-8 py-10'>
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
          <CardContent>
            <div className='flex gap-4'>
              {/* 视频封面 */}
              {videoInfo.thumbnail && (
                <div className='flex-shrink-0'>
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title || '视频封面'}
                    className='h-32 w-56 rounded-md object-cover'
                    crossOrigin='anonymous'
                    referrerPolicy='no-referrer'
                  />
                </div>
              )}

              {/* 视频详情 */}
              <div className='flex flex-1 flex-col justify-between'>
                <div className='space-y-2'>
                  <h3 className='text-lg font-semibold line-clamp-2'>
                    {videoInfo.title || '未知标题'}
                  </h3>
                  <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
                    {videoInfo.durationText && (
                      <span>时长: {videoInfo.durationText}</span>
                    )}
                    {videoInfo.source && <span>来源: {videoInfo.source}</span>}
                  </div>
                </div>

                {/* 下载类型切换 */}
                <div className='flex items-center gap-2 mt-3'>
                  <span className='text-sm text-muted-foreground'>
                    下载类型：
                  </span>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant={selectedType === 'video' ? 'default' : 'outline'}
                      onClick={() => setSelectedType('video')}
                      disabled={isDownloading}>
                      视频
                    </Button>
                    <Button
                      size='sm'
                      variant={selectedType === 'audio' ? 'default' : 'outline'}
                      onClick={() => setSelectedType('audio')}
                      disabled={isDownloading}>
                      仅音频 (MP3)
                    </Button>
                  </div>
                </div>

                {/* 下载按钮 */}
                <div className='mt-4'>
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className='w-full sm:w-auto'>
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
