import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 导入翻译资源
import zhTranslation from '@/locales/zh/translation.json'
import enTranslation from '@/locales/en/translation.json'
import deTranslation from '@/locales/de/translation.json'
import ruTranslation from '@/locales/ru/translation.json'
import frTranslation from '@/locales/fr/translation.json'
import hiTranslation from '@/locales/hi/translation.json'

// 支持的语言列表
export const SUPPORTED_LANGUAGES = ['zh', 'en', 'de', 'ru', 'fr', 'hi'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// 语言显示名称
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  zh: '简体中文',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
  fr: 'Français',
  hi: 'हिन्दी',
}

// 从系统语言获取支持的语言代码
export function getSystemLanguage(): SupportedLanguage {
  const systemLang = navigator.language.toLowerCase()
  
  // 完全匹配
  if (SUPPORTED_LANGUAGES.includes(systemLang as SupportedLanguage)) {
    return systemLang as SupportedLanguage
  }
  
  // 匹配语言代码前缀（例如 en-US -> en）
  const langPrefix = systemLang.split('-')[0]
  if (SUPPORTED_LANGUAGES.includes(langPrefix as SupportedLanguage)) {
    return langPrefix as SupportedLanguage
  }
  
  // 默认返回英文
  return 'en'
}

// 初始化 i18next
i18n
  .use(initReactI18next) // 绑定 react-i18next
  .init({
    resources: {
      zh: { translation: zhTranslation },
      en: { translation: enTranslation },
      de: { translation: deTranslation },
      ru: { translation: ruTranslation },
      fr: { translation: frTranslation },
      hi: { translation: hiTranslation },
    },
    lng: 'en', // 默认语言（将被 store 覆盖）
    fallbackLng: 'en', // 回退语言
    interpolation: {
      escapeValue: false, // React 已经处理 XSS 问题
    },
    react: {
      useSuspense: false, // 禁用 Suspense 模式
    },
  })

export default i18n

