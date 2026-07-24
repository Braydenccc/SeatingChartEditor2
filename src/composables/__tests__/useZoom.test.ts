import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { useZoom as UseZoomFactory } from '../useZoom'

const createElement = (rectProvider: () => { width: number; height: number }, transform = '') => {
  const element = document.createElement('div')
  element.style.transform = transform
  element.getBoundingClientRect = vi.fn(() => {
    const rect = rectProvider()
    return new DOMRect(0, 0, rect.width, rect.height)
  })
  return element
}

describe('useZoom', () => {
  let useZoom: typeof UseZoomFactory
  let zoom: ReturnType<typeof UseZoomFactory>
  let globalSettings: ReturnType<typeof import('../useGlobalSettings')['useGlobalSettings']>

  beforeEach(async () => {
    vi.resetModules()
    const { useGlobalSettings } = await import('../useGlobalSettings')
    globalSettings = useGlobalSettings()
    globalSettings.resetSettings('ui')
    ;({ useZoom } = await import('../useZoom'))
    zoom = useZoom()
    zoom.resetZoom()
    zoom.registerViewport(null, null)

    expect(zoom.scale.value).toBe(1)
    expect(zoom.panX.value).toBe(0)
    expect(zoom.panY.value).toBe(0)
  })

  it('restores chart transform when fit exits early after nextTick', async () => {
    const viewport = createElement(() => ({ width: 800, height: 600 }))
    const chart = createElement(() => ({ width: 400, height: 300 }), 'translate(10px, 20px) scale(1)')

    const fitting = zoom.fitToViewport()
    zoom.registerViewport(null, null)
    await fitting

    expect(chart.style.transform).toBe('translate(10px, 20px) scale(1)')
    expect(zoom.scale.value).toBe(1)
    expect(zoom.panX.value).toBe(0)
    expect(zoom.panY.value).toBe(0)
  })

  it('reruns once when fit is requested during an in-flight fit', async () => {
    const viewport = createElement(() => ({ width: 300, height: 300 }))

    let chartCallCount = 0
    const chart = createElement(() => {
      chartCallCount += 1
      if (chartCallCount === 1) {
        return { width: 200, height: 200 }
      }
      return { width: 600, height: 600 }
    })

    zoom.registerViewport(viewport, chart)

    const firstFit = zoom.fitToViewport()
    const secondFit = zoom.fitToViewport()
    await Promise.all([firstFit, secondFit])

    const expectedScale = Math.round((Math.min((300 - 40) / 600, (300 - 30) / 600, 1) * 100)) / 100

    expect(chart.getBoundingClientRect).toHaveBeenCalledTimes(2)
    expect(zoom.scale.value).toBe(expectedScale)
    expect(zoom.panX.value).toBe(0)
    expect(zoom.panY.value).toBe(0)
  })

  it('computes scale and resets pan for standard fit calculation', async () => {
    const viewport = createElement(() => ({ width: 1000, height: 800 }))
    const chart = createElement(() => ({ width: 1200, height: 900 }))

    zoom.registerViewport(viewport, chart)
    zoom.setPan(123, -45)

    await zoom.fitToViewport()

    expect(zoom.scale.value).toBe(0.8)
    expect(zoom.panX.value).toBe(0)
    expect(zoom.panY.value).toBe(0)
  })

  it('uses the configured default zoom as the auto-fit upper limit', async () => {
    const viewport = createElement(() => ({ width: 1000, height: 800 }))
    const chart = createElement(() => ({ width: 400, height: 300 }))
    globalSettings.updateSetting('ui.defaultZoom', 60, { immediate: true })

    zoom.registerViewport(viewport, chart)
    await zoom.fitToViewport()

    expect(zoom.autoFitScaleLimit.value).toBe(0.6)
    expect(zoom.scale.value).toBe(0.6)
  })

  it('refits immediately when the limit changes without restricting manual zoom', async () => {
    const viewport = createElement(() => ({ width: 1000, height: 800 }))
    const chart = createElement(() => ({ width: 400, height: 300 }))
    globalSettings.updateSetting('ui.defaultZoom', 60, { immediate: true })
    zoom.registerViewport(viewport, chart)
    await zoom.fitToViewport()

    globalSettings.updateSetting('ui.defaultZoom', 80, { immediate: true })
    await vi.waitFor(() => expect(zoom.scale.value).toBe(0.8))

    zoom.zoomIn()
    expect(zoom.scale.value).toBe(0.9)
    zoom.setScale(2.5)
    expect(zoom.scale.value).toBe(2.5)
  })
})
