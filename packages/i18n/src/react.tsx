import { useSyncExternalStore } from 'react'
import { LANG_NAMES, LANGS, type I18n, type Lang, type Messages } from './core'

// Re-renders the calling component when the language changes.
export function useLang<M extends Messages>(i18n: I18n<M>): Lang {
  return useSyncExternalStore(i18n.subscribe, i18n.getLang, i18n.getLang)
}

export function LanguageSelect<M extends Messages>({ i18n, label, className }: { i18n: I18n<M>; label: string; className?: string }) {
  const lang = useLang(i18n)
  return (
    <select className={className} value={lang} aria-label={label} title={label} onChange={(e) => i18n.setLang(e.target.value as Lang)}>
      {LANGS.map((l) => (
        <option key={l} value={l} lang={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  )
}
