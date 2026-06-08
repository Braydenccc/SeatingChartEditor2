// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('uses the bundled SCE cloud address by default', async () => {
    const { DEFAULT_RETIEHE_API_BASE, getRetieheApiBase } = await import('../apiClient')

    expect(getRetieheApiBase()).toBe(DEFAULT_RETIEHE_API_BASE)
  })

  it('allows a saved desktop address to override the bundled default', async () => {
    const { getRetieheApiBase, setRetieheApiBase } = await import('../apiClient')

    setRetieheApiBase('https://custom.example.com/')

    expect(getRetieheApiBase()).toBe('https://custom.example.com')
  })
})
