import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { NDrawer, NModal } from 'naive-ui'
import ResponsiveOverlay from '../ResponsiveOverlay.vue'

const setMobileViewport = (mobile: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('max-width: 768px') ? mobile : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

describe('ResponsiveOverlay', () => {
  beforeEach(() => setMobileViewport(false))

  it('uses a modal on desktop and a bottom drawer on mobile', () => {
    const desktop = shallowMount(ResponsiveOverlay, { props: { show: true, title: '学生编辑' } })
    expect(desktop.findComponent(NModal).exists()).toBe(true)
    expect(desktop.findComponent(NDrawer).exists()).toBe(false)

    setMobileViewport(true)
    const mobile = shallowMount(ResponsiveOverlay, { props: { show: true, title: '学生编辑' } })
    expect(mobile.findComponent(NDrawer).exists()).toBe(true)
    expect(mobile.findComponent(NDrawer).props('placement')).toBe('bottom')
  })

  it('keeps a dirty overlay open when beforeClose rejects the request', async () => {
    const beforeClose = vi.fn().mockResolvedValue(false)
    const wrapper = shallowMount(ResponsiveOverlay, {
      props: { show: true, title: '排位规则', beforeClose }
    })

    wrapper.findComponent(NModal).vm.$emit('esc')
    await flushPromises()

    expect(beforeClose).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:show')).toBeUndefined()
  })

  it('deduplicates simultaneous close events while awaiting beforeClose', async () => {
    let resolveClose: ((value: boolean) => void) | undefined
    const beforeClose = vi.fn(() => new Promise<boolean>(resolve => { resolveClose = resolve }))
    const wrapper = shallowMount(ResponsiveOverlay, {
      props: { show: true, title: '排位规则', beforeClose }
    })
    const modal = wrapper.findComponent(NModal)

    modal.vm.$emit('mask-click')
    modal.vm.$emit('update:show', false)
    expect(beforeClose).toHaveBeenCalledTimes(1)

    resolveClose?.(true)
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })

  it('blocks Escape and mask closure while busy', async () => {
    const beforeClose = vi.fn().mockResolvedValue(true)
    const wrapper = shallowMount(ResponsiveOverlay, {
      props: { show: true, title: '导入数据', busy: true, beforeClose }
    })
    const modal = wrapper.findComponent(NModal)

    modal.vm.$emit('mask-click')
    modal.vm.$emit('esc')
    await flushPromises()

    expect(beforeClose).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:show')).toBeUndefined()
  })
})
