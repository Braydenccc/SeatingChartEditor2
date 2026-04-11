import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteCompression from 'vite-plugin-compression'

import { authMockPlugin } from './vite.mock.plugin.js'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Allow relative paths for electron/tauri builds
  server: {
    host: '0.0.0.0',
  },
  plugins: [
    vue(),
    vueDevTools(),
    authMockPlugin(),
    // 为生产环境生成 .gz 和 .br 预压缩文件
    viteCompression({ algorithm: 'gzip' }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br' })
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
