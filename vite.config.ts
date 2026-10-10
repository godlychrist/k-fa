import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'offline-shell',
    closeBundle() {
      const dist = resolve('dist')
      const files = ['/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', ...readdirSync(resolve(dist, 'assets')).map(file => `/assets/${file}`)]
      const build = createHash('sha256').update(readFileSync(resolve(dist, 'index.html'))).digest('hex').slice(0, 12)
      const worker = readFileSync(resolve('public/sw.js'), 'utf8').replace('__BUILD__', build).replace('__ASSETS__', JSON.stringify(files))
      writeFileSync(resolve(dist, 'sw.js'), worker)
    },
  }],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000', '/auth': 'http://127.0.0.1:8000' } },
  preview: { port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000', '/auth': 'http://127.0.0.1:8000' } },
})
