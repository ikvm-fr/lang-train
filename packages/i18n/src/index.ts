export * from './core'
export * from './react'
import { de } from './common/de'
import { en } from './common/en'
import { fr } from './common/fr'
import { pl } from './common/pl'
import { ru } from './common/ru'
import { zh } from './common/zh'

export const common = { en, de, pl, ru, fr, zh }
export type CommonMessages = typeof en
