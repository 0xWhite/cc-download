import { Home, ListChecks, Settings2 } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { I18nextProvider, useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TitleBar } from '@/components/TitleBar'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ActiveDownloadsPage } from '@/pages/ActiveDownloadsPage'
import { DownloadPage } from '@/pages/DownloadPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useDownloadsStore } from '@/stores/downloads-store'
import { useSettingsStore } from '@/stores/settings-store'
import i18n from '@/lib/i18n'
import logoImg from '/logo.png'

const navigation = [
  { name: 'nav.home' as const, path: '/download', icon: Home },
  { name: 'nav.downloads' as const, path: '/active', icon: ListChecks },
]

const isMac = navigator.userAgent.includes('Mac')

function Sidebar() {
  const { t } = useTranslation()
  return (
    <aside className='flex h-full w-50 flex-col border-r bg-background/80'>
      <div
        className={`flex items-center gap-3 border-b px-6 ${
          isMac ? 'pt-12 pb-5' : 'py-5'
        }`}>
        <img
          src={logoImg}
          alt='Logo'
          className='h-10 w-10 rounded-lg object-cover'
        />
        <div>
          <p className='text-lg font-semibold tracking-tight'>
            {t('app.name')}
          </p>
          <p className='text-xs text-muted-foreground'>
            {t('app.description')}
          </p>
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
              <span>{t(item.name)}</span>
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
              {t('nav.settings')}
            </Button>
          )}
        </NavLink>
      </div>
    </aside>
  )
}

function AppContent() {
  const loadDownloadDir = useSettingsStore((state) => state.loadDownloadDir)
  const loadLanguage = useSettingsStore((state) => state.loadLanguage)
  const loadHistory = useDownloadsStore((state) => state.loadHistory)
  const setupEventListener = useDownloadsStore(
    (state) => state.setupEventListener
  )

  useEffect(() => {
    // 初始化设置和历史记录
    loadLanguage()
    loadDownloadDir()
    loadHistory()
  }, [loadLanguage, loadDownloadDir, loadHistory])

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
              <main className='flex-1 overflow-auto'>
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
              <main className='flex-1 overflow-auto'>
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
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </I18nextProvider>
  )
}
