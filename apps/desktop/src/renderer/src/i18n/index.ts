import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const STORAGE_KEY = 'media_parser_locale'

export const supportedLocales = ['zh-CN', 'en-US'] as const
type SupportedLocale = (typeof supportedLocales)[number]

const normalizeLocale = (value?: string | null): SupportedLocale => {
  if (supportedLocales.includes(value as SupportedLocale)) return value as SupportedLocale
  const shortLocale = value?.split('-')[0]
  if (shortLocale === 'en') return 'en-US'
  return 'zh-CN'
}

const getInitialLocale = () => {
  const savedLocale = localStorage.getItem(STORAGE_KEY)
  if (savedLocale) return normalizeLocale(savedLocale)
  return normalizeLocale(navigator.language)
}

export const setDocumentLocale = (locale: SupportedLocale) => {
  document.documentElement.setAttribute('lang', locale)
}

export const persistLocale = (locale: SupportedLocale) => {
  localStorage.setItem(STORAGE_KEY, locale)
  setDocumentLocale(locale)
}

const initialLocale = getInitialLocale()

setDocumentLocale(initialLocale)

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})
