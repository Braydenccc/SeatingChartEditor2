import { nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssignmentWorkbenchDialog from '../AssignmentWorkbenchDialog.vue'
import assignmentWorkbenchSource from '../AssignmentWorkbenchDialog.vue?raw'
import {
  assignmentWorkbenchCompactMaxWidth,
  assignmentWorkbenchCompactMediaQuery
} from '@/constants/layout'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    isCompactLayout: ref(true),
    useMediaQuery: vi.fn(),
    students: ref([]),
    seats: ref([]),
    seatConfig: ref({ guardSeats: { includeInAutoAssignment: false } }),
    zones: ref([]),
    rules: ref([]),
    ruleCount: ref(0),
    isAssigning: ref(false),
    isAssignmentCancelRequested: ref(false),
    assignmentProgress: ref(0),
    assignmentIterationInfo: ref({ i: 0, bestScore: null })
  }
})

vi.mock('@vueuse/core', () => ({ useMediaQuery: mocks.useMediaQuery }))
vi.mock('@/composables/useStudentData', () => ({ useStudentData: () => ({ students: mocks.students }) }))
vi.mock('@/composables/useSeatChart', () => ({
  useSeatChart: () => ({
    seats: mocks.seats,
    seatConfig: mocks.seatConfig,
    getAvailableSeats: vi.fn(() => []),
    isInRowRange: vi.fn(),
    isColumnType: vi.fn()
  })
}))
vi.mock('@/composables/useZoneData', () => ({ useZoneData: () => ({ zones: mocks.zones }) }))
vi.mock('@/composables/useSeatRules', () => ({
  useSeatRules: () => ({
    rules: mocks.rules,
    ruleCount: mocks.ruleCount,
    getActiveRules: vi.fn(() => []),
    detectConflicts: vi.fn(() => []),
    renderRuleText: vi.fn(() => ''),
    exportRules: vi.fn(() => '{}'),
    importRules: vi.fn()
  })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() })
}))
vi.mock('@/composables/useAssignment', () => ({
  useAssignment: () => ({
    isAssigning: mocks.isAssigning,
    isAssignmentCancelRequested: mocks.isAssignmentCancelRequested,
    assignmentProgress: mocks.assignmentProgress,
    assignmentIterationInfo: mocks.assignmentIterationInfo,
    runSmartAssignment: vi.fn(),
    cancelSmartAssignment: vi.fn()
  })
}))

describe('AssignmentWorkbenchDialog responsive layout contract', () => {
  beforeEach(() => {
    mocks.isCompactLayout.value = true
    mocks.useMediaQuery.mockImplementation(() => mocks.isCompactLayout)
  })

  it('uses the shared 900px query to drive both dialog and footer compact layouts', async () => {
    expect(assignmentWorkbenchCompactMaxWidth).toBe(900)
    expect(assignmentWorkbenchCompactMediaQuery).toBe('(max-width: 900px)')

    const wrapper = shallowMount(AssignmentWorkbenchDialog, {
      props: { visible: true },
      global: {
        stubs: {
          ResponsiveOverlay: {
            props: ['show', 'title', 'desktopWidth', 'mobileHeight'],
            template: '<div><slot /><slot name="footer" /></div>'
          }
        }
      }
    })

    expect(mocks.useMediaQuery).toHaveBeenCalledWith(assignmentWorkbenchCompactMediaQuery)
    expect(wrapper.get('.workbench-dialog').classes()).toContain('compact-layout')
    expect(wrapper.get('.dialog-footer').classes()).toContain('compact-layout')

    mocks.isCompactLayout.value = false
    await nextTick()

    expect(wrapper.get('.workbench-dialog').classes()).not.toContain('compact-layout')
    expect(wrapper.get('.dialog-footer').classes()).not.toContain('compact-layout')
    wrapper.unmount()
  })

  it('keeps the single-pane CSS attached to the compact class instead of a second breakpoint', () => {
    expect(assignmentWorkbenchSource).toContain('.workbench-dialog.compact-layout .rule-workbench')
    expect(assignmentWorkbenchSource).toContain('.dialog-footer.compact-layout')
    expect(assignmentWorkbenchSource).not.toContain('@media (max-width: 720px)')
  })
})
