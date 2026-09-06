import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NInputNumber } from 'naive-ui'
import SeatConfigPanel from '../SeatConfigPanel.vue'
import { maxSeatGroupCount } from '@/constants/seatConfig'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useSeatChart } from '@/composables/useSeatChart'
import * as uiFeedback from '@/services/uiFeedback'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn().mockResolvedValue(undefined) })
}))

const seatChart = useSeatChart()
const workbench = useEditorWorkbench()
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

describe('SeatConfigPanel', () => {
  beforeEach(() => {
    resetSeatConfig()
    workbench.closeDialog()
  })
  afterEach(() => {
    resetSeatConfig()
    workbench.closeDialog()
  })

  it('keeps layout changes in a draft until the user confirms apply', async () => {
    const confirmSpy = vi.spyOn(uiFeedback, 'requestUiConfirm').mockResolvedValue(true)
    const wrapper = mount(SeatConfigPanel)
    const groupCountInput = wrapper.findAllComponents(NInputNumber)[0]

    groupCountInput.vm.$emit('update:value', 3)
    await wrapper.vm.$nextTick()
    expect(seatChart.seatConfig.value.groupCount).toBe(4)

    const applyButton = wrapper.findAll('button').find(button => button.text().includes('应用配置'))
    expect(applyButton).toBeDefined()
    await applyButton!.trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(confirmSpy).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('清空撤销/重做历史')
    }))
    expect(seatChart.seatConfig.value.groupCount).toBe(3)
    expect(seatChart.seatConfig.value.groups).toHaveLength(3)

    wrapper.unmount()
    confirmSpy.mockRestore()
  })

  it('accepts 50 groups and carries the complete draft into advanced configuration', async () => {
    const wrapper = mount(SeatConfigPanel)
    const inputs = wrapper.findAllComponents(NInputNumber)
    const groupCountInput = inputs[0]

    expect(groupCountInput.props('max')).toBe(maxSeatGroupCount)
    groupCountInput.vm.$emit('update:value', maxSeatGroupCount)
    inputs[3].vm.$emit('update:value', 6)
    await wrapper.vm.$nextTick()

    expect(seatChart.seatConfig.value.groupCount).toBe(4)
    expect(seatChart.seatConfig.value.shiftDistance).toBe(0)

    await wrapper.find('.advanced-button').trigger('click')
    await flushPromises()

    expect(workbench.activeWorkbenchDialog.value).toBe('seatConfig')
    expect(workbench.seatConfigDialogInitialConfig.value).toMatchObject({
      groupCount: maxSeatGroupCount,
      columnsPerGroup: 2,
      seatsPerColumn: 7,
      shiftDistance: 6,
      podiumPosition: 'bottom',
      guardSeats: {
        enabled: true,
        leftEnabled: true,
        rightEnabled: true,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      }
    })
    expect(workbench.seatConfigDialogInitialConfig.value?.groups).toHaveLength(maxSeatGroupCount)

    wrapper.unmount()
  })
})
