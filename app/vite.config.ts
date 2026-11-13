import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import paket from '../package.json'

// Version oben rechts: Nummer aus der package.json im Wurzelordner, dazu der Zeitpunkt des Builds
const version = paket.version

// Läuft in Tauri: relative Pfade, fester Port für `tauri dev`, kein Service Worker (Updates kommen mit dem Installer)
export default defineConfig({
  define: { __VERSION__: JSON.stringify(version), __GEBAUT__: JSON.stringify(new Date().toISOString()) },
  base: './',
  plugins: [react()],
  clearScreen: false,
  build: { chunkSizeWarningLimit: 2000, outDir: 'dist', emptyOutDir: true },
  server: { host: process.env.TAURI_DEV_HOST || false, port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } }
})
