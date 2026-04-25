import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'
import { useSeatChart } from '../useSeatChart'
import { useSeatRules } from '../useSeatRules'
import { useZoneData } from '../useZoneData'
import { useAssignment } from '../useAssignment'

describe('useAssignment - Conflict Rules', () => {
  let studentData, seatChart, seatRules, zoneData, assignment

  beforeEach(() => {
    studentData = useStudentData()
    seatChart = useSeatChart()
    seatRules = useSeatRules()
    zoneData = useZoneData()
    assignment = useAssignment()

    studentData.clearAllStudents()
    seatChart.clearAllSeats()
    seatRules.clearAllRules()
    zoneData.clearAllZones()
  })

  describe('Directly Conflicting Rules', () => {
    it('should handle MUST_BE_SEATMATES vs MUST_NOT_BE_SEATMATES conflict', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_NOT_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle MUST_BE_SAME_GROUP vs MUST_NOT_BE_SAME_GROUP conflict', async () => {
      seatChart.updateConfig({
        groupCount: 3,
        columnsPerGroup: 2,
        seatsPerColumn: 3,
        groups: [
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_NOT_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle DISTANCE_AT_LEAST vs DISTANCE_AT_MOST conflict', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'DISTANCE_AT_LEAST',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: { distance: 5 }
      })

      seatRules.addRule({
        predicate: 'DISTANCE_AT_MOST',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: { distance: 1 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle IN_ROW_RANGE conflict with limited seats', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 2,
        seatsPerColumn: 3,
        groups: [{ columns: 2, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] },
          { type: 'person', id: studentIds[2] }
        ],
        params: { minRow: 1, maxRow: 1 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })
  })

  describe('Indirectly Conflicting Rules', () => {
    it('should handle chain conflicts: A-B seatmates, B-C seatmates, A-C not seatmates', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[1] },
          { type: 'person', id: studentIds[2] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_NOT_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[2] }
        ],
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle group chain conflicts', async () => {
      seatChart.updateConfig({
        groupCount: 3,
        columnsPerGroup: 2,
        seatsPerColumn: 3,
        groups: [
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 5; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[1] },
          { type: 'person', id: studentIds[2] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_NOT_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[2] }
        ],
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle DISTRIBUTE_EVENLY vs CLUSTER_TOGETHER conflict', async () => {
      seatChart.updateConfig({
        groupCount: 2,
        columnsPerGroup: 3,
        seatsPerColumn: 3,
        groups: [
          { columns: 3, rows: 3 },
          { columns: 3, rows: 3 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'DISTRIBUTE_EVENLY',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: {}
      })

      seatRules.addRule({
        predicate: 'CLUSTER_TOGETHER',
        priority: 'prefer',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: { scope: 'group' }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 10000 })

      expect(result.success).toBe(true)
    })
  })

  describe('Overconstrained Scenarios', () => {
    it('should handle more students than available seats in row range', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 2,
        seatsPerColumn: 4,
        groups: [{ columns: 2, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

      for (const id of studentIds) {
        seatRules.addRule({
          predicate: 'IN_ROW_RANGE',
          priority: 'required',
          enabled: true,
          subjects: [{ type: 'person', id }],
          params: { minRow: 1, maxRow: 1 }
        })
      }

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle all students requiring same seat position', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 3; i++) {
        studentIds.push(studentData.addStudent())
      }

      for (const id of studentIds) {
        seatRules.addRule({
          predicate: 'IN_ROW_RANGE',
          priority: 'required',
          enabled: true,
          subjects: [{ type: 'person', id }],
          params: { minRow: 1, maxRow: 1 }
        })
        seatRules.addRule({
          predicate: 'IN_GROUP_RANGE',
          priority: 'required',
          enabled: true,
          subjects: [{ type: 'person', id }],
          params: { minGroup: 1, maxGroup: 1 }
        })
      }

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle conflicting distance requirements for multiple pairs', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 3,
        seatsPerColumn: 3,
        groups: [{ columns: 3, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

      for (let i = 0; i < studentIds.length; i++) {
        for (let j = i + 1; j < studentIds.length; j++) {
          seatRules.addRule({
            predicate: 'DISTANCE_AT_LEAST',
            priority: 'required',
            enabled: true,
            subjects: [
              { type: 'person', id: studentIds[i] },
              { type: 'person', id: studentIds[j] }
            ],
            params: { distance: 3 }
          })
        }
      }

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })
  })

  describe('Priority Resolution', () => {
    it('should resolve conflict by preferring required over prefer', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_NOT_BE_SEATMATES',
        priority: 'prefer',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0.rowIndex).toBe(seat1.rowIndex)
      expect(seat0.groupIndex).toBe(seat1.groupIndex)
    })

    it('should resolve conflict by preferring prefer over optional', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'DISTANCE_AT_LEAST',
        priority: 'prefer',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: { distance: 3 }
      })

      seatRules.addRule({
        predicate: 'DISTANCE_AT_MOST',
        priority: 'optional',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: { distance: 1 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle single student with multiple conflicting rules', async () => {
      seatChart.updateConfig({
        groupCount: 2,
        columnsPerGroup: 2,
        seatsPerColumn: 3,
        groups: [
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 }
        ]
      })

      const studentIds = [studentData.addStudent()]

      seatRules.addRule({
        predicate: 'IN_GROUP_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minGroup: 1, maxGroup: 1 }
      })

      seatRules.addRule({
        predicate: 'IN_GROUP_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minGroup: 2, maxGroup: 2 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle empty rules list', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 3,
        seatsPerColumn: 3,
        groups: [{ columns: 3, rows: 3 }]
      })

      for (let i = 0; i < 5; i++) {
        studentData.addStudent()
      }

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })

    it('should handle disabled rules in conflict', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_NOT_BE_SEATMATES',
        priority: 'required',
        enabled: false,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0.rowIndex).toBe(seat1.rowIndex)
      expect(seat0.groupIndex).toBe(seat1.groupIndex)
    })
  })
})
