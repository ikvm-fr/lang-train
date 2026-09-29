// Minimal i18n: flat message dictionaries, {placeholders}, plurals via Intl.PluralRules,
// language switching at runtime (subscribers re-render), choice persisted in localStorage.

export const LANGS = ['en', 'de', 'pl', 'ru', 'fr', 'zh'] as const
export type Lang = (typeof LANGS)[number]

// Language names are shown in their own language.
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  de: 'Deutsch',
  pl: 'Polski',
  ru: 'Русский',
  fr: 'Français',
  zh: '中文',
}

// BCP 47 locales for Intl formatting and <html lang>.
export const LOCALES: Record<Lang, string> = { en: 'en', de: 'de', pl: 'pl', ru: 'ru', fr: 'fr', zh: 'zh-CN' }

// Plural forms as returned by Intl.PluralRules; `other` is always required.
export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}
export type Message = string | Plural
export type Messages = Record<string, Message>
// Every translation has exactly the keys of the English dictionary; plural where English is plural.
export type Translation<M extends Messages> = { [K in keyof M]: M[K] extends string ? string : Plural }
export type Params = Record<string, string | number>

const STORAGE_KEY = 'lt:lang'

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v)
}

export function detectLang(preferred: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (isLang(stored)) return stored
  } catch {
    /* storage unavailable */
  }
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLang(base)) return base
  }
  return 'en'
}

export interface I18n<M extends Messages> {
  t: <K extends keyof M & string>(key: K, params?: Params) => string
  // For keys built at runtime (e.g. error codes); undefined if the key does not exist.
  tryT: (key: string, params?: Params) => string | undefined
  getLang: () => Lang
  setLang: (lang: Lang) => void
  subscribe: (fn: () => void) => () => void
  locale: () => string
  number: (n: number, fractionDigits?: number) => string
  dateTime: (d: Date | string | number) => string
  time: (d: Date | string | number) => string
}

export function createI18n<M extends Messages>(dicts: { en: M } & Record<Lang, Translation<M>>, initial?: Lang): I18n<M> {
  let lang: Lang = initial ?? detectLang()
  const listeners = new Set<() => void>()
  const pluralRules = new Map<Lang, Intl.PluralRules>()
  const numberFormats = new Map<string, Intl.NumberFormat>()

  const locale = () => LOCALES[lang]
  const number = (n: number, fractionDigits?: number) => {
    const key = `${lang}:${fractionDigits ?? ''}`
    let nf = numberFormats.get(key)
    if (!nf) {
      nf = new Intl.NumberFormat(
        locale(),
        fractionDigits === undefined ? {} : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits },
      )
      numberFormats.set(key, nf)
    }
    return nf.format(n)
  }

  const render = (msg: Message, params?: Params): string => {
    let text: string
    if (typeof msg === 'string') text = msg
    else {
      const count = Number(params?.count ?? 0)
      let rules = pluralRules.get(lang)
      if (!rules) pluralRules.set(lang, (rules = new Intl.PluralRules(locale())))
      text = msg[rules.select(count) as keyof Plural] ?? msg.other
    }
    if (!params) return text
    return text.replace(/\{(\w+)\}/g, (m, name: string) => {
      const v = params[name]
      if (v === undefined) return m
      return typeof v === 'number' ? number(v) : v
    })
  }

  const lookup = (key: string): Message | undefined =>
    (dicts[lang] as Record<string, Message>)[key] ?? (dicts.en as Record<string, Message>)[key]

  const apply = () => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale()
  }
  apply()

  return {
    t: (key, params) => {
      const msg = lookup(key)
      return msg === undefined ? key : render(msg, params)
    },
    tryT: (key, params) => {
      const msg = lookup(key)
      return msg === undefined ? undefined : render(msg, params)
    },
    getLang: () => lang,
    setLang: (next) => {
      if (next === lang) return
      lang = next
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, next)
      } catch {
        /* storage unavailable */
      }
      apply()
      listeners.forEach((fn) => fn())
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    locale,
    number,
    dateTime: (d) => new Date(d).toLocaleString(locale()),
    time: (d) => new Date(d).toLocaleTimeString(locale()),
  }
}

// Text for an error: translated if it carries a known code (err.<code>), else its message.
export function errorText<M extends Messages>(i18n: I18n<M>, e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof e.code === 'string') {
    const params = 'params' in e && e.params && typeof e.params === 'object' ? (e.params as Params) : undefined
    const text = i18n.tryT(`err.${e.code}`, params)
    if (text) return text
  }
  return e instanceof Error ? e.message : String(e)
}

// Checks that plural messages have every form the language needs (used by tests).
export function missingPluralForms(dicts: Record<Lang, Messages>): string[] {
  const problems: string[] = []
  for (const lang of LANGS) {
    const needed = new Intl.PluralRules(LOCALES[lang]).resolvedOptions().pluralCategories
    for (const [key, msg] of Object.entries(dicts[lang])) {
      if (typeof msg === 'string') continue
      for (const cat of needed) if (!(cat in msg)) problems.push(`${lang}: ${key} lacks "${cat}"`)
    }
  }
  return problems
}

// Checks that every translation uses the same {placeholders} as English (used by tests).
export function placeholderMismatches(dicts: Record<Lang, Messages>): string[] {
  const names = (m: Message) =>
    [...new Set((typeof m === 'string' ? [m] : Object.values(m)).join(' ').match(/\{\w+\}/g) ?? [])].sort().join(',')
  const problems: string[] = []
  for (const lang of LANGS) {
    for (const [key, msg] of Object.entries(dicts.en)) {
      const other = dicts[lang][key]
      if (other === undefined) problems.push(`${lang}: ${key} is missing`)
      else if (names(other) !== names(msg)) problems.push(`${lang}: ${key} uses ${names(other)} instead of ${names(msg)}`)
    }
  }
  return problems
}
