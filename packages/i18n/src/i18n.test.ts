import { describe, expect, it } from 'vitest'
import { common } from './index'
import { createI18n, detectLang, errorText, LANGS, missingPluralForms, type Translation } from './core'

const en = {
  hello: 'Hello, {name}!',
  regions: { one: '{count} region', other: '{count} regions' },
  onlyEn: 'English only',
}
const ru: Translation<typeof en> = {
  hello: 'Привет, {name}!',
  regions: { one: '{count} регион', few: '{count} региона', many: '{count} регионов', other: '{count} региона' },
  onlyEn: '',
}
const dicts = { en, de: en, pl: en, ru, fr: en, zh: en }

describe('createI18n', () => {
  it('interpolates, pluralises per language and formats numbers', () => {
    const i = createI18n(dicts, 'en')
    expect(i.t('hello', { name: 'Anna' })).toBe('Hello, Anna!')
    expect(i.t('regions', { count: 1 })).toBe('1 region')
    expect(i.t('regions', { count: 1234 })).toBe('1,234 regions')
    i.setLang('ru')
    expect(i.t('regions', { count: 1 })).toBe('1 регион')
    expect(i.t('regions', { count: 3 })).toBe('3 региона')
    expect(i.t('regions', { count: 5 })).toBe('5 регионов')
    expect(i.t('regions', { count: 21 })).toBe('21 регион')
    expect(i.number(1.5, 1)).toBe('1,5')
  })

  it('notifies subscribers on change and falls back to English for missing keys', () => {
    const i = createI18n(dicts, 'en')
    let calls = 0
    i.subscribe(() => calls++)
    i.setLang('de')
    i.setLang('de')
    expect(calls).toBe(1)
    expect(i.tryT('nope')).toBeUndefined()
    expect(i.t('nope' as 'hello')).toBe('nope')
  })

  it('detects the language from the browser preferences', () => {
    expect(detectLang(['zh-CN', 'en'])).toBe('zh')
    expect(detectLang(['pt-BR', 'pl-PL'])).toBe('pl')
    expect(detectLang(['ja'])).toBe('en')
  })

  it('translates coded errors', () => {
    const i = createI18n({ en: common.en, de: common.de, pl: common.pl, ru: common.ru, fr: common.fr, zh: common.zh }, 'ru')
    const e = Object.assign(new Error('x'), { code: 'duplicatePhraseId', params: { id: 'p1' } })
    expect(errorText(i, e)).toBe('phrases.csv: идентификатор фразы «p1» встречается дважды.')
    expect(errorText(i, new Error('plain'))).toBe('plain')
  })
})

describe('shared dictionaries', () => {
  it('cover every language', () => {
    expect(Object.keys(common).sort()).toEqual([...LANGS].sort())
    expect(missingPluralForms(common)).toEqual([])
  })
})
