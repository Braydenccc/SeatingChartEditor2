import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Student, UseStudentDataReturn } from '@/types'

// 学生数据管理
const students = ref<Student[]>([])
let nextStudentId: number = 1

// 当前选中的学生ID
const selectedStudentId = ref<number | null>(null)

export function useStudentData(): UseStudentDataReturn {
  // 排序后的学生列表：空白学号在前，有学号的按学号排序
  const sortedStudents: ComputedRef<Student[]> = computed(() => {
    return [...students.value].sort((a, b) => {
      // 空白学号排在前面
      if (!a.studentNumber && !b.studentNumber) return 0
      if (!a.studentNumber) return -1
      if (!b.studentNumber) return 1
      // 都有学号则按学号排序
      return a.studentNumber - b.studentNumber
    })
  })

  // 添加单个学生
  const addStudent = (): number => {
    const newStudent: Student = {
      id: nextStudentId++,
      name: '',
      studentNumber: null,
      tags: []
    }
    students.value.push(newStudent)
    return newStudent.id
  }

  // 批量设置学生人数
  const setStudentCount = (targetCount: number): boolean => {
    const currentCount = students.value.length

    if (targetCount > currentCount) {
      // 添加学生
      const toAdd = targetCount - currentCount
      for (let i = 0; i < toAdd; i++) {
        students.value.push({
          id: nextStudentId++,
          name: '',
          studentNumber: null,
          tags: []
        })
      }
      return true
    } else if (targetCount < currentCount) {
      // 删除空白学生
      const emptyStudents = students.value.filter(s => !s.name && !s.studentNumber && s.tags.length === 0)
      const toDelete = currentCount - targetCount

      if (emptyStudents.length >= toDelete) {
        // 删除足够的空白学生
        const idsToDelete = emptyStudents.slice(0, toDelete).map(s => s.id)
        students.value = students.value.filter(s => !idsToDelete.includes(s.id))
        return true
      } else {
        // 删除所有空白学生但仍不够
        const idsToDelete = emptyStudents.map(s => s.id)
        students.value = students.value.filter(s => !idsToDelete.includes(s.id))
        return false // 返回false表示无法完全满足
      }
    }
    return true
  }

  // 更新学生
  const updateStudent = (
    studentId: number,
    studentData: Partial<Omit<Student, 'tags'>> & { tags?: (number | null | undefined)[] }
  ): void => {
    const student = students.value.find(s => s.id === studentId)
    if (!student) return

    // 学号防重：如果新设定的学号不为空，且已被他人使用，优先将他人的学号清空，避免同一班级出现两个相同学号
    if (studentData.studentNumber !== null && studentData.studentNumber !== student.studentNumber) {
      const conflictStudent = students.value.find(s => s.studentNumber === studentData.studentNumber && s.id !== studentId)
      if (conflictStudent) {
        conflictStudent.studentNumber = null
      }
    }

    student.name = studentData.name?.trim() || ''
    student.studentNumber = studentData.studentNumber ?? student.studentNumber
    // 过滤掉无效(null/undefined)的标签，并进行去重防腐
    student.tags = [...new Set((studentData.tags || []).filter((tag): tag is number => tag !== null && tag !== undefined))]
  }

  // 删除学生
  const deleteStudent = (studentId: number): void => {
    students.value = students.value.filter(s => s.id !== studentId)
    // 健壮性：如果被删除的学生正处于选中状态，则清空焦点
    if (selectedStudentId.value === studentId) {
      selectedStudentId.value = null
    }
  }

  const addTagToStudents = (tagId: number, studentIds: number[]): void => {
    if (!tagId || !studentIds || studentIds.length === 0) return
    studentIds.forEach(studentId => {
      const student = students.value.find(s => s.id === studentId)
      if (student && !student.tags.includes(tagId)) {
        student.tags.push(tagId)
      }
    })
  }

  const removeTagFromStudent = (tagId: number, studentId: number): void => {
    const student = students.value.find(s => s.id === studentId)
    if (student) {
      student.tags = student.tags.filter(tid => tid !== tagId)
    }
  }

  const removeTagFromStudents = (tagId: number): void => {
    students.value.forEach(student => {
      student.tags = student.tags.filter(tid => tid !== tagId)
    })
  }

  // 选择学生
  const selectStudent = (studentId: number): void => {
    selectedStudentId.value = studentId
  }

  // 清除选择
  const clearSelection = (): void => {
    selectedStudentId.value = null
  }

  // 清除所有学生
  const clearAllStudents = (): void => {
    students.value = []
    selectedStudentId.value = null
    nextStudentId = 1
  }

  // 同步学生 ID 计数器（工作区加载后调用）
  const syncStudentIdCounter = (): void => {
    if (students.value.length === 0) {
      nextStudentId = 1
      return
    }
    const maxId = Math.max(...students.value.map(s => s.id))
    nextStudentId = maxId + 1
  }

  // 获取当前选中的学生
  const getSelectedStudent: ComputedRef<Student | null> = computed(() => {
    return students.value.find(s => s.id === selectedStudentId.value) || null
  })

  return {
    students: sortedStudents,
    selectedStudentId,
    selectStudent,
    clearSelection,
    getSelectedStudent,
    addStudent,
    setStudentCount,
    updateStudent,
    deleteStudent,
    addTagToStudents,
    removeTagFromStudent,
    removeTagFromStudents,
    clearAllStudents,
    syncStudentIdCounter
  }
}
