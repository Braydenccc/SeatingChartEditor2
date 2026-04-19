import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'
import { useSeatChart } from '../useSeatChart'
import { useTagData } from '../useTagData'
import { useZoneData } from '../useZoneData'

describe('Edge Cases and Boundary Tests', () => {
  describe('useStudentData edge cases', () => {
    let studentData

    beforeEach(() => {
      studentData = useStudentData()
      studentData.clearAllStudents()
    })

    it('should handle extremely long student names', () => {
      const longName = 'A'.repeat(1000)
      const id = studentData.addStudent()
      studentData.updateStudent(id, { name: longName })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.name).toBe(longName)
    })

    it('should handle special characters in names', () => {
      const specialName = '张三-李四·王五@#$%^&*()'
      const id = studentData.addStudent()
      studentData.updateStudent(id, { name: specialName })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.name).toBe(specialName)
    })

    it('should handle negative student numbers', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { studentNumber: -1 })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.studentNumber).toBe(-1)
    })

    it('should handle very large student numbers', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { studentNumber: Number.MAX_SAFE_INTEGER })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.studentNumber).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should handle empty tag arrays', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { tags: [] })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.tags).toEqual([])
    })

    it('should handle very large tag arrays', () => {
      const largeTags = Array.from({ length: 100 }, (_, i) => i)
      const id = studentData.addStudent()
      studentData.updateStudent(id, { tags: largeTags })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.tags).toHaveLength(100)
    })

    it('should handle setStudentCount with zero', () => {
      studentData.setStudentCount(5)
      const result = studentData.setStudentCount(0)

      expect(result).toBe(true)
      expect(studentData.students.value).toHaveLength(0)
    })

    it('should handle setStudentCount with very large number', () => {
      const result = studentData.setStudentCount(1000)

      expect(result).toBe(true)
      expect(studentData.students.value).toHaveLength(1000)
    })
  })

  describe('useSeatChart edge cases', () => {
    let seatChart

    beforeEach(() => {
      seatChart = useSeatChart()
      seatChart.clearAllSeats()
    })

    it('should handle assigning to non-existent seat', () => {
      const result = seatChart.assignStudent('invalid-seat-id', 1, false)
      expect(result).toBe(false)
    })

    it('should handle clearing non-existent seat', () => {
      expect(() => seatChart.clearSeat('invalid-seat-id', false)).not.toThrow()
    })

    it('should handle swapping same seat with itself', () => {
      const seatId = 'seat-0-0-0'
      seatChart.assignStudent(seatId, 1, false)

      expect(() => seatChart.swapSeats(seatId, seatId, false)).not.toThrow()
    })

    it('should handle distance calculation for same seat', () => {
      const distance = seatChart.getSeatDistance('seat-0-0-0', 'seat-0-0-0')
      expect(distance).toBe(0)
    })

    it('should handle distance calculation for non-existent seats', () => {
      const distance = seatChart.getSeatDistance('invalid-1', 'invalid-2')
      expect(distance).toBe(Infinity)
    })

    it('should handle areDeskmates with same seat', () => {
      const result = seatChart.areDeskmates('seat-0-0-0', 'seat-0-0-0')
      expect(result).toBe(false)
    })

    it('should handle areDeskmates with non-existent seats', () => {
      const result = seatChart.areDeskmates('invalid-1', 'invalid-2')
      expect(result).toBe(false)
    })

    it('should handle multiple rapid assignments to same seat', () => {
      const seatId = 'seat-0-0-0'

      seatChart.assignStudent(seatId, 1, false)
      seatChart.assignStudent(seatId, 2, false)
      seatChart.assignStudent(seatId, 3, false)

      expect(seatChart.getStudentAtSeat(seatId)).toBe(3)
    })
  })

  describe('useTagData edge cases', () => {
    let tagData

    beforeEach(() => {
      tagData = useTagData()
      tagData.clearAllTags()
    })

    it('should handle extremely long tag names', () => {
      const longName = 'A'.repeat(1000)
      const id = tagData.addTag()
      tagData.updateTag(id, { name: longName })

      const tag = tagData.tags.value.find(t => t.id === id)
      expect(tag.name).toBe(longName)
    })

    it('should handle invalid color formats', () => {
      const id = tagData.addTag()
      tagData.updateTag(id, { color: 'invalid-color' })

      const tag = tagData.tags.value.find(t => t.id === id)
      expect(tag.color).toBe('invalid-color')
    })

    it('should handle updating non-existent tag', () => {
      expect(() => tagData.updateTag(999, { name: '不存在' })).not.toThrow()
    })

    it('should handle deleting non-existent tag', () => {
      expect(() => tagData.deleteTag(999)).not.toThrow()
    })

    it('should handle creating many tags rapidly', () => {
      const ids = []
      for (let i = 0; i < 100; i++) {
        ids.push(tagData.addTag())
      }

      expect(tagData.tags.value).toHaveLength(100)
      expect(new Set(ids).size).toBe(100)
    })
  })

  describe('useZoneData edge cases', () => {
    let zoneData

    beforeEach(() => {
      zoneData = useZoneData()
      zoneData.clearAllZones()
    })

    it('should handle extremely long zone names', () => {
      const longName = 'A'.repeat(1000)
      const id = zoneData.addZone()
      zoneData.updateZone(id, { name: longName })

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.name).toBe(longName)
    })

    it('should handle very large seat arrays', () => {
      const largeSeatIds = Array.from({ length: 1000 }, (_, i) => `seat-${i}`)
      const id = zoneData.addZone()
      zoneData.updateZone(id, { seatIds: largeSeatIds })

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.seatIds).toHaveLength(1000)
    })

    it('should handle adding duplicate seats to zone', () => {
      const id = zoneData.addZone()

      zoneData.addSeatToZone(id, 'seat-0-0-0')
      zoneData.addSeatToZone(id, 'seat-0-0-0')
      zoneData.addSeatToZone(id, 'seat-0-0-0')

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.seatIds.filter(s => s === 'seat-0-0-0')).toHaveLength(1)
    })

    it('should handle removing non-existent seat from zone', () => {
      const id = zoneData.addZone()
      expect(() => zoneData.removeSeatFromZone(id, 'invalid-seat')).not.toThrow()
    })

    it('should handle getZoneForSeat with null/undefined', () => {
      expect(zoneData.getZoneForSeat(null)).toBeNull()
      expect(zoneData.getZoneForSeat(undefined)).toBeNull()
    })
  })

  describe('concurrent operations', () => {
    it('should handle rapid student additions and deletions', () => {
      const studentData = useStudentData()
      studentData.clearAllStudents()

      const ids = []
      for (let i = 0; i < 50; i++) {
        ids.push(studentData.addStudent())
      }

      for (let i = 0; i < 25; i++) {
        studentData.deleteStudent(ids[i])
      }

      expect(studentData.students.value).toHaveLength(25)
    })

    it('should handle rapid seat assignments and clears', () => {
      const seatChart = useSeatChart()
      const seatId = 'seat-0-0-0'

      for (let i = 0; i < 100; i++) {
        seatChart.assignStudent(seatId, i, false)
        if (i % 2 === 0) {
          seatChart.clearSeat(seatId, false)
        }
      }

      const finalStudent = seatChart.getStudentAtSeat(seatId)
      expect(finalStudent).toBe(99)
    })
  })
})
