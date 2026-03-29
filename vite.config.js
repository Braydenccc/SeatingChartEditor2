import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { authMockPlugin } from './vite.mock.plugin.js'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Allow relative paths for electron/tauri builds
  server: {
    host: 'localhost',
  },
  plugins: [
    vue(),
    vueDevTools(),
    authMockPlugin()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('@vue')) {
              return 'vendor-vue'
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx'
            }
            return 'vendor'
          }
        }
      }
    }
  }
})
