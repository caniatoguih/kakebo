/// <reference types="vitest" />
import path from "path"
import react from "@vitejs/plugin-react"
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from "vitest/config"

export default defineConfig({
  build: {
    manifest: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons.svg', 'brand/kakebo-app-icon.png'],
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkOnly',
          method: 'GET',
        }],
      },
      manifest: {
        name: 'Kakebo Financeiro',
        short_name: 'Kakebo',
        description: 'Seu assistente financeiro pessoal',
        theme_color: '#2F5A46',
        background_color: '#FBF9F5',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: '/brand/kakebo-app-icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
