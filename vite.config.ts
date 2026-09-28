import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// BASE_PATH is set in CI: "/lang-train/" for main, "/lang-train/preview/<branch>/" for other branches.
const base = process.env.BASE_PATH ?? '/'
const isPreview = base.includes('/preview/')

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'local'
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __COMMIT__: JSON.stringify(commit()),
    __BRANCH__: JSON.stringify(process.env.GITHUB_REF_NAME ?? 'local'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: isPreview ? 'Lang Train (preview)' : 'Lang Train',
        short_name: isPreview ? 'LT preview' : 'Lang Train',
        description: 'Pronunciation trainer: phrase → pause → repeat',
        lang: 'en',
        display: 'standalone',
        background_color: '#111418',
        theme_color: '#111418',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,zip}'],
        // The main site must not intercept navigation into branch previews.
        navigateFallbackDenylist: [/\/preview\//],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
})
