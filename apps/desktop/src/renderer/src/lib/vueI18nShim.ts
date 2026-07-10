import { inject, provide, ref, type App, type InjectionKey, type Ref } from 'vue'

type LocaleMessages = Record<string, unknown>
type Messages = Record<string, LocaleMessages>
type I18nOptions = {
  locale: string
  fallbackLocale?: string
  messages: Messages
  legacy?: boolean
  globalInjection?: boolean
}

type TranslateParams = Record<string, string | number | boolean | null | undefined>

type I18nContext = {
  locale: Ref<string>
  fallbackLocale: string
  messages: Messages
  t: (key: string, params?: TranslateParams) => string
}

const I18N_KEY: InjectionKey<I18nContext> = Symbol('media-parser-i18n')
let activeContext: I18nContext | null = null

function resolvePath(source: LocaleMessages | undefined, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, source)
}

function interpolate(message: string, params?: TranslateParams): string {
  if (!params) return message

  return message.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function createContext(options: I18nOptions): I18nContext {
  const locale = ref(options.locale)
  const fallbackLocale = options.fallbackLocale || options.locale

  const context: I18nContext = {
    locale,
    fallbackLocale,
    messages: options.messages,
    t: (key, params) => {
      const message = resolvePath(options.messages[locale.value], key)
        ?? resolvePath(options.messages[fallbackLocale], key)

      if (typeof message === 'string') return interpolate(message, params)
      if (typeof message === 'number' || typeof message === 'boolean') return String(message)
      return key
    }
  }

  return context
}

export function createI18n(options: I18nOptions) {
  const context = createContext(options)
  activeContext = context

  return {
    global: context,
    install(app: App) {
      app.provide(I18N_KEY, context)
      app.config.globalProperties.$t = context.t
    }
  }
}

export function useI18n(): I18nContext {
  const context = inject(I18N_KEY, activeContext)

  if (!context) {
    throw new Error('i18n has not been installed')
  }

  provide(I18N_KEY, context)
  return context
}
