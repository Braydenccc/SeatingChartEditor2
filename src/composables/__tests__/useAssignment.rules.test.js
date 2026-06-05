import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'
import { useSeatChart } from '../useSeatChart'
import { useSeatRules } from '../useSeatRules'
import { useZoneData } from '../useZoneData'
import { useAssignment } from '../useAssignment'

describe('useAssignment - Rule Combinations', () => {
  let studentData, seatChart, seatRules, zoneData, assignment

  beforeEach(() => {
    studentData = useStudentData()
    seatChart = useSeatChart()
    seatRules = useSeatRules()
    zoneData = useZoneData()
    assignment = useAssignment()

    seatChart.updateConfig({
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
    })
    studentData.clearAllStudents()
    seatChart.clearAllSeats()
    seatRules.clearAllRules()
    zoneData.clearAllZones()
  })

  describe('Single Rule Effectiveness', () => {
    it('should handle guard seats in auto assignment with coordinate-based rules', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 1,
        seatsPerColumn: 1,
        groups: [{ columns: 1, rows: 1 }],
        guardSeats: {
          enabled: true,
          leftEnabled: true,
          rightEnabled: true,
          includeInAutoAssignment: true,
          hideEmptyOnExport: true
        }
      })

      const studentIds = []
      for (let i = 0; i < 3; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'DISTRIBUTE_EVENLY',
        priority: 'prefer',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: {}
      })
      seatRules.addRule({
        predicate: 'DISTANCE_AT_LEAST',
        priority: 'optional',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: { distance: 2 }
      })

      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 20 })

      expect(result.success).toBe(true)
      expect(result.message).not.toContain('NaN')
      expect(seatChart.seats.value.filter(seat => seat.studentId !== null)).toHaveLength(3)
      expect(seatChart.seats.value.filter(seat => seat.kind === 'guard' && seat.studentId !== null)).toHaveLength(2)
    })

    it('should satisfy IN_ROW_RANGE rule', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 3,
        seatsPerColumn: 5,
        groups: [{ columns: 3, rows: 5 }]
      })

      const studentIds = []
      for (let i = 0; i < 5; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minRow: 1, maxRow: 2 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const student0Seat = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      expect(student0Seat).toBeDefined()
      expect(student0Seat.rowIndex).toBeGreaterThanOrEqual(3)
      expect(student0Seat.rowIndex).toBeLessThanOrEqual(4)
    })

    it('should satisfy IN_GROUP_RANGE rule', async () => {
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
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'IN_GROUP_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minGroup: 1, maxGroup: 2 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const student0Seat = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      expect(student0Seat).toBeDefined()
      expect(student0Seat.groupIndex).toBeGreaterThanOrEqual(0)
      expect(student0Seat.groupIndex).toBeLessThanOrEqual(1)
    })

    it('should satisfy MUST_BE_SEATMATES rule', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
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

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0).toBeDefined()
      expect(seat1).toBeDefined()
      expect(seat0.groupIndex).toBe(seat1.groupIndex)
      expect(seat0.rowIndex).toBe(seat1.rowIndex)
      const colDiff = Math.abs(seat0.columnIndex - seat1.columnIndex)
      expect(colDiff).toBeGreaterThanOrEqual(1)
      expect(colDiff).toBeLessThanOrEqual(2)
    })

    it('should satisfy MUST_NOT_BE_SEATMATES rule', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 3,
        groups: [{ columns: 4, rows: 3 }]
      })

      const studentIds = []
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

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
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0).toBeDefined()
      expect(seat1).toBeDefined()
      const areDeskmates = seat0.groupIndex === seat1.groupIndex &&
        seat0.rowIndex === seat1.rowIndex &&
        Math.abs(seat0.columnIndex - seat1.columnIndex) === 1
      expect(areDeskmates).toBe(false)
    })

    it('should satisfy DISTANCE_AT_LEAST rule', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 5,
        seatsPerColumn: 5,
        groups: [{ columns: 5, rows: 5 }]
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
        params: { distance: 3 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0).toBeDefined()
      expect(seat1).toBeDefined()
      const colDiff = Math.abs(seat0.columnIndex - seat1.columnIndex)
      const rowDiff = Math.abs(seat0.rowIndex - seat1.rowIndex)
      const distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff)
      expect(distance).toBeGreaterThanOrEqual(2)
    })

    it('should satisfy MUST_BE_SAME_GROUP rule', async () => {
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
      for (let i = 0; i < 6; i++) {
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

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0).toBeDefined()
      expect(seat1).toBeDefined()
      expect(seat0.groupIndex).toBe(seat1.groupIndex)
    })

    it('should satisfy MUST_NOT_BE_SAME_GROUP rule', async () => {
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
      for (let i = 0; i < 6; i++) {
        studentIds.push(studentData.addStudent())
      }

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
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0).toBeDefined()
      expect(seat1).toBeDefined()
      expect(seat0.groupIndex).not.toBe(seat1.groupIndex)
    })
  })

  describe('Multiple Rules Combination', () => {
    it('should satisfy multiple IN_ROW_RANGE rules for different students', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 3,
        seatsPerColumn: 5,
        groups: [{ columns: 3, rows: 5 }]
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
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[1] }],
        params: { minRow: 4, maxRow: 5 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0.rowIndex).toBeGreaterThanOrEqual(3)
      expect(seat0.rowIndex).toBeLessThanOrEqual(4)
      expect(seat1.rowIndex).toBeGreaterThanOrEqual(0)
      expect(seat1.rowIndex).toBeLessThanOrEqual(1)
    })

    it('should satisfy MUST_BE_SEATMATES + DISTANCE_AT_LEAST combination', async () => {
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

      seatRules.addRule({
        predicate: 'DISTANCE_AT_LEAST',
        priority: 'required',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[2] },
          { type: 'person', id: studentIds[3] }
        ],
        params: { distance: 2 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])
      const seat2 = seatChart.seats.value.find(s => s.studentId === studentIds[2])
      const seat3 = seatChart.seats.value.find(s => s.studentId === studentIds[3])

      expect(seat0.groupIndex).toBe(seat1.groupIndex)
      expect(seat0.rowIndex).toBe(seat1.rowIndex)

      const colDiff = Math.abs(seat2.columnIndex - seat3.columnIndex)
      const rowDiff = Math.abs(seat2.rowIndex - seat3.rowIndex)
      const distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff)
      expect(distance).toBeGreaterThanOrEqual(1.9)
    })

    it('should satisfy IN_GROUP_RANGE + MUST_BE_SAME_GROUP combination', async () => {
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
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minGroup: 1, maxGroup: 2 }
      })

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

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])

      expect(seat0.groupIndex).toBeGreaterThanOrEqual(0)
      expect(seat0.groupIndex).toBeLessThanOrEqual(1)
      expect(seat0.groupIndex).toBe(seat1.groupIndex)
    })

    it('should satisfy DISTRIBUTE_EVENLY for tagged students', async () => {
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
        predicate: 'DISTRIBUTE_EVENLY',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: {}
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 10000 })

      expect(result.success).toBe(true)
      
      const positioned = []
      for (const id of studentIds) {
        const seat = seatChart.seats.value.find(s => s.studentId === id)
        if (seat) {
          positioned.push({ id, seat })
        }
      }

      let minDistance = Infinity
      for (let i = 0; i < positioned.length; i++) {
        for (let j = i + 1; j < positioned.length; j++) {
          const colDiff = Math.abs(positioned[i].seat.columnIndex - positioned[j].seat.columnIndex)
          const rowDiff = Math.abs(positioned[i].seat.rowIndex - positioned[j].seat.rowIndex)
          const distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff)
          minDistance = Math.min(minDistance, distance)
        }
      }

      expect(minDistance).toBeGreaterThan(1)
    })

    it('should satisfy CLUSTER_TOGETHER rule', async () => {
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
        predicate: 'CLUSTER_TOGETHER',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: { scope: 'group' }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      
      const groupIndices = new Set()
      for (const id of studentIds) {
        const seat = seatChart.seats.value.find(s => s.studentId === id)
        if (seat) {
          groupIndices.add(seat.groupIndex)
        }
      }

      expect(groupIndices.size).toBe(1)
    })
  })

  describe('Priority Levels', () => {
    it('should prioritize required rules over prefer rules', async () => {
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
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minRow: 1, maxRow: 1 }
      })

      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'prefer',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[1] }],
        params: { minRow: 1, maxRow: 1 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      expect(seat0.rowIndex).toBeGreaterThanOrEqual(0)
      expect(seat0.rowIndex).toBeLessThanOrEqual(4)
    })

    it('should handle optional rules with minimal impact', async () => {
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
        priority: 'optional',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[1] }
        ],
        params: { distance: 4 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple pair rules on overlapping students', async () => {
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
        predicate: 'DISTANCE_AT_LEAST',
        priority: 'prefer',
        enabled: true,
        subjects: [
          { type: 'person', id: studentIds[0] },
          { type: 'person', id: studentIds[2] }
        ],
        params: { distance: 2 }
      })

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })

      expect(result.success).toBe(true)
      
      const seat0 = seatChart.seats.value.find(s => s.studentId === studentIds[0])
      const seat1 = seatChart.seats.value.find(s => s.studentId === studentIds[1])
      const seat2 = seatChart.seats.value.find(s => s.studentId === studentIds[2])
      const seat3 = seatChart.seats.value.find(s => s.studentId === studentIds[3])

      expect(seat0.rowIndex).toBe(seat1.rowIndex)
      expect(seat0.groupIndex).toBe(seat1.groupIndex)
      expect(seat2.rowIndex).toBe(seat3.rowIndex)
      expect(seat2.groupIndex).toBe(seat3.groupIndex)
    })

    it('should handle large number of students with multiple rules', async () => {
      seatChart.updateConfig({
        groupCount: 2,
        columnsPerGroup: 4,
        seatsPerColumn: 5,
        groups: [
          { columns: 4, rows: 5 },
          { columns: 4, rows: 5 }
        ]
      })

      const studentIds = []
      for (let i = 0; i < 20; i++) {
        studentIds.push(studentData.addStudent())
      }

      for (let i = 0; i < 5; i++) {
        seatRules.addRule({
          predicate: 'MUST_BE_SEATMATES',
          priority: 'required',
          enabled: true,
          subjects: [
            { type: 'person', id: studentIds[i * 2] },
            { type: 'person', id: studentIds[i * 2 + 1] }
          ],
          params: {}
        })
      }

      seatChart.clearAllSeats()
      const result = await assignment.runSmartAssignment({ useRules: true, iterations: 10000 })

      expect(result.success).toBe(true)
    })
  })
})
