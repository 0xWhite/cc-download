import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettingsStore } from '@/stores/settings-store'

export function SettingsPage() {
  const downloadDir = useSettingsStore((state) => state.downloadDir)
  const isLoading = useSettingsStore((state) => state.isLoading)
  const chooseDownloadDir = useSettingsStore((state) => state.chooseDownloadDir)
  const [value, setValue] = useState(downloadDir ?? '')

  useEffect(() => {
    setValue(downloadDir ?? '')
  }, [downloadDir])

  const handleChoose = async () => {
    const dir = await chooseDownloadDir()
    if (dir) {
      setValue(dir)
    }
  }

  const handleSave = async () => {
    const trimmed = value.trim() ? value.trim() : null
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      const next = await window.ipcRenderer.invoke(
        'settings:set-download-dir',
        trimmed
      )
      useSettingsStore.getState().setDownloadDir(next)
    } else {
      useSettingsStore.getState().setDownloadDir(trimmed)
    }
  }

  return (
    <div className='flex h-full flex-col gap-8 px-8 py-10'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-semibold tracking-tight'>设置</h1>
        <p className='text-sm text-muted-foreground'>
          管理默认下载目录等选项。
        </p>
      </header>

      <section className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-sm font-medium text-foreground'>
            默认下载目录
          </label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={isLoading ? '加载中…' : '未设置'}
              disabled={isLoading}
            />
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleChoose}
                disabled={isLoading}>
                浏览…
              </Button>
              <Button type='button' onClick={handleSave} disabled={isLoading}>
                保存
              </Button>
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            当你从“下载”页面发起下载时，文件将保存到该目录下，如未设置会要求先选择。
          </p>
        </div>
      </section>
    </div>
  )
}
