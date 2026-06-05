import { beforeEach, describe, expect, it } from 'vitest'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'

describe('useStudentAttributes', () => {
  let studentData: ReturnType<typeof useStudentData>
  let attributes: ReturnType<typeof useStudentAttributes>

  beforeEach(() => {
    studentData = useStudentData()
    attributes = useStudentAttributes()
    studentData.clearAllStudents()
    attributes.replaceAttributeDefinitions()
  })

  it('provides default height and score attributes', () => {
    expect(attributes.attributeDefinitions.value.map(def => def.id)).toEqual(['height', 'score'])
  })

  it('can preserve an explicitly empty attribute list for existing workspaces', () => {
    attributes.replaceAttributeDefinitions([], { useDefaultsWhenEmpty: false })

    expect(attributes.attributeDefinitions.value).toEqual([])
  })

  it('stores numeric values on students and parses invalid values as null', () => {
    const id = studentData.addStudent()

    studentData.updateStudent(id, {
      name: '张三',
      numericAttributes: {
        height: '150',
        score: 'invalid'
      } as any
    })

    const student = studentData.students.value.find(s => s.id === id)
    expect(student?.numericAttributes.height).toBe(150)
    expect(student?.numericAttributes.score).toBeNull()
  })

  it('removes deleted attributes from all students', () => {
    const id = studentData.addStudent()
    const customId = attributes.addAttribute({ name: '纪律分', unit: '分' })

    studentData.updateStudent(id, {
      numericAttributes: {
        [customId]: 8
      }
    })

    attributes.deleteAttribute(customId)

    const student = studentData.students.value.find(s => s.id === id)
    expect(student?.numericAttributes[customId]).toBeUndefined()
  })

  it('matches explicit Excel numeric headers', () => {
    const matched = attributes.ensureAttributeForHeader('数值:专注度')
    expect(matched?.name).toBe('专注度')
    expect(attributes.findAttributeByHeader('属性:专注度')?.id).toBe(matched?.id)
  })

  it('round-trips numeric Excel headers with units', () => {
    expect(attributes.findAttributeByHeader('数值:身高(cm)')?.id).toBe('height')
    expect(attributes.findAttributeByHeader('身高/cm')?.id).toBe('height')

    const matched = attributes.ensureAttributeForHeader('数值:纪律分(分)')

    expect(matched?.name).toBe('纪律分')
    expect(matched?.unit).toBe('分')
    expect(attributes.findAttributeByHeader('属性:纪律分(分)')?.id).toBe(matched?.id)
  })

  it('accepts more numeric header formats and unit-suffixed values', () => {
    const focus = attributes.ensureAttributeForHeader('标签数值-专注度[分]')
    const custom = attributes.ensureAttributeForHeader('课堂积分/分', { allowImplicit: true })

    expect(focus?.name).toBe('专注度')
    expect(focus?.unit).toBe('分')
    expect(custom?.name).toBe('课堂积分')
    expect(custom?.unit).toBe('分')
    expect(attributes.parseNumericValue('１５０ cm')).toBe(150)
    expect(attributes.parseNumericValue('1,234.5')).toBe(1234.5)
    expect(attributes.parseNumericValue('3,5')).toBe(3.5)
  })
})
