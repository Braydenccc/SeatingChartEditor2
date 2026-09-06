import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NButton } from 'naive-ui'
import ContextInspector from '../ContextInspector.vue'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useSelection } from '@/composables/useSelection'
import { useStudentData } from '@/composables/useStudentData'

describe('ContextInspector controlled inputs', () => {
  const studentData = useStudentData()
  const selection = useSelection()
  const workbench = useEditorWorkbench()

  beforeEach(() => {
    selection.clearSelection()
    studentData.clearAllStudents()
    workbench.closeMobileDrawer()
  })

  afterEach(() => {
    selection.clearSelection()
    studentData.clearAllStudents()
    workbench.closeMobileDrawer()
  })

  it('keeps internal spaces while typing a selected-student name and trims on blur', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '旧姓名' })
    studentData.selectStudent(studentId)
    const wrapper = mount(ContextInspector, {
      global: {
        stubs: {
          BatchEditDialog: true,
          StudentEditDialog: true
        }
      }
    })
    const getNameInput = () => wrapper.get<HTMLInputElement>('input[placeholder="未命名"]')
    const typeSequentially = async (value: string) => {
      let typed = ''
      const clearedInput = getNameInput()
      clearedInput.element.value = ''
      await clearedInput.trigger('input')
      for (const character of value) {
        typed += character
        const input = getNameInput()
        input.element.value = typed
        await input.trigger('input')
        expect(getNameInput().element.value).toBe(typed)
      }
    }

    await typeSequentially('  Test Student  ')
    expect(studentData.students.value.find(student => student.id === studentId)?.name).toBe('旧姓名')

    await getNameInput().trigger('blur')
    await wrapper.vm.$nextTick()

    expect(studentData.students.value.find(student => student.id === studentId)?.name).toBe('Test Student')
    expect(getNameInput().element.value).toBe('Test Student')
    wrapper.unmount()
  })

  it('commits the previous student draft when selection changes without blur', async () => {
    const firstStudentId = studentData.addStudent()
    const secondStudentId = studentData.addStudent()
    studentData.updateStudent(firstStudentId, { name: '学生甲' })
    studentData.updateStudent(secondStudentId, { name: '学生乙' })
    studentData.selectStudent(firstStudentId)
    const wrapper = mount(ContextInspector, {
      global: {
        stubs: {
          BatchEditDialog: true,
          StudentEditDialog: true
        }
      }
    })
    const getNameInput = () => wrapper.get<HTMLInputElement>('input[placeholder="未命名"]')

    const input = getNameInput()
    input.element.value = '  切换时提交  '
    await input.trigger('input')
    studentData.selectStudent(secondStudentId)
    await wrapper.vm.$nextTick()

    expect(studentData.students.value.find(student => student.id === firstStudentId)?.name).toBe('切换时提交')
    expect(studentData.students.value.find(student => student.id === secondStudentId)?.name).toBe('学生乙')
    expect(getNameInput().element.value).toBe('学生乙')
    wrapper.unmount()
  })

  it('drops a selected-student draft when same-id data is replaced', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '旧姓名' })
    studentData.selectStudent(studentId)
    const originalStudent = studentData.students.value[0]!
    const wrapper = mount(ContextInspector, {
      global: {
        stubs: {
          BatchEditDialog: true,
          StudentEditDialog: true
        }
      }
    })
    const getNameInput = () => wrapper.get<HTMLInputElement>('input[placeholder="未命名"]')

    const input = getNameInput()
    input.element.value = '替换前草稿'
    await input.trigger('input')
    studentData.replaceStudentData([{
      id: studentId,
      name: '加载后的姓名',
      studentNumber: null,
      tags: [],
      numericAttributes: {}
    }])
    await wrapper.vm.$nextTick()

    const replacedStudent = studentData.students.value[0]!
    expect(replacedStudent).not.toBe(originalStudent)
    expect(replacedStudent.name).toBe('加载后的姓名')
    expect(getNameInput().element.value).toBe('加载后的姓名')
    await getNameInput().trigger('blur')
    expect(replacedStudent.name).toBe('加载后的姓名')
    wrapper.unmount()
  })

  it('drops a selected-student draft after clear and same-id recreation', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '旧姓名' })
    studentData.selectStudent(studentId)
    const wrapper = mount(ContextInspector, {
      global: {
        stubs: {
          BatchEditDialog: true,
          StudentEditDialog: true
        }
      }
    })
    const getNameInput = () => wrapper.get<HTMLInputElement>('input[placeholder="未命名"]')

    const input = getNameInput()
    input.element.value = '清空前草稿'
    await input.trigger('input')
    studentData.clearAllStudents()
    const recreatedId = studentData.addStudent()
    expect(recreatedId).toBe(studentId)
    studentData.updateStudent(recreatedId, { name: '重建后的姓名' })
    studentData.selectStudent(recreatedId)
    await wrapper.vm.$nextTick()

    expect(getNameInput().element.value).toBe('重建后的姓名')
    await getNameInput().trigger('blur')
    expect(studentData.students.value[0]?.name).toBe('重建后的姓名')
    wrapper.unmount()
  })

  it('discards a deleted student draft before the same id is loaded again', async () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '待删除学生' })
    studentData.selectStudent(studentId)
    const wrapper = mount(ContextInspector, {
      global: {
        stubs: {
          BatchEditDialog: true,
          StudentEditDialog: true
        }
      }
    })
    const getNameInput = () => wrapper.get<HTMLInputElement>('input[placeholder="未命名"]')

    const input = getNameInput()
    input.element.value = '删除前草稿'
    await input.trigger('input')
    expect(studentData.deleteStudent(studentId).success).toBe(true)
    studentData.replaceStudentData([{
      id: studentId,
      name: '删除后加载姓名',
      studentNumber: null,
      tags: [],
      numericAttributes: {}
    }])
    studentData.selectStudent(studentId)
    await wrapper.vm.$nextTick()

    expect(getNameInput().element.value).toBe('删除后加载姓名')
    await getNameInput().trigger('blur')
    expect(studentData.students.value[0]?.name).toBe('删除后加载姓名')
    wrapper.unmount()
  })

  it('cancels a multi-seat selection and closes the mobile context drawer', async () => {
    selection.setSelection(['seat-0-0-0', 'seat-0-0-1'])
    workbench.showMobileDrawer('selection')
    const wrapper = mount(ContextInspector, {
      global: {
        stubs: {
          BatchEditDialog: true,
          StudentEditDialog: true
        }
      }
    })
    const cancelButton = wrapper.findAllComponents(NButton)
      .find(button => button.text().includes('取消选择'))

    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')

    expect(selection.selectedCount.value).toBe(0)
    expect(workbench.mobileDrawer.value).toBeNull()
    wrapper.unmount()
  })
})
