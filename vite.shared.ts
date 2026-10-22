import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Root URL path of the whole site, set in CI:
//   "/lang-train/" for main, "/lang-train/preview/<branch>/" for other branches.
// The player is served at the root, the editor under "editor/".
export const siteBase = process.env.BASE_PATH ?? '/'
export const isPreview = siteBase.includes('/preview/')

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'local'
  }
}

const rootPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// Build info shown in the footer of every app.
export const buildDefines = {
  __APP_VERSION__: JSON.stringify(rootPkg.version),
  __COMMIT__: JSON.stringify(commit()),
  __BRANCH__: JSON.stringify(process.env.GITHUB_REF_NAME ?? 'local'),
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
}
