import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../useStudentData', () => {
  const students = { value: [] as Array<Record<string, unknown>> }
  const selectedStudentId = { value: null as number | null }
  let nextStudentId = 1

  const clearAllStudents = () => {
    students.value = []
    selectedStudentId.value = null
    nextStudentId = 1
  }

  const addStudent = () => {
    const id = nextStudentId++
    students.value.push({
      id,
      name: '',
      studentNumber: null,
      tags: [],
      numericAttributes: {}
    })
    return id
  }

  const updateStudent = (id: number, updates: Record<string, unknown>) => {
    if (updates.name === '触发写入失败') {
      throw new Error('模拟写入失败')
    }
    const student = students.value.find(item => item.id === id)
    if (student) Object.assign(student, updates)
  }

  const syncStudentIdCounter = () => {
    nextStudentId = students.value.length > 0
      ? Math.max(...students.value.map(student => Number(student.id))) + 1
      : 1
  }

  const replaceStudentData = (nextStudents: Array<Record<string, unknown>>) => {
    students.value = nextStudents.map(student => ({
      ...student,
      tags: [...((student.tags as number[] | undefined) || [])],
      numericAttributes: { ...((student.numericAttributes as Record<string, unknown> | undefined) || {}) }
    }))
    syncStudentIdCounter()
  }

  return {
    useStudentData: () => ({
      students,
      selectedStudentId,
      clearAllStudents,
      replaceStudentData,
      addStudent,
      updateStudent,
      syncStudentIdCounter
    })
  }
})

import { useSeatChart } from '../useSeatChart'
import { useStudentData } from '../useStudentData'
import { useTagData } from '../useTagData'
import { useUndo } from '../useUndo'
import { useWorkspace } from '../useWorkspace'
import { useZoneData } from '../useZoneData'

const createWorkspace = (studentName: string) => ({
  meta: {
    version: '2.2',
    app: 'SeatingChartEditor',
    createdAt: '2026-07-15T00:00:00.000Z'
  },
  students: [{ id: 10, name: studentName, studentNumber: 10, tags: [], numericAttributes: {} }],
  studentAttributeDefinitions: [],
  studentAttributeSettings: { showNumericAttributesInEditor: true },
  tags: [],
  tagSettings: { showTagsInSeatChart: true, tagDisplayMode: 'dot' },
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
      studentId: 10,
      empty: false
    }]
  },
  zones: [],
  rules: [],
  exportSettings: {}
})

describe('workspace rollback', () => {
  beforeEach(() => {
    const studentData = useStudentData()
    studentData.clearAllStudents()
    useTagData().clearAllTags()
    useZoneData().clearAllZones()
    useSeatChart().clearAllSeats()
    useUndo().clearHistory()
    const id = studentData.addStudent()
    studentData.updateStudent(id, {
      name: '原工作区学生',
      studentNumber: 1,
      tags: [],
      numericAttributes: {}
    })
  })

  it('restores the previous workspace when a validated import fails during commit', async () => {
    const workspace = useWorkspace()
    const result = await workspace.applyWorkspaceData(createWorkspace('触发写入失败'))

    expect(result).toBe(false)
    expect(useStudentData().students.value).toEqual([
      expect.objectContaining({
        id: 1,
        name: '原工作区学生',
        studentNumber: 1
      })
    ])
  })

  it('preserves non-contiguous IDs, selections and undo references during rollback', async () => {
    const studentData = useStudentData()
    const tagData = useTagData()
    const zoneData = useZoneData()
    const seatChart = useSeatChart()
    const undo = useUndo()
    studentData.replaceStudentData([
      { id: 4, name: '学生甲', studentNumber: 4, tags: [91], numericAttributes: {} },
      { id: 41, name: '学生乙', studentNumber: 41, tags: [7], numericAttributes: {} }
    ])
    tagData.replaceTagData([
      { id: 7, name: '标签甲', color: '#336699', showInSeatChart: true },
      { id: 91, name: '标签乙', color: '#663399', showInSeatChart: true }
    ])
    zoneData.replaceZoneData([{
      id: 77,
      name: '原选区',
      tagIds: [91],
      seatIds: ['seat-0-0-0'],
      visible: true
    }])
    studentData.selectedStudentId.value = 41
    zoneData.selectedZoneId.value = 77
    seatChart.assignStudent('seat-0-0-0', 41, false)
    undo.recordAssign('seat-0-0-0', 41, null)
    const undoBefore = JSON.parse(JSON.stringify(undo.undoStack.value))

    const result = await useWorkspace().applyWorkspaceData(createWorkspace('触发写入失败'))

    expect(result).toBe(false)
    expect(studentData.students.value.map(student => student.id)).toEqual([4, 41])
    expect(tagData.tags.value.map(tag => tag.id)).toEqual([7, 91])
    expect(zoneData.zones.value.map(zone => zone.id)).toEqual([77])
    expect(studentData.selectedStudentId.value).toBe(41)
    expect(zoneData.selectedZoneId.value).toBe(77)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(41)
    expect(undo.undoStack.value).toEqual(undoBefore)
    expect(studentData.addStudent()).toBe(42)
    expect(tagData.addTag({ name: '后续标签' })).toBe(92)
    expect(zoneData.addZone()).toBe(78)
  })
})
