import { describe, it, expect, beforeEach } from 'vitest'
import { useStudentData } from '../useStudentData'

describe('useStudentData', () => {
  let studentData

  beforeEach(() => {
    studentData = useStudentData()
    studentData.clearAllStudents()
  })

  describe('addStudent', () => {
    it('should add a new student with default properties', () => {
      const id = studentData.addStudent()

      expect(studentData.students.value).toHaveLength(1)
      expect(studentData.students.value[0]).toMatchObject({
        id: expect.any(Number),
        name: '',
        studentNumber: null,
        tags: []
      })
    })

    it('should generate unique IDs for multiple students', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()
      const id3 = studentData.addStudent()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(studentData.students.value).toHaveLength(3)
    })
  })

  describe('updateStudent', () => {
    it('should update student properties', () => {
      const id = studentData.addStudent()

      studentData.updateStudent(id, {
        name: '张三',
        studentNumber: 1,
        tags: [1, 2]
      })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.name).toBe('张三')
      expect(student.studentNumber).toBe(1)
      expect(student.tags).toEqual([1, 2])
    })

    it('should prevent duplicate student numbers by clearing conflicting number', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()

      studentData.updateStudent(id1, { name: '张三', studentNumber: 1 })
      studentData.updateStudent(id2, { name: '李四', studentNumber: 1 })

      const student1 = studentData.students.value.find(s => s.id === id1)
      const student2 = studentData.students.value.find(s => s.id === id2)

      expect(student1.studentNumber).toBe(null)
      expect(student2.studentNumber).toBe(1)
    })

    it('should trim whitespace from student names', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { name: '  张三  ' })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.name).toBe('张三')
    })

    it('should deduplicate tags array', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { tags: [1, 2, 1, 3, 2] })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.tags).toEqual([1, 2, 3])
    })

    it('should filter out null/undefined tags', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { tags: [1, null, 2, undefined, 3] })

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.tags).toEqual([1, 2, 3])
    })
  })

  describe('deleteStudent', () => {
    it('should remove student from list', () => {
      const id = studentData.addStudent()
      expect(studentData.students.value).toHaveLength(1)

      studentData.deleteStudent(id)
      expect(studentData.students.value).toHaveLength(0)
    })

    it('should clear selection if deleted student was selected', () => {
      const id = studentData.addStudent()
      studentData.selectStudent(id)
      expect(studentData.selectedStudentId.value).toBe(id)

      studentData.deleteStudent(id)
      expect(studentData.selectedStudentId.value).toBe(null)
    })

    it('should not affect selection if different student deleted', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()
      studentData.selectStudent(id1)

      studentData.deleteStudent(id2)
      expect(studentData.selectedStudentId.value).toBe(id1)
    })
  })

  describe('setStudentCount', () => {
    it('should add students when target count is higher', () => {
      studentData.setStudentCount(5)
      expect(studentData.students.value).toHaveLength(5)
    })

    it('should remove empty students when target count is lower', () => {
      studentData.setStudentCount(10)
      const result = studentData.setStudentCount(5)

      expect(result).toBe(true)
      expect(studentData.students.value).toHaveLength(5)
    })

    it('should delete all empty students when reducing count', () => {
      studentData.setStudentCount(5)

      const allStudents = [...studentData.students.value]
      const id = allStudents[0].id
      studentData.updateStudent(id, { name: '张三', studentNumber: 1 })

      const result = studentData.setStudentCount(1)

      expect(result).toBe(true)
      expect(studentData.students.value.length).toBe(1)
      expect(studentData.students.value[0].id).toBe(id)
    })

    it('should return true when target equals current count', () => {
      studentData.setStudentCount(5)
      const result = studentData.setStudentCount(5)

      expect(result).toBe(true)
      expect(studentData.students.value).toHaveLength(5)
    })
  })

  describe('sortedStudents', () => {
    it('should place students without numbers first', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()
      const id3 = studentData.addStudent()

      studentData.updateStudent(id1, { studentNumber: 5 })
      studentData.updateStudent(id2, { studentNumber: null })
      studentData.updateStudent(id3, { studentNumber: 3 })

      const sorted = studentData.students.value
      expect(sorted[0].studentNumber).toBe(null)
      expect(sorted[1].studentNumber).toBe(3)
      expect(sorted[2].studentNumber).toBe(5)
    })

    it('should sort students with numbers in ascending order', () => {
      const ids = [
        studentData.addStudent(),
        studentData.addStudent(),
        studentData.addStudent()
      ]

      studentData.updateStudent(ids[0], { studentNumber: 10 })
      studentData.updateStudent(ids[1], { studentNumber: 5 })
      studentData.updateStudent(ids[2], { studentNumber: 15 })

      const sorted = studentData.students.value
      expect(sorted[0].studentNumber).toBe(5)
      expect(sorted[1].studentNumber).toBe(10)
      expect(sorted[2].studentNumber).toBe(15)
    })
  })

  describe('tag management', () => {
    it('should add tag to multiple students', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()

      studentData.addTagToStudents(1, [id1, id2])

      expect(studentData.students.value[0].tags).toContain(1)
      expect(studentData.students.value[1].tags).toContain(1)
    })

    it('should not add duplicate tags', () => {
      const id = studentData.addStudent()
      studentData.addTagToStudents(1, [id])
      studentData.addTagToStudents(1, [id])

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.tags.filter(t => t === 1)).toHaveLength(1)
    })

    it('should remove tag from student', () => {
      const id = studentData.addStudent()
      studentData.updateStudent(id, { tags: [1, 2, 3] })

      studentData.removeTagFromStudent(2, id)

      const student = studentData.students.value.find(s => s.id === id)
      expect(student.tags).toEqual([1, 3])
    })

    it('should remove tag from all students', () => {
      const id1 = studentData.addStudent()
      const id2 = studentData.addStudent()
      studentData.updateStudent(id1, { tags: [1, 2] })
      studentData.updateStudent(id2, { tags: [2, 3] })

      studentData.removeTagFromStudents(2)

      expect(studentData.students.value[0].tags).toEqual([1])
      expect(studentData.students.value[1].tags).toEqual([3])
    })
  })

  describe('selection', () => {
    it('should select a student', () => {
      const id = studentData.addStudent()
      studentData.selectStudent(id)

      expect(studentData.selectedStudentId.value).toBe(id)
      expect(studentData.getSelectedStudent.value.id).toBe(id)
    })

    it('should clear selection', () => {
      const id = studentData.addStudent()
      studentData.selectStudent(id)
      studentData.clearSelection()

      expect(studentData.selectedStudentId.value).toBe(null)
      expect(studentData.getSelectedStudent.value).toBe(null)
    })
  })
})
