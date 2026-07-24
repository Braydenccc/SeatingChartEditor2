import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NButton, NInput, NInputNumber } from 'naive-ui'
import StudentRosterDialog from '../StudentRosterDialog.vue'
import { useStudentData } from '@/composables/useStudentData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useTagData } from '@/composables/useTagData'
import * as uiFeedback from '@/services/uiFeedback'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn().mockResolvedValue(undefined) })
}))
vi.mock('@/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ openSettings: vi.fn() })
}))

describe('StudentRosterDialog student count', () => {
  const studentData = useStudentData()
  const studentAttributes = useStudentAttributes()
  const tagData = useTagData()

  beforeEach(() => {
    studentData.clearAllStudents()
    studentAttributes.clearAttributeDefinitions()
    tagData.clearAllTags()
    studentData.setStudentCount(2)
  })

  afterEach(() => {
    studentData.clearAllStudents()
    studentAttributes.clearAttributeDefinitions()
    tagData.clearAllTags()
    vi.restoreAllMocks()
  })

  it('confirms a destructive reduction and leaves the count unchanged when cancelled', async () => {
    const confirmSpy = vi.spyOn(uiFeedback, 'requestUiConfirm').mockResolvedValue(false)
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })
    const countInput = wrapper.findAllComponents(NInputNumber)
      .find(input => input.classes().includes('student-count-input'))

    expect(countInput).toBeDefined()
    const countInputProps = countInput!.props('inputProps') as Record<string, unknown>
    expect(countInputProps['aria-label']).toBe('学生总人数')
    expect(wrapper.get('label').attributes('for')).toBe(countInputProps.id)
    countInput!.vm.$emit('update:value', 1)
    countInput!.vm.$emit('blur')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: '减少学生人数',
      content: expect.stringMatching(/删除 1 名.*撤销\/重做历史/),
      positiveText: '确认减少'
    }))
    expect(studentData.students.value).toHaveLength(2)
    expect(countInput!.props('value')).toBe(2)

    wrapper.unmount()
  })

  it('keeps internal spaces while typing desktop and mobile names and trims on blur', async () => {
    const desktopStudent = studentData.students.value[0]!
    const mobileStudent = studentData.students.value[1]!
    studentData.updateStudent(desktopStudent.id, { name: '旧桌面姓名' })
    studentData.updateStudent(mobileStudent.id, { name: '旧移动姓名' })
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })

    const typeSequentially = async (scope: string, row: number, value: string) => {
      const getInput = () => wrapper.get<HTMLInputElement>(
        `${scope} input[aria-label^="第 ${row} 行"][aria-label$="姓名"]`
      )
      let typed = ''
      const clearedInput = getInput()
      clearedInput.element.value = ''
      await clearedInput.trigger('input')
      for (const character of value) {
        typed += character
        const input = getInput()
        input.element.value = typed
        await input.trigger('input')
        expect(getInput().element.value).toBe(typed)
      }
      return getInput
    }

    const getDesktopNameInput = await typeSequentially('.desktop-roster', 1, '  Desktop Student  ')
    expect(desktopStudent.name).toBe('旧桌面姓名')
    await getDesktopNameInput().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(desktopStudent.name).toBe('Desktop Student')
    expect(getDesktopNameInput().element.value).toBe('Desktop Student')

    const getMobileNameInput = await typeSequentially('.mobile-roster', 2, '  Mobile Student  ')
    expect(mobileStudent.name).toBe('旧移动姓名')
    await getMobileNameInput().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(mobileStudent.name).toBe('Mobile Student')
    expect(getMobileNameInput().element.value).toBe('Mobile Student')
    wrapper.unmount()
  })

  it('drops a student name draft when same-id data is replaced or cleared and recreated', async () => {
    const originalStudent = studentData.students.value[0]!
    studentData.updateStudent(originalStudent.id, { name: '旧姓名' })
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })
    const getDesktopNameInput = () => wrapper.get<HTMLInputElement>(
      '.desktop-roster input[aria-label^="第 1 行"][aria-label$="姓名"]'
    )
    const typeName = async (value: string) => {
      const input = getDesktopNameInput()
      input.element.value = value
      await input.trigger('input')
    }

    await typeName('  替换前草稿  ')
    expect(originalStudent.name).toBe('旧姓名')
    studentData.replaceStudentData([{
      id: originalStudent.id,
      name: '加载后的姓名',
      studentNumber: null,
      tags: [],
      numericAttributes: {}
    }])
    await flushPromises()

    const replacedStudent = studentData.students.value[0]!
    expect(replacedStudent).not.toBe(originalStudent)
    expect(getDesktopNameInput().element.value).toBe('加载后的姓名')
    await getDesktopNameInput().trigger('blur')
    expect(replacedStudent.name).toBe('加载后的姓名')

    await typeName('  清空前草稿  ')
    studentData.clearAllStudents()
    const recreatedId = studentData.addStudent()
    expect(recreatedId).toBe(originalStudent.id)
    studentData.updateStudent(recreatedId, { name: '重建后的姓名' })
    await flushPromises()

    const recreatedStudent = studentData.students.value[0]!
    expect(getDesktopNameInput().element.value).toBe('重建后的姓名')
    await getDesktopNameInput().trigger('blur')
    expect(recreatedStudent.name).toBe('重建后的姓名')
    wrapper.unmount()
  })

  it('keeps a student name draft when the same entity is updated externally', async () => {
    const student = studentData.students.value[0]!
    studentData.updateStudent(student.id, { name: '旧姓名' })
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })
    const getDesktopNameInput = () => wrapper.get<HTMLInputElement>(
      '.desktop-roster input[aria-label^="第 1 行"][aria-label$="姓名"]'
    )

    const input = getDesktopNameInput()
    input.element.value = '  保留的草稿  '
    await input.trigger('input')
    studentData.updateStudent(student.id, { name: '外部更新姓名' })
    await wrapper.vm.$nextTick()

    expect(studentData.students.value[0]).toBe(student)
    expect(getDesktopNameInput().element.value).toBe('  保留的草稿  ')
    await getDesktopNameInput().trigger('blur')
    expect(student.name).toBe('保留的草稿')
    wrapper.unmount()
  })

  it('provides row-aware accessible names for roster editing controls', async () => {
    studentAttributes.addAttribute({
      id: 'score',
      name: '成绩',
      enabled: true
    })
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })
    await wrapper.vm.$nextTick()

    for (const label of [
      '第 1 行，未命名学生，姓名',
      '第 1 行，未命名学生，学号',
      '第 1 行，未命名学生，成绩'
    ]) {
      expect(wrapper.find(`input[aria-label="${label}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('button[aria-label="第 1 行，未命名学生，删除学生"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="第 2 行，未命名学生，姓名"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="第 2 行，未命名学生，学号"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="第 2 行，未命名学生，成绩"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="第 2 行，未命名学生，删除学生"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('keeps spaces in metadata drafts, rejects empty required names, and allows an empty unit', async () => {
    const attributeId = studentAttributes.addAttribute({
      name: '旧属性',
      unit: '旧单位'
    })
    const tagId = tagData.addTag({ name: '旧标签' })
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })
    const openContext = async (label: string) => {
      const button = wrapper.findAllComponents(NButton)
        .find(item => item.text().includes(label))
      expect(button).toBeDefined()
      await button!.trigger('click')
      await wrapper.vm.$nextTick()
    }
    const findContextInput = (label: string) => {
      const row = wrapper.findAll('.field-row')
        .find(item => item.get('span').text() === label)
      expect(row).toBeDefined()
      return row!.findComponent(NInput)
    }
    const typeContextInputSequentially = async (label: string, value: string) => {
      const getInput = () => findContextInput(label).get<HTMLInputElement>('input')
      let typed = ''
      const clearedInput = getInput()
      clearedInput.element.value = ''
      await clearedInput.trigger('input')
      for (const character of value) {
        typed += character
        const input = getInput()
        input.element.value = typed
        await input.trigger('input')
        expect(getInput().element.value).toBe(typed)
      }
      return getInput
    }

    await openContext('旧属性')
    const emptyAttributeName = await typeContextInputSequentially('属性名', '')
    await emptyAttributeName().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(studentAttributes.getAttributeById(attributeId)?.name).toBe('旧属性')

    const attributeNameInput = await typeContextInputSequentially('属性名', 'New Attribute')
    expect(studentAttributes.getAttributeById(attributeId)?.name).toBe('旧属性')
    await attributeNameInput().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(studentAttributes.getAttributeById(attributeId)?.name).toBe('New Attribute')

    const attributeUnitInput = await typeContextInputSequentially('单位', 'score points')
    await attributeUnitInput().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(studentAttributes.getAttributeById(attributeId)).toMatchObject({
      name: 'New Attribute',
      unit: 'score points'
    })

    const emptyAttributeUnit = await typeContextInputSequentially('单位', '')
    await emptyAttributeUnit().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(studentAttributes.getAttributeById(attributeId)?.unit).toBe('')

    await openContext('旧标签')
    const emptyTagName = await typeContextInputSequentially('标签名', '')
    await emptyTagName().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(tagData.tags.value.find(tag => tag.id === tagId)?.name).toBe('旧标签')

    const tagNameInput = await typeContextInputSequentially('标签名', 'New Tag')
    expect(tagData.tags.value.find(tag => tag.id === tagId)?.name).toBe('旧标签')
    await tagNameInput().trigger('blur')
    await wrapper.vm.$nextTick()
    expect(tagData.tags.value.find(tag => tag.id === tagId)?.name).toBe('New Tag')
    wrapper.unmount()
  })

  it('drops metadata drafts when entities are replaced or deleted and recreated with the same id', async () => {
    const attributeId = studentAttributes.addAttribute({
      id: 'replaceable-attribute',
      name: '旧属性',
      unit: '旧单位'
    })
    const tagId = tagData.addTag({ name: '旧标签' })
    const originalTag = tagData.tags.value.find(tag => tag.id === tagId)!
    const wrapper = mount(StudentRosterDialog, {
      props: {
        visible: true,
        presentation: 'embedded'
      }
    })
    const openContext = async (label: string) => {
      const button = wrapper.findAllComponents(NButton)
        .find(item => item.text().includes(label))
      expect(button).toBeDefined()
      await button!.trigger('click')
      await wrapper.vm.$nextTick()
    }
    const getContextInput = (label: string) => {
      const row = wrapper.findAll('.field-row')
        .find(item => item.get('span').text() === label)
      expect(row).toBeDefined()
      return row!.findComponent(NInput).get<HTMLInputElement>('input')
    }
    const typeContextValue = async (label: string, value: string) => {
      const input = getContextInput(label)
      input.element.value = value
      await input.trigger('input')
    }

    await openContext('旧属性')
    await typeContextValue('属性名', '替换前属性草稿')
    studentAttributes.replaceAttributeDefinitions([{
      id: attributeId,
      name: '加载后的属性',
      unit: '加载单位'
    }], { useDefaultsWhenEmpty: false })
    await flushPromises()
    expect(getContextInput('属性名').element.value).toBe('加载后的属性')
    await getContextInput('属性名').trigger('blur')
    expect(studentAttributes.getAttributeById(attributeId)?.name).toBe('加载后的属性')

    await typeContextValue('属性名', '删除前属性草稿')
    expect(studentAttributes.deleteAttribute(attributeId).success).toBe(true)
    expect(studentAttributes.addAttribute({
      id: attributeId,
      name: '重建后的属性',
      unit: ''
    })).toBe(attributeId)
    await flushPromises()
    expect(getContextInput('属性名').element.value).toBe('重建后的属性')
    await getContextInput('属性名').trigger('blur')
    expect(studentAttributes.getAttributeById(attributeId)?.name).toBe('重建后的属性')

    await openContext('旧标签')
    await typeContextValue('标签名', '替换前标签草稿')
    tagData.replaceTagData([{
      id: tagId,
      name: '加载后的标签',
      color: originalTag.color,
      showInSeatChart: true
    }])
    await flushPromises()
    expect(getContextInput('标签名').element.value).toBe('加载后的标签')
    await getContextInput('标签名').trigger('blur')
    expect(tagData.tags.value.find(tag => tag.id === tagId)?.name).toBe('加载后的标签')

    await typeContextValue('标签名', '删除前标签草稿')
    expect(tagData.deleteTag(tagId).success).toBe(true)
    tagData.replaceTagData([{
      id: tagId,
      name: '重建后的标签',
      color: originalTag.color,
      showInSeatChart: true
    }])
    await flushPromises()
    expect(getContextInput('标签名').element.value).toBe('重建后的标签')
    await getContextInput('标签名').trigger('blur')
    expect(tagData.tags.value.find(tag => tag.id === tagId)?.name).toBe('重建后的标签')
    wrapper.unmount()
  })
})
