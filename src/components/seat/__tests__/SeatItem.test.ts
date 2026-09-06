import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SeatItem from '../SeatItem.vue'
import { mobileWorkbenchMediaQuery } from '@/constants/layout'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  const isMobileWorkbench = ref(false)
  return {
    ref,
    isMobileWorkbench,
    useMediaQuery: vi.fn(() => isMobileWorkbench),
    selectedStudentId: ref<number | null>(null),
    selectedSeatIds: ref(new Set<string>()),
    selectSingleSeat: vi.fn(),
    setRightRailTab: vi.fn(),
    showMobileSheet: vi.fn()
  }
})

vi.mock('@vueuse/core', () => ({ useMediaQuery: mocks.useMediaQuery }))
vi.mock('@/composables/useStudentData', () => ({
  useStudentData: () => ({ students: mocks.ref([]), selectedStudentId: mocks.selectedStudentId })
}))
vi.mock('@/composables/useEditMode', () => ({
  useEditMode: () => ({
    currentMode: mocks.ref('normal'),
    firstSelectedSeat: mocks.ref(null),
    EditMode: { NORMAL: 'normal', EMPTY_EDIT: 'empty_edit', SWAP: 'swap', CLEAR: 'clear', ZONE_EDIT: 'zone_edit' }
  })
}))
vi.mock('@/composables/useZoneData', () => ({
  useZoneData: () => ({
    visibleZoneSeats: mocks.ref(new Map()),
    selectedZoneId: mocks.ref(null),
    toggleSeatInZone: vi.fn()
  })
}))
vi.mock('@/composables/useZoneRotation', () => ({
  useZoneRotation: () => ({
    editingZoneId: mocks.ref(null),
    getRotZoneHighlights: () => new Map(),
    toggleSeatInEditingZone: vi.fn()
  })
}))
vi.mock('@/composables/useUndo', () => ({ useUndo: () => ({ isHighlighted: () => false }) }))
vi.mock('@/composables/useDragState', () => ({
  useDragState: () => ({
    dragCleanupVersion: mocks.ref(0),
    startDragFromSeat: vi.fn(),
    endDragFromSeat: vi.fn(),
    startTouchDragFromSeat: vi.fn(),
    endTouchDragFromSeat: vi.fn()
  })
}))
vi.mock('@/composables/useSelection', () => ({
  useSelection: () => ({
    selectedSeatIds: mocks.selectedSeatIds,
    selectedSeatsArray: mocks.ref([]),
    isDraggingSelection: mocks.ref(false),
    startDraggingSelection: vi.fn(),
    endDraggingSelection: vi.fn(),
    isSelectionMode: mocks.ref(false),
    addSeatToSelection: vi.fn(),
    toggleSeatInSelection: vi.fn(),
    selectSingleSeat: mocks.selectSingleSeat,
    clearSelection: vi.fn(),
    consumeContextSelectionSuppression: () => false
  })
}))
vi.mock('@/composables/useDragPreview', () => ({
  useDragPreview: () => ({
    startDragPreview: vi.fn(),
    updateDragPreview: vi.fn(),
    endDragPreview: vi.fn(),
    isGhostSeat: () => false
  })
}))
vi.mock('@/composables/useGlobalSettings', () => ({
  useGlobalSettings: () => ({ settings: mocks.ref({ editor: { doubleClickAction: 'edit' } }) })
}))
vi.mock('@/composables/useEditorWorkbench', () => ({
  useEditorWorkbench: () => ({
    setRightRailTab: mocks.setRightRailTab,
    showMobileSheet: mocks.showMobileSheet,
    openMobileDrawerForDrag: vi.fn(),
    restoreMobileDrawerOpenedForDrag: vi.fn(),
    isSeatFullscreen: mocks.ref(false)
  })
}))
vi.mock('@/composables/useZoom', () => ({
  useZoom: () => ({ panX: mocks.ref(0), panY: mocks.ref(0), setPan: vi.fn() })
}))

const regularSeat = {
  id: 'seat-0-0-0',
  groupIndex: 0,
  columnIndex: 0,
  rowIndex: 0,
  studentId: null,
  isEmpty: false
}

describe('SeatItem keyboard accessibility', () => {
  beforeEach(() => {
    mocks.selectedStudentId.value = null
    mocks.selectedSeatIds.value = new Set()
    mocks.isMobileWorkbench.value = false
    vi.clearAllMocks()
  })

  it('focuses and activates a regular seat with Enter', async () => {
    const wrapper = shallowMount(SeatItem, { props: { seat: regularSeat } })

    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('aria-label')).toContain('第 1 组，第 1 列，第 1 行，空位')

    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(mocks.selectSingleSeat).toHaveBeenCalledWith('seat-0-0-0')
    expect(mocks.setRightRailTab).toHaveBeenCalledWith('selection')
  })

  it('does not advertise an unavailable guard seat as actionable', async () => {
    const wrapper = shallowMount(SeatItem, {
      props: { seat: { ...regularSeat, id: 'guard-left', kind: 'guard' as const, guardSide: 'left' as const } }
    })

    expect(wrapper.attributes('tabindex')).toBe('-1')
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.attributes('aria-label')).toContain('左护法，空位')

    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(mocks.selectSingleSeat).not.toHaveBeenCalled()
  })

  it('uses the mobile workbench behavior through 1024px', async () => {
    mocks.isMobileWorkbench.value = true
    const wrapper = shallowMount(SeatItem, { props: { seat: regularSeat } })

    expect(mocks.useMediaQuery).toHaveBeenCalledWith(mobileWorkbenchMediaQuery)
    expect(wrapper.attributes('tabindex')).toBe('-1')

    await wrapper.trigger('contextmenu')
    expect(mocks.selectSingleSeat).toHaveBeenCalledWith('seat-0-0-0')
    expect(mocks.showMobileSheet).toHaveBeenCalledWith('context')
  })
})
