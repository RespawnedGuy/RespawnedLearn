import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Entwicklung: API an den lokalen Server (npm run server) weiterreichen. Port nur lokal, nichts Internes.
export default defineConfig({
  base: '/lernen/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RespawnedNotes Lernen',
        short_name: 'Lernen',
        lang: 'de',
        theme_color: '#f6f4f0',
        background_color: '#f6f4f0',
        display: 'standalone',
        start_url: '/lernen/',
        scope: '/lernen/',
        icons: [{ src: 'icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' }]
      },
      workbox: {
        // mjs: Worker von pdf.js, damit PDFs offline lesbar bleiben
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  build: { chunkSizeWarningLimit: 2000, outDir: '../../dist/lernen', emptyOutDir: true },
  server: { host: true, proxy: { '/api': 'http://localhost:8080' } }
})
