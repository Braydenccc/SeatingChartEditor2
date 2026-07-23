import { beforeEach, describe, expect, it } from 'vitest'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'
import { useWorkspace } from '../useWorkspace'
import { validateWorkspaceDocument } from '@/utils/workspaceValidation'

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
      }
    })

    const student = studentData.students.value.find(s => s.id === id)
    expect(student?.numericAttributes?.height).toBe(150)
    expect(student?.numericAttributes?.score).toBeNull()
  })

  it('normalizes imported numeric values to definition precision before workspace save', () => {
    const id = studentData.addStudent()

    studentData.updateStudent(id, {
      name: '张三',
      studentNumber: 1,
      numericAttributes: { height: 150.5 }
    })

    const student = studentData.students.value.find(item => item.id === id)
    expect(student?.numericAttributes?.height).toBe(151)

    const savedWorkspace = useWorkspace().getWorkspaceJson()
    expect(savedWorkspace).not.toBeNull()
    expect(validateWorkspaceDocument(JSON.parse(savedWorkspace!))).toMatchObject({
      valid: true,
      errors: []
    })
  })

  it('drops numeric values without a matching definition', () => {
    const id = studentData.addStudent()

    studentData.updateStudent(id, {
      numericAttributes: {
        height: 150,
        removedAttribute: 42
      }
    })

    const student = studentData.students.value.find(item => item.id === id)
    expect(student?.numericAttributes).toEqual({ height: 150 })
  })

  it('rejects inverted ranges and re-normalizes existing values after constraint changes', () => {
    const roundedId = studentData.addStudent()
    const clampedId = studentData.addStudent()
    const nullId = studentData.addStudent()
    studentData.updateStudent(roundedId, { numericAttributes: { score: 79.6 } })
    studentData.updateStudent(clampedId, { numericAttributes: { score: 99.9 } })
    studentData.updateStudent(nullId, { numericAttributes: { score: null } })

    expect(attributes.updateAttribute('score', { min: 90, max: 80 })).toBe(false)
    expect(attributes.getAttributeById('score')).toMatchObject({ min: 0, max: 150, precision: 1 })
    expect(studentData.students.value.find(item => item.id === roundedId)?.numericAttributes?.score).toBe(79.6)

    expect(attributes.updateAttribute('score', { max: 80, precision: 0 })).toBe(true)
    expect(studentData.students.value.find(item => item.id === roundedId)?.numericAttributes?.score).toBe(80)
    expect(studentData.students.value.find(item => item.id === clampedId)?.numericAttributes?.score).toBe(80)
    expect(studentData.students.value.find(item => item.id === nullId)?.numericAttributes?.score).toBeNull()

    const savedWorkspace = useWorkspace().getWorkspaceJson()
    expect(savedWorkspace).not.toBeNull()
    expect(validateWorkspaceDocument(JSON.parse(savedWorkspace!))).toMatchObject({
      valid: true,
      errors: []
    })
  })

  it('keeps saved values inside non-aligned precision bounds and rejects empty grids', () => {
    const attributeId = attributes.addAttribute({
      id: 'bounded',
      name: '边界值',
      min: 1.2,
      max: 1.25,
      precision: 1
    })
    const studentId = studentData.addStudent()

    studentData.updateStudent(studentId, {
      numericAttributes: { [attributeId]: 1.25 }
    })

    expect(studentData.students.value.find(item => item.id === studentId)?.numericAttributes?.[attributeId]).toBe(1.2)
    expect(attributes.updateAttribute(attributeId, { min: 1.21, max: 1.25, precision: 1 })).toBe(false)
    expect(attributes.getAttributeById(attributeId)).toMatchObject({ min: 1.2, max: 1.25, precision: 1 })

    const savedWorkspace = useWorkspace().getWorkspaceJson()
    expect(savedWorkspace).not.toBeNull()
    expect(validateWorkspaceDocument(JSON.parse(savedWorkspace!))).toMatchObject({
      valid: true,
      errors: []
    })
  })

  it('saves reliable high-magnitude precision values and rejects unsafe definitions', () => {
    const reliableValue = 900000.0000000001
    const attributeId = attributes.addAttribute({
      id: 'reliable-scale',
      name: '可靠高精度值',
      min: reliableValue,
      max: reliableValue,
      precision: 10
    })
    const studentId = studentData.addStudent()

    expect(attributeId).toBe('reliable-scale')
    expect(attributes.addAttribute({
      id: 'unsafe-scale',
      name: '不可靠高精度值',
      min: 1000000,
      max: 1000000,
      precision: 10
    })).toBe('')

    studentData.updateStudent(studentId, {
      numericAttributes: { [attributeId]: reliableValue }
    })
    expect(studentData.students.value.find(item => item.id === studentId)?.numericAttributes?.[attributeId])
      .toBe(reliableValue)

    const savedWorkspace = useWorkspace().getWorkspaceJson()
    expect(savedWorkspace).not.toBeNull()
    expect(validateWorkspaceDocument(JSON.parse(savedWorkspace!))).toMatchObject({
      valid: true,
      errors: []
    })
  })

  it('clamps extreme imported values to a safe defined bound before save', () => {
    const studentId = studentData.addStudent()

    studentData.updateStudent(studentId, {
      numericAttributes: { score: 1e20 }
    })

    expect(studentData.students.value.find(item => item.id === studentId)?.numericAttributes?.score).toBe(150)

    const savedWorkspace = useWorkspace().getWorkspaceJson()
    expect(savedWorkspace).not.toBeNull()
    expect(validateWorkspaceDocument(JSON.parse(savedWorkspace!))).toMatchObject({
      valid: true,
      errors: []
    })
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
    expect(student?.numericAttributes?.[customId]).toBeUndefined()
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
