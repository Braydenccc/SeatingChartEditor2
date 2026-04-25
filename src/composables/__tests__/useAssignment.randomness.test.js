import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'
import { useSeatChart } from '../useSeatChart'
import { useSeatRules } from '../useSeatRules'
import { useZoneData } from '../useZoneData'
import { useAssignment } from '../useAssignment'

describe('useAssignment - Randomness Tests', () => {
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

  describe('No Rules - Randomness', () => {
    it('should produce different assignments across multiple runs', async () => {
      seatChart.updateConfig({
        groupCount: 2,
        columnsPerGroup: 2,
        seatsPerColumn: 5,
        groups: [
          { columns: 2, rows: 5 },
          { columns: 2, rows: 5 }
        ]
      })

      for (let i = 0; i < 10; i++) {
        studentData.addStudent()
      }

      const results = []
      const runs = 20

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: false, iterations: 0 })
        expect(result.success).toBe(true)

        const assignmentMap = seatChart.seats.value
          .filter(s => s.studentId)
          .map(s => `${s.studentId}@${s.id}`)
          .sort()
          .join('|')
        results.push(assignmentMap)
      }

      const uniqueResults = new Set(results)
      const uniquenessRatio = uniqueResults.size / runs

      expect(uniquenessRatio).toBeGreaterThan(0.5)
    })

    it('should distribute students evenly across seats over multiple runs', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 5,
        seatsPerColumn: 1,
        groups: [{ columns: 5, rows: 1 }]
      })

      for (let i = 0; i < 5; i++) {
        studentData.addStudent()
      }

      const seatAssignmentCounts = {}
      seatChart.seats.value.forEach(s => {
        seatAssignmentCounts[s.id] = 0
      })

      const runs = 100
      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        await assignment.runSmartAssignment({ useRules: false, iterations: 0 })

        seatChart.seats.value.forEach(s => {
          if (s.studentId) {
            seatAssignmentCounts[s.id]++
          }
        })
      }

      const counts = Object.values(seatAssignmentCounts)
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
      const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avgCount)))
      const deviationRatio = maxDeviation / avgCount

      expect(deviationRatio).toBeLessThan(0.3)
    })

    it('should have equal probability for each student-seat pair', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 3,
        seatsPerColumn: 1,
        groups: [{ columns: 3, rows: 1 }]
      })

      const studentIds = []
      for (let i = 0; i < 3; i++) {
        studentIds.push(studentData.addStudent())
      }

      const pairCounts = {}
      studentIds.forEach(sId => {
        seatChart.seats.value.forEach(seat => {
          pairCounts[`${sId}-${seat.id}`] = 0
        })
      })

      const runs = 300
      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        await assignment.runSmartAssignment({ useRules: false, iterations: 0 })

        seatChart.seats.value.forEach(seat => {
          if (seat.studentId) {
            pairCounts[`${seat.studentId}-${seat.id}`]++
          }
        })
      }

      const counts = Object.values(pairCounts)
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
      const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avgCount)))
      const deviationRatio = maxDeviation / avgCount

      expect(deviationRatio).toBeLessThan(0.25)
    })
  })

  describe('With Rules - Randomness within Constraints', () => {
    it('should maintain randomness while satisfying row range rules', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 2,
        seatsPerColumn: 4,
        groups: [{ columns: 2, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 4; i++) {
        studentIds.push(studentData.addStudent())
      }

      // minRow/maxRow 是从讲台数的排数（1-indexed）
      // 对于 4 排座位：rowIndex 0=最后排(第4排), rowIndex 3=最前排(第1排)
      // 设置 minRow:3, maxRow:4 表示坐在最后两排（rowIndex 0 和 1）
      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[0] }],
        params: { minRow: 3, maxRow: 4 }
      })

      const validSeatAssignments = new Set()
      const runs = 30

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 5000 })
        expect(result.success).toBe(true)

        const student0Seat = seatChart.seats.value.find(s => s.studentId === studentIds[0])
        if (student0Seat) {
          // rowIndex 0 和 1 对应第 4 排和第 3 排（从讲台数）
          expect(student0Seat.rowIndex).toBeGreaterThanOrEqual(0)
          expect(student0Seat.rowIndex).toBeLessThanOrEqual(1)
          validSeatAssignments.add(student0Seat.id)
        }
      }

      // 应该有多种不同的座位分配结果
      expect(validSeatAssignments.size).toBeGreaterThan(1)
    })

    it('should produce different valid solutions across runs', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 3,
        seatsPerColumn: 2,
        groups: [{ columns: 3, rows: 2 }]
      })

      for (let i = 0; i < 6; i++) {
        studentData.addStudent()
      }

      const results = new Set()
      const runs = 15

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 1000 })
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

    it('should satisfy DISTRIBUTE_EVENLY rule with randomness', async () => {
      seatChart.updateConfig({
        groupCount: 1,
        columnsPerGroup: 4,
        seatsPerColumn: 4,
        groups: [{ columns: 4, rows: 4 }]
      })

      const studentIds = []
      for (let i = 0; i < 5; i++) {
        studentIds.push(studentData.addStudent())
      }

      seatRules.addRule({
        predicate: 'DISTRIBUTE_EVENLY',
        priority: 'required',
        enabled: true,
        subjects: studentIds.map(id => ({ type: 'person', id })),
        params: {}
      })

      const results = new Set()
      const runs = 10

      for (let i = 0; i < runs; i++) {
        seatChart.clearAllSeats()
        const result = await assignment.runSmartAssignment({ useRules: true, iterations: 10000 })
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

  describe('Fisher-Yates Shuffle Correctness', () => {
    it('should produce uniform distribution with shuffleArray', async () => {
      const shuffleArray = (array) => {
        const result = [...array]
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]]
        }
        return result
      }

      const elements = ['a', 'b', 'c', 'd']
      const positionCounts = {
        a: [0, 0, 0, 0],
        b: [0, 0, 0, 0],
        c: [0, 0, 0, 0],
        d: [0, 0, 0, 0]
      }

      const runs = 10000
      for (let i = 0; i < runs; i++) {
        const shuffled = shuffleArray(elements)
        shuffled.forEach((el, pos) => {
          positionCounts[el][pos]++
        })
      }

      const expectedCount = runs / 4
      const tolerance = expectedCount * 0.08

      for (const el of elements) {
        for (let pos = 0; pos < 4; pos++) {
          expect(Math.abs(positionCounts[el][pos] - expectedCount)).toBeLessThan(tolerance)
        }
      }
    })
  })
})
