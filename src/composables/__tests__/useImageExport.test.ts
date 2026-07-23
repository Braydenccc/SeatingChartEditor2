import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  seatConfig: {
    value: {
      podiumPosition: 'top',
      guardSeats: { enabled: false }
    }
  },
  organizedSeats: { value: [] },
  visibleGuardSeats: { value: [] },
  students: { value: [] },
  tags: { value: [] },
  exportSettings: {
    value: {
      title: '班级座位表',
      showTitle: false,
      showRowNumbers: false,
      showGroupLabels: false,
      showPodium: false,
      flipVertical: false,
      flipHorizontal: false,
      colorMode: 'color',
      enableTagLabels: false,
      tagSettings: {},
      colGap: 20,
      rowGap: 20,
      groupGap: 40,
      padding: 20,
      fontSizeTitle: 32,
      fontSizeRowNumber: 18,
      fontSizeGroupLabel: 18,
      fontSizePodium: 18,
      fontSizeName: 24,
      fontSizeStudentId: 16,
      fontSizeTag: 12,
      offsetYName: 0,
      offsetYStudentId: 0
    }
  }
}))

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => ({
    seatConfig: state.seatConfig,
    organizedSeats: state.organizedSeats,
    visibleGuardSeats: state.visibleGuardSeats
  })
}))

vi.mock('../useStudentData', () => ({
  useStudentData: () => ({ students: state.students })
}))

vi.mock('../useTagData', () => ({
  useTagData: () => ({ tags: state.tags })
}))

vi.mock('../useExportSettings', () => ({
  useExportSettings: () => ({ exportSettings: state.exportSettings })
}))

import {
  calculateImageSeatTableGeometry,
  createLatestImagePreviewRunner,
  useImageExport
} from '../useImageExport'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('useImageExport helpers', () => {
  beforeEach(() => {
    state.organizedSeats.value = []
    state.visibleGuardSeats.value = []
    state.students.value = []
    state.tags.value = []
  })

  it('calculates width per heterogeneous group and height from the longest column', () => {
    expect(calculateImageSeatTableGeometry(
      [[3, 2], [4], [1, 5, 2]],
      100,
      10,
      30,
      20
    )).toEqual({
      groupWidths: [210, 100, 320],
      seatTableWidth: 730,
      maxRowCount: 5
    })
  })

  it('coalesces preview requests, discards stale URLs, and never generates concurrently', async () => {
    const generations = [deferred<string>(), deferred<string>()]
    let active = 0
    let maxActive = 0
    const generate = vi.fn(() => {
      const generation = generations[generate.mock.calls.length - 1]
      active += 1
      maxActive = Math.max(maxActive, active)
      return generation.promise.finally(() => {
        active -= 1
      })
    })
    const onLatest = vi.fn()
    const onDiscard = vi.fn()
    const runner = createLatestImagePreviewRunner({
      generate,
      onLatest,
      onDiscard,
      onRunningChange: vi.fn(),
      onError: vi.fn()
    })

    const firstRequest = runner.request()
    const secondRequest = runner.request()
    const thirdRequest = runner.request()
    expect(generate).toHaveBeenCalledTimes(1)

    generations[0].resolve('blob:stale')
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2))
    generations[1].resolve('blob:latest')
    await Promise.all([firstRequest, secondRequest, thirdRequest])

    expect(onDiscard).toHaveBeenCalledWith('blob:stale')
    expect(onLatest).toHaveBeenCalledTimes(1)
    expect(onLatest).toHaveBeenCalledWith('blob:latest')
    expect(maxActive).toBe(1)
  })

  it('discards an in-flight URL after the runner is disposed', async () => {
    const generation = deferred<string>()
    const onLatest = vi.fn()
    const onDiscard = vi.fn()
    const runner = createLatestImagePreviewRunner({
      generate: () => generation.promise,
      onLatest,
      onDiscard,
      onRunningChange: vi.fn(),
      onError: vi.fn()
    })

    const request = runner.request()
    runner.dispose()
    generation.resolve('blob:disposed')
    await request

    expect(onLatest).not.toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalledWith('blob:disposed')
  })

  it('uses half-sized A4 canvases for previews and full-sized canvases for print', async () => {
    const canvases: HTMLCanvasElement[] = []
    const context = new Proxy({
      measureText: () => ({ width: 0 })
    } as unknown as CanvasRenderingContext2D, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver)
        if (value !== undefined) return value
        const fallback = vi.fn()
        Reflect.set(target, property, fallback, receiver)
        return fallback
      }
    })
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options)
      if (tagName.toLowerCase() === 'canvas') {
        const canvas = element as HTMLCanvasElement
        Object.defineProperties(canvas, {
          getContext: {
            configurable: true,
            value: () => context
          },
          toBlob: {
            configurable: true,
            value: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' }))
          }
        })
        canvases.push(canvas)
      }
      return element
    }) as typeof document.createElement)
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:preview')
      .mockReturnValueOnce('blob:print')

    const { exportToImage } = useImageExport()
    await exportToImage({ resolution: 'preview' })
    await exportToImage({ resolution: 'print' })

    expect(canvases).toHaveLength(2)
    expect([canvases[0]?.width, canvases[0]?.height]).toEqual([1240, 1754])
    expect([canvases[1]?.width, canvases[1]?.height]).toEqual([2480, 3508])
  })
})
