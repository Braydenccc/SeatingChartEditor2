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

  return {
    useStudentData: () => ({
      students,
      selectedStudentId,
      clearAllStudents,
      addStudent,
      updateStudent,
      syncStudentIdCounter: vi.fn()
    })
  }
})

import { useStudentData } from '../useStudentData'
import { useWorkspace } from '../useWorkspace'

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
})
