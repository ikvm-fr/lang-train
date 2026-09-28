// Combines the app builds into one site in dist/:
//   dist/         ← apps/player/dist
//   dist/editor/  ← apps/editor/dist
import { cpSync, rmSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const out = new URL('dist/', root)
rmSync(out, { recursive: true, force: true })
cpSync(new URL('apps/player/dist/', root), out, { recursive: true })
cpSync(new URL('apps/editor/dist/', root), new URL('editor/', out), { recursive: true })
console.log('Site assembled in dist/')
