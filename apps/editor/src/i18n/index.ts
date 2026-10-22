import { common, createI18n, useLang } from '@lang-train/i18n'
import { de } from './de'
import { en } from './en'
import { fr } from './fr'
import { pl } from './pl'
import { ru } from './ru'
import { zh } from './zh'

export const dictionaries = {
  en: { ...common.en, ...en },
  de: { ...common.de, ...de },
  pl: { ...common.pl, ...pl },
  ru: { ...common.ru, ...ru },
  fr: { ...common.fr, ...fr },
  zh: { ...common.zh, ...zh },
}

export const i18n = createI18n(dictionaries)
export const t = i18n.t

// Use in components: re-renders on language change.
export function useI18n() {
  useLang(i18n)
  return i18n
}

// Messages kept in state as functions, so they follow a language switch.
export type Text = () => string
