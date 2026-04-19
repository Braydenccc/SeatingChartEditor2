import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    root: fileURLToPath(new URL('./', import.meta.url)),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      exclude: [
        ...configDefaults.exclude,
        'src/components/**',
        'src/constants/**',
        'src/assets/**',
        '**/*.config.js',
        '**/dist/**',
        '**/node_modules/**',
        '**/__tests__/**',
        '**/test-utils/**',
        '**/types/**'
      ],
      include: ['src/composables/**/*.{js,ts}'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      },
      all: true,
      clean: true
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [...configDefaults.exclude, '**/node_modules/**', '**/dist/**'],
    setupFiles: ['./src/test-utils/setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: process.env.CI ? ['dot', 'json', 'html'] : ['verbose'],
    threads: false,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    isolate: true,
    passWithNoTests: false,
    watch: false,
    bail: process.env.CI ? 1 : 0
  }
})
