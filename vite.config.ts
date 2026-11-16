import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// local dev reads live data from production
const LIVE = 'https://stellarcope.xyz'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': { target: LIVE, changeOrigin: true } } },
  preview: { proxy: { '/api': { target: LIVE, changeOrigin: true } } },
})
