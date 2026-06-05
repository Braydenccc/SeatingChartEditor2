import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    root: fileURLToPath(new URL('../', import.meta.url)),
    include: ['test-scr/assignment-performance-benchmark.test.js'],
    setupFiles: ['./src/test-utils/setup.js'],
    testTimeout: 120000,
    hookTimeout: 30000,
    threads: false,
    watch: false
  }
})
