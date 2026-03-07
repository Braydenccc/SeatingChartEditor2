import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { authMockPlugin } from './vite.mock.plugin.js'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0', // Listen on all local IPs
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
})
