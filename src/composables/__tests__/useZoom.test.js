import { describe, it, expect, beforeEach, vi } from 'vitest'

const createElement = (rectProvider, transform = '') => ({
  style: { transform },
  getBoundingClientRect: vi.fn(() => rectProvider())
})

describe('useZoom', () => {
  let useZoom
  let zoom

  beforeEach(async () => {
    vi.resetModules()
    ;({ useZoom } = await import('../useZoom'))
    zoom = useZoom()
    zoom.resetZoom()
    zoom.registerViewport(null, null)
  })

  it('restores chart transform when fit exits early after nextTick', async () => {
    const viewport = createElement(() => ({ width: 800, height: 600 }))
    const chart = createElement(() => ({ width: 400, height: 300 }), 'translate(10px, 20px) scale(1)')

    const fitting = zoom.fitToViewport()
    zoom.registerViewport(null, null)
    await fitting

    expect(chart.style.transform).toBe('translate(10px, 20px) scale(1)')
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

    expect(chart.getBoundingClientRect).toHaveBeenCalledTimes(2)
    expect(zoom.scale.value).toBe(0.43)
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
})
