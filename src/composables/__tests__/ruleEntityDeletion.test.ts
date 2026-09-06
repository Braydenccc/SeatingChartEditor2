import { beforeEach, describe, expect, it } from 'vitest'
import { useSeatRules } from '../useSeatRules'
import { useStudentData } from '../useStudentData'
import { useTagData } from '../useTagData'
import { useStudentAttributes } from '../useStudentAttributes'
import { useZoneData } from '../useZoneData'
import { useUndo } from '../useUndo'
import type { Rule } from '@/types/models'

const createNestedReferenceRule = (references: {
  studentId: number
  tagId: number
  attributeId: string
  zoneId: number
}): Rule => ({
  id: 'rule-reference-fixture',
  priority: 'prefer',
  subjects: [{ type: 'all', id: null }],
  subjectMode: 'single',
  subjectsA: [],
  subjectsB: [],
  predicate: 'IN_ROW_RANGE',
  params: { zoneId: references.zoneId },
  version: 5,
  not: false,
  enabled: false,
  description: '引用保护回归规则',
  logicOperator: 'AND',
  subRules: [{
    predicate: 'DISTRIBUTE_EVENLY',
    not: false,
    subjects: [{ type: 'tag', id: references.tagId }],
    params: {}
  }],
  createdAt: 1,
  updatedAt: 1,
  subject: { kind: 'student', id: references.studentId },
  conditions: [{ params: { attributeId: references.attributeId } }]
} as unknown as Rule)

describe('rule-backed entity deletion guards', () => {
  const seatRules = useSeatRules()
  const studentData = useStudentData()
  const tagData = useTagData()
  const attributes = useStudentAttributes()
  const zoneData = useZoneData()
  const undo = useUndo()

  beforeEach(() => {
    seatRules.clearAllRules()
    undo.clearHistory()
    studentData.clearAllStudents()
    tagData.clearAllTags()
    zoneData.clearAllZones()
    attributes.replaceAttributeDefinitions([], { useDefaultsWhenEmpty: false })
  })

  it('finds references in legacy subjects, sub-rules, params and nested conditions', () => {
    seatRules.rules.value.push(createNestedReferenceRule({
      studentId: 11,
      tagId: 22,
      attributeId: 'focus',
      zoneId: 33
    }))

    expect(seatRules.getRuleReferences('student', 11)[0]?.locations).toContain('$.subject.id')
    expect(seatRules.getRuleReferences('tag', 22)[0]?.locations).toContain('$.subRules[0].subjects[0]')
    expect(seatRules.getRuleReferences('numericAttribute', 'focus')[0]?.locations)
      .toContain('$.conditions[0].params.attributeId')
    expect(seatRules.getRuleReferences('zone', 33)[0]?.locations).toContain('$.params.zoneId')
  })

  it('blocks every entity deletion without mutating dependent data', () => {
    const studentId = studentData.addStudent()
    studentData.updateStudent(studentId, { name: '张三' })
    const tagId = tagData.addTag({ name: '重点' })
    const attributeId = attributes.addAttribute({ id: 'focus', name: '专注度' })
    const zoneId = zoneData.addZone()
    zoneData.updateZone(zoneId, { name: '前排', tagIds: [tagId] })
    studentData.updateStudent(studentId, {
      tags: [tagId],
      numericAttributes: { [attributeId]: 8 }
    })
    seatRules.rules.value.push(createNestedReferenceRule({ studentId, tagId, attributeId, zoneId }))

    const studentResult = studentData.deleteStudent(studentId)
    const tagResult = tagData.deleteTag(tagId)
    const attributeResult = attributes.deleteAttribute(attributeId)
    const zoneResult = zoneData.deleteZone(zoneId)

    for (const result of [studentResult, tagResult, attributeResult, zoneResult]) {
      expect(result).toMatchObject({ success: false, reason: 'referenced-by-rules' })
      expect(result.references).toHaveLength(1)
      expect(result.references[0]?.ruleId).toBe('rule-reference-fixture')
    }
    expect(studentData.students.value.some(student => student.id === studentId)).toBe(true)
    expect(tagData.tags.value.some(tag => tag.id === tagId)).toBe(true)
    expect(attributes.getAttributeById(attributeId)).toBeDefined()
    expect(zoneData.zones.value.some(zone => zone.id === zoneId)).toBe(true)
    expect(studentData.students.value.find(student => student.id === studentId)).toMatchObject({
      tags: [tagId],
      numericAttributes: { [attributeId]: 8 }
    })
  })

  it('keeps history when blocked and clears undo/redo after the eventual student deletion', () => {
    const studentId = studentData.addStudent()
    const addedRule = seatRules.addRule({
      description: '张三必须坐前排',
      predicate: 'IN_ROW_RANGE',
      subjects: [{ type: 'person', id: studentId }],
      params: { minRow: 1, maxRow: 2 }
    })
    expect(addedRule.success).toBe(true)

    undo.recordClear('seat-0-0-0', studentId)
    expect(undo.canUndo.value).toBe(true)
    expect(studentData.deleteStudent(studentId).success).toBe(false)
    expect(undo.canUndo.value).toBe(true)

    undo.undo()
    expect(undo.canRedo.value).toBe(true)
    seatRules.deleteRule(addedRule.rule!.id)

    expect(studentData.deleteStudent(studentId).success).toBe(true)
    expect(undo.canUndo.value).toBe(false)
    expect(undo.canRedo.value).toBe(false)
  })

  it('reduces blank students using unreferenced candidates and exposes blocking rules when needed', () => {
    const protectedStudentId = studentData.addStudent()
    const deletableStudentId = studentData.addStudent()
    const addedRule = seatRules.addRule({
      description: '保留的空白学生规则',
      predicate: 'IN_ROW_RANGE',
      subjects: [{ type: 'person', id: protectedStudentId }],
      params: { minRow: 1, maxRow: 2 }
    })
    expect(addedRule.success).toBe(true)

    expect(studentData.setStudentCount(0)).toBe(false)
    expect(studentData.students.value.map(student => student.id)).toEqual([
      protectedStudentId,
      deletableStudentId
    ])
    expect(studentData.lastStudentDeletionResult.value).toMatchObject({
      success: false,
      reason: 'referenced-by-rules'
    })
    expect(studentData.lastStudentDeletionResult.value?.references[0]?.ruleId).toBe(addedRule.rule!.id)

    expect(studentData.setStudentCount(1)).toBe(true)
    expect(studentData.students.value.map(student => student.id)).toEqual([protectedStudentId])
    expect(studentData.students.value.some(student => student.id === deletableStudentId)).toBe(false)

    expect(studentData.setStudentCount(0)).toBe(false)
    expect(studentData.lastStudentDeletionResult.value).toMatchObject({
      success: false,
      reason: 'referenced-by-rules'
    })
    expect(studentData.lastStudentDeletionResult.value?.references[0]?.ruleId).toBe(addedRule.rule!.id)
  })
})
