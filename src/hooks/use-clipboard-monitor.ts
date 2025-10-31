import { useEffect, useState } from 'react'

const VIDEO_URL_PATTERNS = [
  /youtube\.com\/watch\?v=/i,
  /youtu\.be\//i,
  /bilibili\.com\/video\//i,
  /douyin\.com\//i,
  /tiktok\.com\//i,
  /twitter\.com\/.*\/status\//i,
  /x\.com\/.*\/status\//i,
  /instagram\.com\/(p|reel)\//i,
  /vimeo\.com\//i,
  /dailymotion\.com\//i,
]

function isVideoUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      VIDEO_URL_PATTERNS.some((pattern) => pattern.test(text))
    )
  } catch {
    return false
  }
}

export function useClipboardMonitor(enabled: boolean = true) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    const checkClipboard = async () => {
      try {
        // 检查 Clipboard API 是否可用
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return
        }

        const text = await navigator.clipboard.readText()
        const trimmed = text.trim()

        // 如果是新的 URL 且是视频链接，就设置它
        if (trimmed && trimmed !== lastChecked && isVideoUrl(trimmed)) {
          setClipboardUrl(trimmed)
          setLastChecked(trimmed)
        }
      } catch (error) {
        // 静默失败 - 可能是权限问题
        console.debug('Clipboard check failed:', error)
      }
    }

    // 页面可见时立即检查
    if (document.visibilityState === 'visible') {
      checkClipboard()
    }

    // 监听窗口获得焦点
    const handleFocus = () => {
      checkClipboard()
    }

    // 监听可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkClipboard()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, lastChecked])

  const clearClipboardUrl = () => {
    setClipboardUrl(null)
  }

  return { clipboardUrl, clearClipboardUrl }
}
