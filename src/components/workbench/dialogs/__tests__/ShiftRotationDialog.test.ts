import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShiftRotationDialog from '../ShiftRotationDialog.vue'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    seatConfig: ref({ shiftDistance: 4, shiftColShift: 0, shiftDirection: -1 }),
    shiftSeats: vi.fn(),
    createSnapshot: vi.fn(),
    recordBatch: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
})

vi.mock('@/composables/useSeatChart', () => ({
  useSeatChart: () => ({ seatConfig: mocks.seatConfig, shiftSeats: mocks.shiftSeats })
}))
vi.mock('@/composables/useUndo', () => ({
  useUndo: () => ({ createSnapshot: mocks.createSnapshot, recordBatch: mocks.recordBatch })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ success: mocks.success, warning: mocks.warning })
}))

const mountedWrappers: Array<ReturnType<typeof mount>> = []

const mountDialog = () => {
  const wrapper = mount(ShiftRotationDialog, {
    props: { visible: true },
    global: {
      stubs: {
        ResponsiveOverlay: {
          props: ['show', 'title', 'desktopWidth'],
          template: '<div><slot /><slot name="footer" /></div>'
        }
      }
    }
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

const applyShift = async (wrapper: ReturnType<typeof mount>) => {
  const button = wrapper.findAll('button').find(item => item.text().includes('应用位移'))
  if (!button) throw new Error('未找到应用位移按钮')
  await button.trigger('click')
}

describe('ShiftRotationDialog', () => {
  beforeEach(() => {
    mocks.seatConfig.value = { shiftDistance: 4, shiftColShift: 0, shiftDirection: -1 }
    mocks.createSnapshot.mockReturnValueOnce({ id: 'before' }).mockReturnValueOnce({ id: 'after' })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('keeps the dialog open and skips undo and success effects when shifting fails', async () => {
    mocks.shiftSeats.mockReturnValue(false)
    const wrapper = mountDialog()

    await applyShift(wrapper)

    expect(mocks.shiftSeats).toHaveBeenCalledWith(4, -1, 0)
    expect(mocks.createSnapshot).toHaveBeenCalledTimes(1)
    expect(mocks.recordBatch).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith('当前座位布局无法完成该位移，请调整参数后重试')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('records undo and closes only after a successful shift', async () => {
    mocks.shiftSeats.mockReturnValue(true)
    const wrapper = mountDialog()

    await applyShift(wrapper)

    expect(mocks.createSnapshot).toHaveBeenCalledTimes(2)
    expect(mocks.recordBatch).toHaveBeenCalledWith({ id: 'before' }, { id: 'after' })
    expect(mocks.success).toHaveBeenCalledWith('座位轮换完成：向后 4 行，溢出列移 -1')
    expect(wrapper.emitted('close')).toEqual([[]])
  })
})
