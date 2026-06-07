import { describe, it, expect, afterEach } from 'vitest'
import { useDragPreview } from '../useDragPreview'

describe('useDragPreview', () => {
  afterEach(() => {
    const { endDragPreview, registerPreviewElement } = useDragPreview()
    endDragPreview()
    registerPreviewElement(null)
  })

  it('positions preview element when it is registered after drag starts', () => {
    const { startDragPreview, registerPreviewElement } = useDragPreview()
    const previewEl = document.createElement('div')

    startDragPreview('seat-0-0-0', ['seat-0-0-0'], 120, 80)
    registerPreviewElement(previewEl)

    expect(previewEl.style.left).toBe('0px')
    expect(previewEl.style.top).toBe('0px')
    expect(previewEl.style.transform).toBe('translate3d(120px, 80px, 0) translate(-50%, -50%)')
    expect(previewEl.style.transition).toBe('none')
  })
})
