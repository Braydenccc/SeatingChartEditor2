import { beforeEach, describe, expect, it } from 'vitest'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'
import { useTagData, initializeTags } from '../useTagData'
import { useSeatChart } from '../useSeatChart'
import { useSeatRules } from '../useSeatRules'
import { useWorkspace } from '../useWorkspace'
import { useZoneData } from '../useZoneData'
import { useZoneRotation } from '../useZoneRotation'

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
  let studentData: ReturnType<typeof useStudentData>
  let attributes: ReturnType<typeof useStudentAttributes>
  let tagData: ReturnType<typeof useTagData>
  let seatChart: ReturnType<typeof useSeatChart>
  let workspace: ReturnType<typeof useWorkspace>

  beforeEach(() => {
    studentData = useStudentData()
    studentData.clearAllStudents()
    attributes = useStudentAttributes()
    tagData = useTagData()
    seatChart = useSeatChart()
    workspace = useWorkspace()
    attributes.replaceAttributeDefinitions()
    tagData.clearAllTags()
    useSeatRules().clearAllRules()
    useZoneData().clearAllZones()
    useZoneRotation().resetRotationData()
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
    const source = createRecentCloudWorkspaceWithoutMeta()
    const result = await workspace.applyWorkspaceData(source)

    expect(result).toBe(true)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(1)
    expect(seatChart.getStudentAtSeat('seat-0-0-1')).toBe(2)
    expect(source).not.toHaveProperty('meta')
    expect(source.layout.config).not.toHaveProperty('groups')
  })

  it('rejects malformed workspace data before changing the current workspace', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '保留学生', studentNumber: 12 })
    seatChart.assignStudent('seat-0-0-0', studentId, false)

    const malformedWorkspace = {
      ...createExistingWorkspace(),
      tags: [{ id: 1, name: '缺少颜色' }]
    }
    const result = await workspace.applyWorkspaceData(malformedWorkspace)

    expect(result).toBe(false)
    expect(studentData.students.value).toHaveLength(1)
    expect(studentData.students.value[0]).toMatchObject({ name: '保留学生', studentNumber: 12 })
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(studentId)
  })

  it('clears seat assignments when creating a new workspace', () => {
    seatChart.assignStudent('seat-0-0-0', 1, false)

    const result = workspace.createNewWorkspace()

    expect(result).toBe(true)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(null)
  })

  it('round-trips rotation groups with stable IDs', async () => {
    const source = {
      ...createRecentCloudWorkspaceWithoutMeta(),
      meta: {
        version: '2.3',
        app: 'SeatingChartEditor',
        createdAt: '2026-07-23T00:00:00.000Z'
      },
      rotationGroups: [{
        id: 41,
        name: '前后轮换',
        type: 'cycle',
        zones: [
          { id: 51, name: '前区', seatIds: ['seat-0-0-0'] },
          { id: 52, name: '后区', seatIds: ['seat-0-0-1'] }
        ]
      }]
    }

    expect(await workspace.applyWorkspaceData(source)).toBe(true)
    expect(useZoneRotation().getRotationData()).toEqual(source.rotationGroups)

    const serialized = JSON.parse(workspace.getWorkspaceJson() || '{}')
    expect(serialized.meta.version).toBe('2.3')
    expect(serialized.rotationGroups).toEqual(source.rotationGroups)
  })

  it('clears rotation state when the next workspace has no rotation data', async () => {
    const sourceWithRotation = {
      ...createRecentCloudWorkspaceWithoutMeta(),
      rotationGroups: [{
        id: 1,
        name: '临时轮换',
        type: 'swap',
        zones: [
          { id: 1, name: '左侧', seatIds: ['seat-0-0-0'] },
          { id: 2, name: '右侧', seatIds: ['seat-0-0-1'] }
        ]
      }]
    }

    expect(await workspace.applyWorkspaceData(sourceWithRotation)).toBe(true)
    expect(useZoneRotation().getRotationData()).toHaveLength(1)
    expect(await workspace.applyWorkspaceData(createRecentCloudWorkspaceWithoutMeta())).toBe(true)
    expect(useZoneRotation().getRotationData()).toEqual([])
  })

  it('remaps string identifiers across assignments, tags, zones and rules', async () => {
    const source = {
      meta: {
        version: '2.3',
        app: 'SeatingChartEditor',
        createdAt: '2026-07-23T00:00:00.000Z'
      },
      students: [{
        id: 'student-a',
        name: '字符串学生',
        studentNumber: 1,
        tags: ['tag-a'],
        numericAttributes: {}
      }],
      tags: [{
        id: 'tag-a',
        name: '字符串标签',
        color: '#336699',
        showInSeatChart: true
      }],
      layout: {
        config: {
          groupCount: 1,
          columnsPerGroup: 1,
          seatsPerColumn: 1,
          groups: [{ columns: 1, rows: 1 }],
          shiftDistance: 1,
          podiumPosition: 'bottom',
          guardSeats: {
            enabled: false,
            leftEnabled: false,
            rightEnabled: false,
            includeInAutoAssignment: false,
            hideEmptyOnExport: true
          }
        },
        seats: [{
          id: 'seat-0-0-0',
          kind: 'regular',
          group: 0,
          col: 0,
          row: 0,
          studentId: 'student-a',
          empty: false
        }]
      },
      zones: [{
        id: 'zone-a',
        name: '字符串选区',
        tagIds: ['tag-a'],
        seatIds: ['seat-0-0-0'],
        visible: true
      }],
      rules: [{
        enabled: true,
        priority: 'required',
        subjects: [
          { type: 'person', id: 'student-a' },
          { type: 'tag', id: 'tag-a' }
        ],
        predicate: 'IN_ZONE',
        params: { zoneId: 'zone-a', tagId: 'tag-a' },
        description: '字符串引用规则'
      }],
      exportSettings: {}
    }

    expect(await workspace.applyWorkspaceData(source)).toBe(true)

    const runtimeStudent = studentData.students.value[0]
    const runtimeTag = tagData.tags.value[0]
    const runtimeZone = useZoneData().zones.value[0]
    const runtimeRule = useSeatRules().rules.value[0]
    expect(runtimeStudent.tags).toEqual([runtimeTag.id])
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(runtimeStudent.id)
    expect(runtimeZone.tagIds).toEqual([runtimeTag.id])
    expect(runtimeRule.subjects).toEqual([
      { type: 'person', id: runtimeStudent.id },
      { type: 'tag', id: runtimeTag.id }
    ])
    expect(runtimeRule.params).toMatchObject({
      zoneId: runtimeZone.id,
      tagId: runtimeTag.id
    })
  })

  it('keeps references distinct for tags with identical names and colors', async () => {
    const source = {
      ...createRecentCloudWorkspaceWithoutMeta(),
      students: [
        { id: 8, name: '学生甲', studentNumber: 1, tags: ['tag-a'] },
        { id: 9, name: '学生乙', studentNumber: 2, tags: ['tag-b'] }
      ],
      tags: [
        { id: 'tag-a', name: '同名标签', color: '#336699', showInSeatChart: true },
        { id: 'tag-b', name: '同名标签', color: '#336699', showInSeatChart: true }
      ]
    }

    expect(await workspace.applyWorkspaceData(source)).toBe(true)

    expect(tagData.tags.value).toHaveLength(2)
    expect(tagData.tags.value[0].id).not.toBe(tagData.tags.value[1].id)
    expect(studentData.students.value[0].tags).toEqual([tagData.tags.value[0].id])
    expect(studentData.students.value[1].tags).toEqual([tagData.tags.value[1].id])
  })

  it('rejects future workspace versions without mutating runtime state', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '保留学生', studentNumber: 7 })
    seatChart.assignStudent('seat-0-0-0', studentId, false)
    useZoneRotation().replaceRotationData([{
      id: 7,
      name: '保留轮换',
      type: 'cycle',
      zones: [
        { id: 8, name: '一区', seatIds: ['seat-0-0-0'] },
        { id: 9, name: '二区', seatIds: ['seat-0-0-1'] }
      ]
    }])
    const studentsBefore = JSON.parse(JSON.stringify(studentData.students.value))
    const rotationBefore = useZoneRotation().getRotationData()

    const futureWorkspace = createExistingWorkspace()
    futureWorkspace.meta.version = '99.0'
    expect(await workspace.applyWorkspaceData(futureWorkspace)).toBe(false)

    expect(studentData.students.value).toEqual(studentsBefore)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(studentId)
    expect(useZoneRotation().getRotationData()).toEqual(rotationBefore)
  })

  it('rejects dangling rule subjects before mutating runtime state', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '原工作区学生', studentNumber: 3 })
    seatChart.assignStudent('seat-0-0-0', studentId, false)
    const invalidWorkspace = {
      ...createExistingWorkspace(),
      rules: [{
        enabled: true,
        priority: 'required',
        subjects: [{ type: 'person', id: 999 }],
        predicate: 'IN_ROW_RANGE',
        params: { minRow: 1, maxRow: 2 }
      }]
    }

    expect(await workspace.applyWorkspaceData(invalidWorkspace)).toBe(false)
    expect(studentData.students.value).toEqual([
      expect.objectContaining({ id: studentId, name: '原工作区学生' })
    ])
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(studentId)
  })
})
