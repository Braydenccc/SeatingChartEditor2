import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import CandidateItem from '../CandidateItem.vue'
import { mobileWorkbenchMediaQuery } from '@/constants/layout'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  const selectedStudentId = ref<number | null>(null)
  const isMobileWorkbench = ref(false)
  const isLandscape = ref(false)
  return {
    ref,
    isMobileWorkbench,
    isLandscape,
    useMediaQuery: vi.fn((query: string) => query === '(max-width: 1024px)' ? isMobileWorkbench : isLandscape),
    selectedStudentId,
    selectStudent: vi.fn((studentId: number) => { selectedStudentId.value = studentId }),
    clearSelection: vi.fn(() => { selectedStudentId.value = null }),
    setRightRailTab: vi.fn(),
    closeMobileSheet: vi.fn(),
    showMobileSheet: vi.fn()
  }
})

vi.mock('@vueuse/core', () => ({ useMediaQuery: mocks.useMediaQuery }))
vi.mock('@/composables/useSeatChart', () => ({
  useSeatChart: () => ({ getEmptySeats: () => [], assignStudent: vi.fn() })
}))
vi.mock('@/composables/useStudentData', () => ({
  useStudentData: () => ({
    selectedStudentId: mocks.selectedStudentId,
    selectStudent: mocks.selectStudent,
    clearSelection: mocks.clearSelection
  })
}))
vi.mock('@/composables/useEditMode', () => ({
  useEditMode: () => ({ currentMode: mocks.ref('normal'), EditMode: { NORMAL: 'normal' } })
}))
vi.mock('@/composables/useEditorCommands', () => ({ useEditorCommands: () => ({ activateTool: vi.fn() }) }))
vi.mock('@/composables/useGlobalSettings', () => ({
  useGlobalSettings: () => ({ settings: mocks.ref({ editor: { doubleClickAction: 'edit' } }) })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ success: vi.fn(), warning: vi.fn() })
}))
vi.mock('@/composables/useEditorWorkbench', () => ({
  useEditorWorkbench: () => ({
    setRightRailTab: mocks.setRightRailTab,
    showMobileSheet: mocks.showMobileSheet,
    closeMobileSheet: mocks.closeMobileSheet,
    suspendMobileDrawerForDrag: vi.fn(),
    restoreMobileDrawerAfterDrag: vi.fn(),
    isSeatFullscreen: mocks.ref(false)
  })
}))
vi.mock('@/composables/useStudentDragging', () => ({
  useStudentDragging: () => ({
    isStudentDragging: mocks.ref(false),
    lastPointerWasTouch: mocks.ref(false),
    canHtmlDrag: () => true,
    consumeSuppressedClick: () => false,
    handlePointerDown: vi.fn(),
    handleTouchStart: vi.fn(),
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn()
  })
}))

describe('CandidateItem keyboard accessibility', () => {
  beforeEach(() => {
    mocks.selectedStudentId.value = null
    mocks.isMobileWorkbench.value = false
    mocks.isLandscape.value = false
    vi.clearAllMocks()
  })

  it('exposes its student state and activates with Enter and Space', async () => {
    const wrapper = shallowMount(CandidateItem, {
      props: {
        student: { id: 7, name: '张三', studentNumber: 12, tags: [], numericAttributes: {} }
      }
    })

    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('aria-label')).toContain('候选学生 张三，学号 12')

    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(mocks.selectStudent).toHaveBeenCalledWith(7)
    expect(mocks.setRightRailTab).toHaveBeenCalledWith('selection')

    await wrapper.trigger('keydown', { key: ' ' })
    expect(mocks.clearSelection).toHaveBeenCalledTimes(1)
  })

  it('opens context in the mobile sheet at tablet widths', async () => {
    mocks.isMobileWorkbench.value = true
    const wrapper = shallowMount(CandidateItem, {
      props: {
        student: { id: 7, name: '张三', studentNumber: 12, tags: [], numericAttributes: {} }
      }
    })

    expect(mocks.useMediaQuery).toHaveBeenCalledWith(mobileWorkbenchMediaQuery)
    await wrapper.trigger('contextmenu')

    expect(mocks.selectStudent).toHaveBeenCalledWith(7)
    expect(mocks.showMobileSheet).toHaveBeenCalledWith('context')
  })
})
