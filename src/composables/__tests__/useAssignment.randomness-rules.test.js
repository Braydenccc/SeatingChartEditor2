import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'
import { useSeatChart } from '../useSeatChart'
import { useSeatRules } from '../useSeatRules'
import { useZoneData } from '../useZoneData'
import { useAssignment } from '../useAssignment'

describe('useAssignment - Rule Combination Randomness', () => {
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

  describe('Randomness with Single Rule', () => {
    it('should produce different valid solutions with IN_ROW_RANGE rule', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 4,
        groups: [{ columns: 4, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: { minRow: 1, maxRow: 2 }
      })

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })

    it('should produce different valid solutions with MUST_BE_SEATMATES rule', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 6,
        seatsPerColumn: 4,
        groups: [{ columns: 6, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
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

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })

    it('should produce different valid solutions with IN_GROUP_RANGE rule', async () => {
      seatChart.updateConfig({
        groupCount: 4,
        columnsPerGroup: 2,
        seatsPerColumn: 3,
        groups: [
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 },
          { columns: 2, rows: 3 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_GROUP_RANGE',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: { minGroup: 1, maxGroup: 3 }
      })

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })
  })

  describe('Randomness with Multiple Rules', () => {
    it('should produce different valid solutions with IN_ROW_RANGE + MUST_BE_SEATMATES', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 6,
        seatsPerColumn: 4,
        groups: [{ columns: 6, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minRow: 1, maxRow: 2 }
      })

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[2] },
          { type: 'person', id: studentIds[3] }
        ],
        params: {}
      })

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })

    it('should produce different valid solutions with DISTANCE_AT_LEAST + MUST_BE_SAME_GROUP', async () => {
      seatChart.updateConfig({
        groupCount: 3,
        columnsPerGroup: 4,
        seatsPerColumn: 4,
        groups: [
          { columns: 4, rows: 4 },
          { columns: 4, rows: 4 },
          { columns: 4, rows: 4 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 8; i++) {
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
        params: { distance: 2 }
      })

      seatRules.addRule({
        predicate: 'MUST_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[2] },
          { type: 'person', id: studentIds[3] }
        ],
        params: {}
      })

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })

    it('should produce different valid solutions with multiple pair rules', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 6,
        seatsPerColumn: 4,
        groups: [{ columns: 6, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 8; i++) {
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
          { type: 'person', id: studentIds[2] },
          { type: 'person', id: studentIds[3] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[4] },
          { type: 'person', id: studentIds[5] }
        ],
        params: {}
      })

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })
  })

  describe('Distribution Uniformity with Rules', () => {
    it('should distribute students uniformly within constrained area', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 4,
        groups: [{ columns: 4, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: { minRow: 1, maxRow: 2 }
      })

      const seatAssignmentCounts = {}
      const constrainedSeats = seatChart.seats.value.filter(s => s.rowIndex >= 2 && s.rowIndex <= 3)
      constrainedSeats.forEach(s => {
        seatAssignmentCounts[s.id] = 0
      })

      const runs = 100
      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

        for (const id of studentIds) {
          const seat = seatChart.seats.value.find(s => s.studentId === id)
          if (seat && seatAssignmentCounts[seat.id] !== undefined) {
            seatAssignmentCounts[seat.id]++
          }
        }
      }

      const counts = Object.values(seatAssignmentCounts)
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
      const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avgCount)))
      const deviationRatio = maxDeviation / avgCount

      expect(deviationRatio).toBeLessThan(0.5)
    })

    it('should distribute seatmate pairs across available positions', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 6,
        seatsPerColumn: 4,
        groups: [{ columns: 6, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 2; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'MUST_BE_SEATMATES',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: {}
      })

      const pairPositionCounts = {}
      const runs = 100

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

        const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
        const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

        if (seat0 && seat1) {
          const leftCol = Math.min(seat0.columnIndex, seat1.columnIndex)
          const key = `${seat0.groupIndex}-${seat0.rowIndex}-${leftCol}`
          pairPositionCounts[key] = (pairPositionCounts[key] || 0) + 1
        }
      }

      const uniquePositions = Object.keys(pairPositionCounts).length
      expect(uniquePositions).toBeGreaterThan(5)
    })
  })

  describe('Randomness Preservation with Prefer Rules', () => {
    it('should maintain randomness when prefer rule is satisfiable', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 6,
        seatsPerColumn: 4,
        groups: [{ columns: 6, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
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
        params: { distance: 2 }
      })

      const results = new Set()
      const runs = 20

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(5)
    })

    it('should maintain randomness when optional rule is present', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 5,
        seatsPerColumn: 3,
        groups: [{ columns: 5, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 5; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'DISTRIBUTE_EVENLY',
        priority: 'optional',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: {}
      })

      const results = new Set()
      const runs = 20

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(5)
    })
  })

  describe('Complex Rule Combinations Randomness', () => {
    it('should maintain randomness with multiple required rules', async () => {
      seatChart.updateConfig({
        groupCount: 2,
        columnsPerGroup: 4,
        seatsPerColumn: 4,
        groups: [
          { columns: 4, rows: 4 },
          { columns: 4, rows: 4 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 10; i++) {
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
        predicate: 'MUST_BE_SAME_GROUP',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[2] },
          { type: 'person', id: studentIds[3] }
        ],
        params: {}
      })

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[4] }],
        params: { minRow: 1, maxRow: 2 }
      })

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const assignmentStr = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.add(assignmentStr)
      }

      expect(results.size).toBeGreaterThan(1)
    })

    it('should produce valid solutions satisfying all rule types', async () => {
      seatChart.updateConfig({
        groupCount: 2,
        columnsPerGroup: 4,
        seatsPerColumn: 4,
        groups: [
          { columns: 4, rows: 4 },
          { columns: 4, rows: 4 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 8; i++) {
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
        predicate: 'DISTANCE_AT_LEAST',
        priority: 'prefer',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[2] },
          { type: 'person', id: studentIds[3] }
        ],
        params: { distance: 2 }
      })

      seatRules.addRule({
        predicate: 'DISTRIBUTE_EVENLY',
        priority: 'optional',
        enabled: true,
        subjects: studentIds.slice(4).map(id => ({ type: 'person', id })),
        params: {}
      })

      const runs = 10
      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 10000 })
        expect(result.success).toBe(true)

        const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
        const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])
        expect(seat0.rowIndex).toBe(seat1.rowIndex)
        expect(seat0.groupIndex).toBe(seat1.groupIndex)
      }
    })
  })
})
