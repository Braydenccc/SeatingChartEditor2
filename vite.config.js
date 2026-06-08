import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteCompression from 'vite-plugin-compression'

import { authMockPlugin } from './vite.mock.plugin.js'

const buildTime = process.env.VITE_APP_BUILD_TIME || new Date().toISOString()
const buildDate = new Date(buildTime)
const releaseVersion = process.env.VITE_APP_RELEASE_VERSION || (
  Number.isNaN(buildDate.getTime())
    ? 'vunknown'
    : `v${buildDate.getUTCFullYear()}${String(buildDate.getUTCMonth() + 1).padStart(2, '0')}${String(buildDate.getUTCDate()).padStart(2, '0')}-${String(buildDate.getUTCHours()).padStart(2, '0')}${String(buildDate.getUTCMinutes()).padStart(2, '0')}${String(buildDate.getUTCSeconds()).padStart(2, '0')}`
)

// https://vite.dev/config/
export default defineConfig({
  base: './', // Allow relative paths for electron/tauri builds
  define: {
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
    __APP_RELEASE_VERSION__: JSON.stringify(releaseVersion)
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
  server: {
    port: 5173,
    host: process.env.VITE_HOST || "127.0.0.1",  // 默认仅本地访问，如需局域网访问使用 VITE_HOST=0.0.0.0
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer'
    }
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
