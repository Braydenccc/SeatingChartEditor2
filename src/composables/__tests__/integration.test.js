import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'
import { useSeatChart } from '../useSeatChart'
import { useTagData } from '../useTagData'

describe('Integration: Student and Seat Management', () => {
  let studentData, seatChart, tagData

  beforeEach(() => {
    studentData = useStudentData()
    seatChart = useSeatChart()
    tagData = useTagData()

    studentData.clearAllStudents()
    seatChart.clearAllSeats()
    tagData.clearAllTags()
  })

  describe('complete workflow', () => {
    it('should handle full student lifecycle with seat assignment', () => {
      const studentId = studentData.addStudent()
      studentData.updateStudent(studentId, {
        name: '张三',
        studentNumber: 1
      })

      const seatId = 'seat-0-0-0'
      const result = seatChart.assignStudent(seatId, studentId, false)

      expect(result).toBe(true)
      expect(seatChart.getStudentAtSeat(seatId)).toBe(studentId)

      studentData.deleteStudent(studentId)
      expect(studentData.students.value).toHaveLength(0)
    })

    it('should handle tag assignment and filtering', () => {
      const tagId = tagData.addTag()
      tagData.updateTag(tagId, { name: '优秀学生', color: '#FF5733' })

      const student1 = studentData.addStudent()
      const student2 = studentData.addStudent()
      const student3 = studentData.addStudent()

      studentData.addTagToStudents(tagId, [student1, student2])

      const studentsWithTag = studentData.students.value.filter(s =>
        s.tags.includes(tagId)
      )

      expect(studentsWithTag).toHaveLength(2)
      expect(studentsWithTag.map(s => s.id)).toEqual(
        expect.arrayContaining([student1, student2])
      )
    })

    it('should handle seat swapping with assigned students', () => {
      const student1 = studentData.addStudent()
      const student2 = studentData.addStudent()

      studentData.updateStudent(student1, { name: '张三' })
      studentData.updateStudent(student2, { name: '李四' })

      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-0-1'

      seatChart.assignStudent(seat1, student1, false)
      seatChart.assignStudent(seat2, student2, false)

      seatChart.swapSeats(seat1, seat2, false)

      expect(seatChart.getStudentAtSeat(seat1)).toBe(student2)
      expect(seatChart.getStudentAtSeat(seat2)).toBe(student1)
    })

    it('should handle bulk operations efficiently', () => {
      const studentCount = 50
      studentData.setStudentCount(studentCount)

      expect(studentData.students.value).toHaveLength(studentCount)

      const tagId = tagData.addTag()
      const studentIds = studentData.students.value.map(s => s.id)

      studentData.addTagToStudents(tagId, studentIds)

      const allHaveTag = studentData.students.value.every(s =>
        s.tags.includes(tagId)
      )
      expect(allHaveTag).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should move same student to the latest assigned seat', () => {
      const studentId = studentData.addStudent()
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-0-1'

      seatChart.assignStudent(seat1, studentId, false)
      seatChart.assignStudent(seat2, studentId, false)

      expect(seatChart.getStudentAtSeat(seat1)).toBe(null)
      expect(seatChart.getStudentAtSeat(seat2)).toBe(studentId)
    })

    it('should handle clearing seat with non-existent student', () => {
      const seatId = 'seat-0-0-0'
      expect(() => seatChart.clearSeat(seatId, false)).not.toThrow()
    })

    it('should handle deleting student with duplicate tags', () => {
      const studentId = studentData.addStudent()
      studentData.updateStudent(studentId, { tags: [1, 1, 2, 2, 3] })

      const student = studentData.students.value.find(s => s.id === studentId)
      expect(student.tags).toEqual([1, 2, 3])
    })

    it('should handle empty seat toggle with assigned student', () => {
      const studentId = studentData.addStudent()
      const seatId = 'seat-0-0-0'

      seatChart.assignStudent(seatId, studentId, false)
      seatChart.toggleEmpty(seatId, false)

      const seat = seatChart.seats.value.find(s => s.id === seatId)
      expect(seat.isEmpty).toBe(true)
      expect(seat.studentId).toBe(null)
    })
  })

  describe('data consistency', () => {
    it('should maintain student number uniqueness', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()
      const id3 = studentData.addStudent()

      studentData.updateStudent(id1, { studentNumber: 1 })
      studentData.updateStudent(id2, { studentNumber: 2 })
      studentData.updateStudent(id3, { studentNumber: 1 })

      const student1 = studentData.students.value.find(s => s.id === id1)
      const student3 = studentData.students.value.find(s => s.id === id3)

      expect(student1.studentNumber).toBe(null)
      expect(student3.studentNumber).toBe(1)
    })

    it('should maintain seat ID uniqueness', () => {
      const seatIds = seatChart.seats.value.map(s => s.id)
      const uniqueIds = new Set(seatIds)

      expect(uniqueIds.size).toBe(seatIds.length)
    })

    it('should handle tag deletion with student references', () => {
      const tagId = tagData.addTag()
      const studentId = studentData.addStudent()

      studentData.updateStudent(studentId, { tags: [tagId] })
      tagData.deleteTag(tagId)

      studentData.removeTagFromStudents(tagId)

      const student = studentData.students.value.find(s => s.id === studentId)
      expect(student.tags).not.toContain(tagId)
    })
  })
})
