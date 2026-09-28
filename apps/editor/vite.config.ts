import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildDefines, siteBase } from '../../vite.shared'

export default defineConfig({
  base: `${siteBase}editor/`,
  define: buildDefines,
  plugins: [react()],
})
