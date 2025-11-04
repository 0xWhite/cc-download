import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettingsStore } from '@/stores/settings-store'
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/lib/i18n'

export function SettingsPage() {
  const { t } = useTranslation()
  const downloadDir = useSettingsStore((state) => state.downloadDir)
  const isLoading = useSettingsStore((state) => state.isLoading)
  const chooseDownloadDir = useSettingsStore((state) => state.chooseDownloadDir)
  const maxConcurrentDownloads = useSettingsStore(
    (state) => state.maxConcurrentDownloads
  )
  const setMaxConcurrentDownloads = useSettingsStore(
    (state) => state.setMaxConcurrentDownloads
  )
  const loadMaxConcurrentDownloads = useSettingsStore(
    (state) => state.loadMaxConcurrentDownloads
  )
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const [value, setValue] = useState(downloadDir ?? '')

  useEffect(() => {
    setValue(downloadDir ?? '')
  }, [downloadDir])

  useEffect(() => {
    void loadMaxConcurrentDownloads()
  }, [loadMaxConcurrentDownloads])

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
        <h1 className='text-3xl font-semibold tracking-tight'>{t('settings.title')}</h1>
        <p className='text-sm text-muted-foreground'>
          {t('settings.description')}
        </p>
      </header>

      <section className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-sm font-medium text-foreground'>
            {t('settings.downloadDir.label')}
          </label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={isLoading ? t('common.loading') : t('common.notSet')}
              disabled={isLoading}
            />
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleChoose}
                disabled={isLoading}>
                {t('common.browse')}
              </Button>
              <Button type='button' onClick={handleSave} disabled={isLoading}>
                {t('common.save')}
              </Button>
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            {t('settings.downloadDir.tip')}
          </p>
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium text-foreground'>
            {t('settings.maxConcurrent.label')}
          </label>
          <div className='w-full sm:w-40'>
            <Select
              value={String(maxConcurrentDownloads)}
              onValueChange={(value) =>
                setMaxConcurrentDownloads(Number.parseInt(value, 10))
              }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, index) => {
                  const count = index + 1
                  return (
                    <SelectItem key={count} value={String(count)}>
                      {count}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <p className='text-xs text-muted-foreground'>
            {t('settings.maxConcurrent.tip')}
          </p>
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium text-foreground'>
            {t('settings.language.label')}
          </label>
          <div className='w-full sm:w-40'>
            <Select
              value={language}
              onValueChange={(value) =>
                setLanguage(value as SupportedLanguage)
              }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {LANGUAGE_NAMES[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className='text-xs text-muted-foreground'>
            {t('settings.language.tip')}
          </p>
        </div>
      </section>
    </div>
  )
}
