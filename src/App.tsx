import { Home, ListChecks, Settings2 } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TitleBar } from '@/components/TitleBar'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ActiveDownloadsPage } from '@/pages/ActiveDownloadsPage'
import { DownloadPage } from '@/pages/DownloadPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useDownloadsStore } from '@/stores/downloads-store'
import { useSettingsStore } from '@/stores/settings-store'

const navigation = [
  { name: '主页', path: '/download', icon: Home },
  { name: '下载管理', path: '/active', icon: ListChecks },
]

const isMac = navigator.userAgent.includes('Mac')

function Sidebar() {
  return (
    <aside className='flex h-full w-50 flex-col border-r bg-background/80'>
      <div
        className={`flex items-center gap-3 border-b px-6 ${
          isMac ? 'pt-12 pb-5' : 'py-5'
        }`}>
        <img
          src='/logo.png'
          alt='Logo'
          className='h-10 w-10 rounded-lg object-cover'
        />
        <div>
          <p className='text-lg font-semibold tracking-tight'>CCD</p>
          <p className='text-xs text-muted-foreground'>video download</p>
        </div>
      </div>

      <nav className='flex-1 space-y-1 px-3 py-4'>
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`
              }>
              <Icon className='h-4 w-4' />
              <span>{item.name}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className='border-t px-3 py-4'>
        <NavLink to='/settings'>
          {({ isActive }) => (
            <Button
              variant='ghost'
              className={`w-full justify-start gap-3 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground'
              }`}>
              <Settings2 className='h-4 w-4' />
              设置
            </Button>
          )}
        </NavLink>
      </div>
    </aside>
  )
}

function AppContent() {
  const loadDownloadDir = useSettingsStore((state) => state.loadDownloadDir)
  const loadHistory = useDownloadsStore((state) => state.loadHistory)
  const setupEventListener = useDownloadsStore(
    (state) => state.setupEventListener
  )

  useEffect(() => {
    // 初始化设置和历史记录
    loadDownloadDir()
    loadHistory()
  }, [loadDownloadDir, loadHistory])

  useEffect(() => {
    // 设置下载事件监听器
    const cleanup = setupEventListener()
    return cleanup
  }, [setupEventListener])

  return (
    <>
      <div className='relative flex h-screen flex-col bg-muted/20 text-foreground'>
        {/* macOS: 标题栏绝对定位，浮在内容上方；Windows: 正常流布局 */}
        {isMac ? (
          <>
            <div className='absolute top-0 left-0 right-0 z-50'>
              <TitleBar />
            </div>
            <div className='flex h-full overflow-hidden'>
              <Sidebar />
              <main className='flex-1 overflow-hidden'>
                <Routes>
                  <Route path='/download' element={<DownloadPage />} />
                  <Route path='/active' element={<ActiveDownloadsPage />} />
                  <Route path='/settings' element={<SettingsPage />} />
                  <Route
                    path='/'
                    element={<Navigate to='/download' replace />}
                  />
                  <Route
                    path='*'
                    element={<Navigate to='/download' replace />}
                  />
                </Routes>
              </main>
            </div>
          </>
        ) : (
          <>
            <TitleBar />
            <div className='flex flex-1 overflow-hidden'>
              <Sidebar />
              <main className='flex-1 overflow-hidden'>
                <Routes>
                  <Route path='/download' element={<DownloadPage />} />
                  <Route path='/active' element={<ActiveDownloadsPage />} />
                  <Route path='/settings' element={<SettingsPage />} />
                  <Route
                    path='/'
                    element={<Navigate to='/download' replace />}
                  />
                  <Route
                    path='*'
                    element={<Navigate to='/download' replace />}
                  />
                </Routes>
              </main>
            </div>
          </>
        )}
      </div>
      <Toaster />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
