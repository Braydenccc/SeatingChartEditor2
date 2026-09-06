import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const coreCoverageLayers = [
  'src/composables/*.ts',
  'src/utils/*.ts',
  'src/platform/*.ts'
]

export default defineConfig({
  define: {
    __APP_BUILD_TIME__: JSON.stringify('2026-01-01T00:00:00.000Z'),
    __APP_RELEASE_VERSION__: JSON.stringify('vtest')
  },
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
      // Phase 1 gates the state/domain and platform boundaries. Vue views and
      // components remain covered by tests, but are not part of this aggregate.
      include: coreCoverageLayers,
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 65,
        statements: 70,
        'src/composables/*.ts': {
          lines: 70,
          functions: 75,
          branches: 65,
          statements: 70
        },
        'src/utils/*.ts': {
          lines: 75,
          functions: 80,
          branches: 65,
          statements: 75
        },
        'src/platform/*.ts': {
          lines: 65,
          functions: 70,
          branches: 70,
          statements: 65
        }
      },
      all: true,
      clean: true
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test-scr/assignment-performance-benchmark.test.js'
    ],
    exclude: [...configDefaults.exclude, '**/node_modules/**', '**/dist/**'],
    setupFiles: ['./src/test-utils/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: process.env.CI ? ['dot', 'json', 'html'] : ['verbose'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    isolate: true,
    passWithNoTests: false,
    watch: false,
    bail: process.env.CI ? 1 : 0
  }
})
