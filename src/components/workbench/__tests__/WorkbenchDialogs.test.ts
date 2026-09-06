import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkbenchDialogs from '../WorkbenchDialogs.vue'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useSeatChart } from '@/composables/useSeatChart'
import * as uiFeedback from '@/services/uiFeedback'

const advancedConfig = {
  groupCount: 2,
  columnsPerGroup: 3,
  seatsPerColumn: 6,
  groups: [{ columns: 3, rows: 6 }, { columns: 2, rows: 5 }],
  podiumPosition: 'top' as const
}

const SeatConfigDialogStub = defineComponent({
  name: 'SeatConfigDialog',
  props: {
    visible: Boolean,
    initialConfig: Object
  },
  emits: ['update:visible', 'confirm'],
  setup(_props, { emit }) {
    return () => h('button', {
      class: 'confirm-seat-config',
      onClick: () => emit('confirm', advancedConfig)
    }, '应用配置')
  }
})

const workbench = useEditorWorkbench()
const seatChart = useSeatChart()

const resetSeatConfig = () => {
  seatChart.updateConfig({
    groupCount: 4,
    columnsPerGroup: 2,
    seatsPerColumn: 7,
    groups: Array.from({ length: 4 }, () => ({ columns: 2, rows: 7 })),
    shiftDistance: 0,
    podiumPosition: 'bottom',
    guardSeats: {
      enabled: true,
      leftEnabled: true,
      rightEnabled: true,
      includeInAutoAssignment: false,
      hideEmptyOnExport: true
    }
  })
}

describe('WorkbenchDialogs', () => {
  beforeEach(() => {
    resetSeatConfig()
    workbench.closeDialog()
  })

  afterEach(() => {
    resetSeatConfig()
    workbench.closeDialog()
    vi.restoreAllMocks()
  })

  it('merges advanced layout changes onto the transferred basic draft', async () => {
    const confirmSpy = vi.spyOn(uiFeedback, 'requestUiConfirm').mockResolvedValue(true)
    const initialConfig = {
      groupCount: 2,
      columnsPerGroup: 2,
      seatsPerColumn: 7,
      groups: [{ columns: 2, rows: 7 }, { columns: 2, rows: 7 }],
      shiftDistance: 6,
      podiumPosition: 'bottom' as const,
      guardSeats: {
        enabled: true,
        leftEnabled: false,
        rightEnabled: true,
        includeInAutoAssignment: true,
        hideEmptyOnExport: false
      }
    }
    workbench.openDialog('seatConfig', { seatConfig: initialConfig })
    const wrapper = mount(WorkbenchDialogs, {
      global: {
        stubs: { SeatConfigDialog: SeatConfigDialogStub }
      }
    })

    expect(wrapper.getComponent(SeatConfigDialogStub).props('initialConfig')).toEqual(initialConfig)
    await wrapper.get('.confirm-seat-config').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringMatching(/保留兼容座位的状态.*清空撤销\/重做历史/)
    }))
    expect(seatChart.seatConfig.value).toMatchObject({
      ...advancedConfig,
      shiftDistance: 6,
      guardSeats: initialConfig.guardSeats
    })
    expect(workbench.activeWorkbenchDialog.value).toBeNull()
    expect(workbench.seatConfigDialogInitialConfig.value).toBeNull()

    wrapper.unmount()
  })
})
