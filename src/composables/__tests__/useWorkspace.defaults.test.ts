import { beforeEach, describe, expect, it } from 'vitest'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'
import { useTagData, initializeTags } from '../useTagData'
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

describe('workspace defaults', () => {
  let attributes: ReturnType<typeof useStudentAttributes>
  let tagData: ReturnType<typeof useTagData>
  let workspace: ReturnType<typeof useWorkspace>

  beforeEach(() => {
    useStudentData().clearAllStudents()
    attributes = useStudentAttributes()
    tagData = useTagData()
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
})
