import { beforeEach, describe, expect, it } from 'vitest'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'
import { useTagData, initializeTags } from '../useTagData'
import { useSeatChart } from '../useSeatChart'
import { useWorkspace } from '../useWorkspace'

const createExistingWorkspace = () => ({
  meta: {
    version: '2.2',
    app: 'SeatingChartEditor',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  students: [],
  tags: [],
  layout: {
    config: {
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
      podiumPosition: 'bottom'
    },
    seats: []
  },
  zones: [],
  rules: [],
  exportSettings: {}
})

const createRecentCloudWorkspaceWithoutMeta = () => ({
  students: [
    { id: 8, name: '张三', studentNumber: 1, tags: [] },
    { id: 9, name: '李四', studentNumber: 2, tags: [] }
  ],
  tags: [],
  layout: {
    config: {
      groupCount: 4,
      columnsPerGroup: 2,
      seatsPerColumn: 7,
      shiftDistance: 4,
      podiumPosition: 'bottom'
    },
    seats: [
      { id: 'seat-0-0-0', group: 0, col: 0, row: 0, studentId: 8, empty: false },
      { id: 'seat-0-0-1', group: 0, col: 0, row: 1, studentId: 9, empty: false }
    ]
  },
  zones: [],
  rules: [],
  exportSettings: {}
})

describe('workspace defaults', () => {
  let attributes: ReturnType<typeof useStudentAttributes>
  let tagData: ReturnType<typeof useTagData>
  let seatChart: ReturnType<typeof useSeatChart>
  let workspace: ReturnType<typeof useWorkspace>

  beforeEach(() => {
    useStudentData().clearAllStudents()
    attributes = useStudentAttributes()
    tagData = useTagData()
    seatChart = useSeatChart()
    workspace = useWorkspace()
    attributes.replaceAttributeDefinitions()
    tagData.clearAllTags()
  })

  it('initializes default tags for a new blank workspace', () => {
    initializeTags()

    expect(tagData.tags.value.map(tag => tag.name)).toEqual(['住宿', '午休', '晚修'])
  })

  it('does not add default attributes or tags when applying an existing workspace', async () => {
    initializeTags()

    const result = await workspace.applyWorkspaceData(createExistingWorkspace())

    expect(result).toBe(true)
    expect(attributes.attributeDefinitions.value).toEqual([])
    expect(tagData.tags.value).toEqual([])
  })

  it('preserves seat assignments for recent cloud workspaces without meta version', async () => {
    const result = await workspace.applyWorkspaceData(createRecentCloudWorkspaceWithoutMeta())

    expect(result).toBe(true)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(1)
    expect(seatChart.getStudentAtSeat('seat-0-0-1')).toBe(2)
  })

  it('clears seat assignments when creating a new workspace', () => {
    seatChart.assignStudent('seat-0-0-0', 1, false)

    const result = workspace.createNewWorkspace()

    expect(result).toBe(true)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(null)
  })
})
