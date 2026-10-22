import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildDefines, siteBase } from '../../vite.shared.ts'

export default defineConfig({
  base: `${siteBase}editor/`,
  define: buildDefines,
  plugins: [react()],
  // peaks.js + Konva; the editor is a desktop app, one ~500 kB chunk is fine.
  build: { chunkSizeWarningLimit: 800 },
})
