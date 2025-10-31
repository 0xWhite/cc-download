import { Minus, Square, X, Copy, Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

// 检测平台
const isMac = navigator.userAgent.includes('Mac')

// Windows 风格的按钮组件
function WindowsControls() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronWindow) {
        const maximized = await window.electronWindow.isMaximized()
        setIsMaximized(maximized)
      }
    }
    checkMaximized()
  }, [])

  const handleMinimize = () => {
    window.electronWindow?.minimize()
  }

  const handleMaximize = async () => {
    if (window.electronWindow) {
      await window.electronWindow.maximize()
      const maximized = await window.electronWindow.isMaximized()
      setIsMaximized(maximized)
    }
  }

  const handleClose = () => {
    window.electronWindow?.close()
  }

  return (
    <div
      className='flex h-full'
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={handleMinimize}
        className='flex h-full w-12 items-center justify-center hover:bg-muted/70 transition-colors group'
        aria-label='最小化'>
        <Minus className='h-3 w-3 text-muted-foreground group-hover:text-foreground' />
      </button>
      <button
        onClick={handleMaximize}
        className='flex h-full w-12 items-center justify-center hover:bg-muted/70 transition-colors group'
        aria-label={isMaximized ? '还原' : '最大化'}>
        {isMaximized ? (
          <Copy className='h-3 w-3 text-muted-foreground group-hover:text-foreground' />
        ) : (
          <Square className='h-3 w-3 text-muted-foreground group-hover:text-foreground' />
        )}
      </button>
      <button
        onClick={handleClose}
        className='flex h-full w-12 items-center justify-center hover:bg-red-500 transition-colors group'
        aria-label='关闭'>
        <X className='h-3.5 w-3.5 text-muted-foreground group-hover:text-white' />
      </button>
    </div>
  )
}

export function TitleBar() {
  const { actualTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(actualTheme === 'dark' ? 'light' : 'dark')
  }

  // macOS: 更原生的效果，完全透明无边框
  // Windows: 保持现有的样式
  if (isMac) {
    return (
      <div
        className='flex h-12 items-center justify-between select-none'
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {/* 占位，给原生按钮留空间 */}
        <div className='flex-1' />

        {/* 主题切换按钮 */}
        <button
          onClick={toggleTheme}
          className='mr-4 flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/70 transition-colors'
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          aria-label='切换主题'>
          {actualTheme === 'dark' ? (
            <Sun className='h-4 w-4 text-muted-foreground' />
          ) : (
            <Moon className='h-4 w-4 text-muted-foreground' />
          )}
        </button>
      </div>
    )
  }

  // Windows 风格
  return (
    <div
      className='flex h-10 items-center justify-between bg-background/95 border-b select-none'
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* 左侧：应用名称 */}
      <div className='flex items-center pl-4'>
        <span className='text-xs font-medium text-muted-foreground'>
          Creative Clip Downloader
        </span>
      </div>

      {/* 右侧：主题切换 + Windows 控制按钮 */}
      <div className='flex h-full items-center'>
        <button
          onClick={toggleTheme}
          className='flex h-full w-10 items-center justify-center hover:bg-muted/70 transition-colors'
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          aria-label='切换主题'>
          {actualTheme === 'dark' ? (
            <Sun className='h-4 w-4 text-muted-foreground' />
          ) : (
            <Moon className='h-4 w-4 text-muted-foreground' />
          )}
        </button>
        <WindowsControls />
      </div>
    </div>
  )
}
