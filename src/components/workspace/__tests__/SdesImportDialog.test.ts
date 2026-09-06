import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SdesImportDialog from '../SdesImportDialog.vue'
import { useExportSettings } from '@/composables/useExportSettings'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import type { SdesImportTarget } from '@/composables/useSdesExchange'
import type { SeatConfig } from '@/types/models'

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ confirm: confirmMock })
}))

const target: SdesImportTarget = {
  id: 'class-1:chart-1',
  classIndex: 0,
  seatChartIndex: 0,
  classId: 'class-1',
  className: '一班',
  chartId: 'chart-1',
  chartName: '默认座位表',
  layoutModel: 'groupedColumns',
  studentCount: 2,
  seatCount: 2,
  assignmentCount: 2,
  warnings: []
}

const defaultSeatConfig: SeatConfig = {
  groupCount: 4,
  columnsPerGroup: 2,
  seatsPerColumn: 7,
  groups: [
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 }
  ],
  shiftDistance: 4,
  podiumPosition: 'bottom',
  guardSeats: {
    enabled: true,
    leftEnabled: true,
    rightEnabled: true,
    includeInAutoAssignment: false,
    hideEmptyOnExport: true
  }
}

const mountDialog = async () => {
  const wrapper = mount(SdesImportDialog, {
    global: {
      stubs: {
        ResponsiveOverlay: {
          template: '<div><slot /><slot name="footer" /></div>',
          props: ['show', 'title', 'busy', 'desktopWidth']
        }
      }
    },
    props: {
      visible: false,
      fileName: 'sample.sdes.json',
      targets: [target],
      isImporting: false
    }
  })
  await wrapper.setProps({ visible: true })
  return wrapper
}

describe('SdesImportDialog', () => {
  beforeEach(() => {
    useStudentData().clearAllStudents()
    useTagData().clearAllTags()
    useZoneData().clearAllZones()
    useSeatRules().clearAllRules()
    useExportSettings().resetExportSettings()
    useStudentAttributes().replaceAttributeDefinitions()
    useStudentAttributes().setShowNumericAttributesInEditor(true)
    useSeatChart().updateConfig(defaultSeatConfig)
    useSeatChart().clearAllSeats()
    confirmMock.mockReset()
    confirmMock.mockResolvedValue(true)
  })

  it('renders import targets and emits the selected target for a blank workspace', async () => {
    const wrapper = await mountDialog()

    expect(wrapper.text()).toContain('一班 / 默认座位表')
    expect(wrapper.text()).toContain('2 名学生')

    await wrapper.get('[aria-label="导入所选座位表"]').trigger('click')

    expect(wrapper.emitted('import')).toEqual([[target]])
  })

  it('requires explicit confirmation before overwriting existing data', async () => {
    const studentData = useStudentData()
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '现有学生' })
    const wrapper = await mountDialog()

    await wrapper.get('[aria-label="导入所选座位表"]').trigger('click')
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: '覆盖当前工作区' }))
    expect(wrapper.emitted('import')).toEqual([[target]])
  })
})
