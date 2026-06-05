import { describe, it, beforeEach } from 'vitest'
import { useAssignment } from '../src/composables/useAssignment'
import { useSeatChart } from '../src/composables/useSeatChart'
import { useSeatRules } from '../src/composables/useSeatRules'
import { useStudentData } from '../src/composables/useStudentData'
import { useTagData } from '../src/composables/useTagData'
import { useZoneData } from '../src/composables/useZoneData'

const maybeDescribe = process.env.RUN_ASSIGNMENT_BENCHMARK === '1' ? describe : describe.skip

const setupSeats = (seatChart, studentCount) => {
  const rows = Math.max(6, Math.ceil(studentCount / 8))
  seatChart.updateConfig({
    groupCount: 4,
    columnsPerGroup: 2,
    seatsPerColumn: rows,
    groups: [
      { columns: 2, rows },
      { columns: 2, rows },
      { columns: 2, rows },
      { columns: 2, rows }
    ],
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

const setupStudents = (studentData, count, tagIds) => {
  const ids = []
  for (let i = 0; i < count; i++) {
    const id = studentData.addStudent()
    ids.push(id)
    studentData.updateStudent(id, {
      name: `学生${i + 1}`,
      studentNumber: i + 1,
      tags: i % 5 === 0 ? [tagIds.focus] : (i % 7 === 0 ? [tagIds.separate] : []),
      numericAttributes: {
        height: 140 + (i % 35),
        score: 60 + ((i * 7) % 40)
      }
    })
  }
  return ids
}

const setupRules = (seatRules, ids, tagIds) => {
  seatRules.addRule({
    predicate: 'IN_ROW_RANGE',
    priority: 'required',
    enabled: true,
    subjects: ids.slice(0, 6).map(id => ({ type: 'person', id })),
    params: { minRow: 1, maxRow: 3 }
  })

  seatRules.addRule({
    predicate: 'DISTRIBUTE_EVENLY',
    priority: 'prefer',
    enabled: true,
    subjects: [{ type: 'tag', id: tagIds.separate }],
    params: {}
  })

  seatRules.addRule({
    predicate: 'CLUSTER_TOGETHER',
    priority: 'prefer',
    enabled: true,
    subjects: [{ type: 'tag', id: tagIds.focus }],
    params: { scope: 'group' }
  })

  seatRules.addRule({
    predicate: 'ATTRIBUTE_ROW_GRADIENT',
    priority: 'prefer',
    enabled: true,
    subjects: [{ type: 'all' }],
    params: { attributeId: 'height', direction: 'lowFront' }
  })

  seatRules.addRule({
    predicate: 'ATTRIBUTE_GROUP_BALANCE',
    priority: 'prefer',
    enabled: true,
    subjects: [{ type: 'all' }],
    params: { attributeId: 'score', aggregate: 'average' }
  })

  for (let i = 0; i < Math.min(8, ids.length - 1); i += 2) {
    seatRules.addRule({
      predicate: 'DISTANCE_AT_LEAST',
      priority: 'required',
      enabled: true,
      subjects: [
        { type: 'person', id: ids[i] },
        { type: 'person', id: ids[i + 1] }
      ],
      params: { distance: 2 }
    })
  }
}

maybeDescribe('assignment performance benchmark', () => {
  let studentData
  let seatChart
  let seatRules
  let tagData
  let zoneData
  let assignment

  beforeEach(() => {
    studentData = useStudentData()
    seatChart = useSeatChart()
    seatRules = useSeatRules()
    tagData = useTagData()
    zoneData = useZoneData()
    assignment = useAssignment()

    studentData.clearAllStudents()
    seatChart.clearAllSeats()
    seatRules.clearAllRules()
    tagData.clearAllTags()
    zoneData.clearAllZones()
  })

  it('records assignment duration across class sizes', async () => {
    const rows = []
    for (const studentCount of [30, 50, 80]) {
      setupSeats(seatChart, studentCount)
      const tagIds = {
        focus: tagData.addTag({ name: '需关注' }),
        separate: tagData.addTag({ name: '需分散' })
      }
      const ids = setupStudents(studentData, studentCount, tagIds)
      setupRules(seatRules, ids, tagIds)

      const result = await assignment.runSmartAssignment({
        useRules: true,
        iterations: 10000
      })

      rows.push({
        students: studentCount,
        success: result.success,
        durationMs: result.duration,
        satRate: result.satRate,
        score: result.score
      })

      studentData.clearAllStudents()
      seatChart.clearAllSeats()
      seatRules.clearAllRules()
      tagData.clearAllTags()
      zoneData.clearAllZones()
    }

    console.table(rows)
  })
})
