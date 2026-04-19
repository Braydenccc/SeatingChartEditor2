import { beforeEach, afterEach, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn()
}

global.structuredClone = global.structuredClone || ((obj) => JSON.parse(JSON.stringify(obj)))

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
