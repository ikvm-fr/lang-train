import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { buildDefines, isPreview, siteBase } from '../../vite.shared'

export default defineConfig({
  base: siteBase,
  define: buildDefines,
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
        // The player's service worker must not serve its page for the editor
        // or (on the main site) for branch previews.
        navigateFallbackDenylist: [/\/editor(\/|$)/, ...(isPreview ? [] : [/\/preview\//])],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
})
