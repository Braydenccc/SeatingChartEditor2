import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mount: vi.fn(),
  routerReady: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('vue', () => ({
  createApp: vi.fn(() => ({
    use: vi.fn(),
    config: {},
    mount: mocks.mount
  }))
}))

vi.mock('../App.vue', () => ({ default: {} }))
vi.mock('../router', () => ({
  default: {
    isReady: mocks.routerReady
  }
}))

describe('main preload recovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app">editor content</div><div id="initial-loading"></div>'
    sessionStorage.clear()
    window.__SCE_HIDE_INITIAL_LOADING__ = vi.fn()
  })

  it('keeps a ready app mounted and reports a recoverable preload error', async () => {
    const recoveryListener = vi.fn()
    window.addEventListener('sce:preload-recovery-needed', recoveryListener)

    await import('../main')
    await vi.waitFor(() => {
      expect(document.getElementById('app')?.dataset.ready).toBe('true')
    })

    const preloadError = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent
    preloadError.payload = new Error('optional chunk failed')
    window.dispatchEvent(preloadError)

    expect(preloadError.defaultPrevented).toBe(true)
    expect(document.getElementById('app')?.textContent).toBe('editor content')
    expect(document.getElementById('app')?.dataset.preloadRecovery).toBe('required')
    expect(recoveryListener).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-sce-preload-recovery="required"]')).not.toBeNull()

    const dismissButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === '稍后处理')
    dismissButton?.click()
    expect(document.querySelector('[data-sce-preload-recovery="required"]')).toBeNull()
  })
})
