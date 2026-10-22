import { missingPluralForms, placeholderMismatches } from '@lang-train/i18n'
import { PACK_ERROR_MESSAGES } from '@lang-train/pack'
import { describe, expect, it } from 'vitest'
import { dictionaries } from './index'

describe('player dictionaries', () => {
  it('have all plural forms and the same placeholders as English', () => {
    expect(missingPluralForms(dictionaries)).toEqual([])
    expect(placeholderMismatches(dictionaries)).toEqual([])
  })

  it('translate every pack error', () => {
    for (const code of Object.keys(PACK_ERROR_MESSAGES)) expect(dictionaries.en).toHaveProperty([`err.${code}`])
  })
})
