import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSeatRules } from '../useSeatRules'
import { maxRuleBandCount } from '@/constants/ruleTypes'
import { requireDefined } from '@/test-utils/testHelpers'

vi.mock('../useStudentData', () => ({
  useStudentData: () => ({
    students: {
      value: [
        { id: 1, name: '张三' },
        { id: 2, name: '李四' },
        { id: 3, name: '王五' }
      ]
    }
  })
}))

vi.mock('../useTagData', () => ({
  useTagData: () => ({
    tags: { value: [{ id: 1, name: '视力照顾' }] }
  })
}))

vi.mock('../useZoneData', () => ({
  useZoneData: () => ({
    zones: { value: [{ id: 'front-zone', name: '前排照顾区' }] }
  })
}))

vi.mock('../useStudentAttributes', () => ({
  useStudentAttributes: () => ({
    attributeDefinitions: {
      value: [
        { id: 'height', name: '身高', unit: 'cm' },
        { id: 'score', name: '成绩', unit: '分' }
      ]
    },
    getAttributeById: (id: string | null) => id ? { id, name: id === 'height' ? '身高' : '成绩', unit: id === 'height' ? 'cm' : '分' } : undefined
  })
}))

describe('useSeatRules', () => {
  let seatRules: ReturnType<typeof useSeatRules>

  beforeEach(() => {
    seatRules = useSeatRules()
    seatRules.rules.value = []
  })

  describe('addRule', () => {
    it('should add a new rule with default properties', () => {
      const result = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })

      expect(result.success).toBe(true)
      expect(seatRules.rules.value).toHaveLength(1)
      expect(seatRules.rules.value[0]).toMatchObject({
        id: expect.any(String),
        predicate: 'IN_ROW_RANGE',
        enabled: true
      })
    })

    it('should add an all-students numeric rule', () => {
      const result = seatRules.addRule({
        predicate: 'ATTRIBUTE_ROW_GRADIENT',
        subjects: [{ type: 'all', id: null }],
        params: { attributeId: 'height', direction: 'lowFront' }
      })

      expect(result.success).toBe(true)
      expect(seatRules.rules.value[0]).toMatchObject({
        predicate: 'ATTRIBUTE_ROW_GRADIENT',
        subjects: [{ type: 'all', id: null }]
      })
      expect(seatRules.renderRuleText(seatRules.rules.value[0])).toContain('全体学生')
    })

    it('should generate unique IDs for multiple rules', () => {
      const result1 = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })
      const result2 = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 2 }],
        params: { minRow: 1, maxRow: 3 }
      })

      expect(requireDefined(result1.rule).id).not.toBe(requireDefined(result2.rule).id)
      expect(seatRules.rules.value).toHaveLength(2)
    })
  })

  describe('numeric rule parameter safety', () => {
    const createBandRule = (bandCount: unknown) => ({
      predicate: 'ATTRIBUTE_DISTRIBUTE_BANDS',
      subjects: [{ type: 'all' as const, id: null }],
      params: { attributeId: 'score', bandCount: bandCount as number }
    })

    it.each([
      { label: 'numeric string', value: '3', warning: '必须是有限数字' },
      { label: 'NaN', value: Number.NaN, warning: '必须是有限数字' },
      { label: 'positive infinity', value: Number.POSITIVE_INFINITY, warning: '必须是有限数字' },
      { label: 'fractional layer count', value: 2.5, warning: '必须是整数' },
      { label: 'oversized layer count', value: maxRuleBandCount + 1, warning: `不能大于 ${maxRuleBandCount}` }
    ])('rejects $label without storing the rule', ({ value, warning }) => {
      const result = seatRules.addRule(createBandRule(value))

      expect(result.success).toBe(false)
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining(warning)]))
      expect(seatRules.rules.value).toHaveLength(0)
    })

    it.each([2, 3, maxRuleBandCount])('accepts valid bandCount %i', bandCount => {
      const result = seatRules.addRule(createBandRule(bandCount))

      expect(result.success).toBe(true)
      expect(seatRules.rules.value[0]?.params.bandCount).toBe(bandCount)
    })

    it('rejects malformed numeric params during JSON import', () => {
      const result = seatRules.importRules(JSON.stringify({
        rules: [createBandRule('3')]
      }))

      expect(result).toMatchObject({ success: true, imported: 0 })
      expect(result.errors).toHaveLength(1)
      expect(seatRules.rules.value).toHaveLength(0)
    })

    it('validates numeric params inside composite sub-rules', () => {
      const result = seatRules.addRule({
        ...createBandRule(3),
        logicOperator: 'AND',
        subRules: [
          { ...createBandRule(3), not: false },
          { ...createBandRule(maxRuleBandCount + 1), not: false }
        ]
      })

      expect(result.success).toBe(false)
      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining(`子规则 2：参数「分层数」不能大于 ${maxRuleBandCount}`)
      ]))
      expect(seatRules.rules.value).toHaveLength(0)
    })

    it('rejects an invalid numeric update and keeps the stored value', () => {
      const added = seatRules.addRule(createBandRule(3))
      const id = requireDefined(added.rule).id

      const updated = seatRules.updateRule(id, {
        params: { attributeId: 'score', bandCount: Number.POSITIVE_INFINITY }
      })

      expect(updated).toBe(false)
      expect(requireDefined(seatRules.rules.value[0]).params.bandCount).toBe(3)
    })
  })

  describe('renderRuleText', () => {
    it('renders a single-student position rule as natural language', () => {
      const text = seatRules.renderRuleText({
        priority: 'required',
        subjects: [{ type: 'person', id: 1 }],
        predicate: 'IN_ROW_RANGE',
        params: { minRow: 1, maxRow: 3 }
      })

      expect(text).toBe('张三必须坐在第 1 至 3 排。')
    })

    it('renders a pair relationship rule as natural language', () => {
      const text = seatRules.renderRuleText({
        priority: 'required',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        predicate: 'MUST_BE_SEATMATES',
        params: {}
      })

      expect(text).toBe('张三和李四必须安排为同桌。')
    })

    it('renders a tag rule as natural language', () => {
      const text = seatRules.renderRuleText({
        priority: 'prefer',
        subjects: [{ type: 'tag', id: 1 }],
        predicate: 'NOT_IN_COLUMN_TYPE',
        params: { columnType: 'wall' }
      })

      expect(text).toBe('带有「视力照顾」标签的学生尽量不要坐在墙边列。')
    })

    it('renders an all-students numeric rule as natural language', () => {
      const text = seatRules.renderRuleText({
        priority: 'prefer',
        subjects: [{ type: 'all', id: null }],
        predicate: 'ATTRIBUTE_ROW_GRADIENT',
        params: { attributeId: 'height', direction: 'lowFront' }
      })

      expect(text).toBe('全体学生尽量按身高（cm）形成低值靠前的前后梯度。')
    })

    it('renders a negated rule without structural negation markers', () => {
      const text = seatRules.renderRuleText({
        priority: 'prefer',
        subjects: [{ type: 'person', id: 1 }],
        predicate: 'IN_ROW_RANGE',
        not: true,
        params: { minRow: 1, maxRow: 2 }
      })

      expect(text).toBe('张三尽量不要坐在第 1 至 2 排。')
      expect(text).not.toContain('[非]')
    })

    it('renders a composite rule as a natural-language sentence', () => {
      const text = seatRules.renderRuleText({
        priority: 'prefer',
        subjects: [{ type: 'person', id: 1 }],
        logicOperator: 'AND',
        subRules: [
          {
            predicate: 'IN_ROW_RANGE',
            not: true,
            params: { minRow: 1, maxRow: 2 }
          },
          {
            predicate: 'NOT_IN_COLUMN_TYPE',
            not: false,
            params: { columnType: 'wall' }
          }
        ]
      })

      expect(text).toBe('对张三，尽量同时满足：不要坐在第 1 至 2 排，并且避开墙边列。')
      expect(text).not.toContain('[非]')
      expect(text).not.toContain('对象集合')
      expect(text).not.toContain('·')
    })
  })

  describe('updateRule', () => {
    it('should update rule properties', () => {
      const result = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })
      const id = requireDefined(result.rule).id

      seatRules.updateRule(id, {
        enabled: false,
        params: { minRow: 2, maxRow: 4 }
      })

      const rule = requireDefined(seatRules.rules.value.find(r => r.id === id))
      expect(rule.enabled).toBe(false)
      expect(rule.params.minRow).toBe(2)
      expect(rule.params.maxRow).toBe(4)
    })
  })

  describe('deleteRule', () => {
    it('should remove rule from list', () => {
      const result = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })
      expect(seatRules.rules.value).toHaveLength(1)

      seatRules.deleteRule(requireDefined(result.rule).id)
      expect(seatRules.rules.value).toHaveLength(0)
    })
  })

  describe('toggleRule', () => {
    it('should toggle rule enabled state', () => {
      const result = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })
      const resultRule = requireDefined(result.rule)
      const rule = requireDefined(seatRules.rules.value.find(r => r.id === resultRule.id))

      expect(rule.enabled).toBe(true)
      seatRules.toggleRule(resultRule.id)
      expect(rule.enabled).toBe(false)
      seatRules.toggleRule(resultRule.id)
      expect(rule.enabled).toBe(true)
    })
  })

  describe('getActiveRules', () => {
    it('should return only enabled rules', () => {
      const result1 = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })
      const result2 = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 2 }],
        params: { minRow: 1, maxRow: 3 }
      })
      const result3 = seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 3 }],
        params: { minRow: 1, maxRow: 3 }
      })

      const resultRule2 = requireDefined(result2.rule)
      seatRules.updateRule(resultRule2.id, { enabled: false })

      const activeRules = seatRules.getActiveRules()
      expect(activeRules).toHaveLength(2)
      expect(activeRules.find(r => r.id === resultRule2.id)).toBeUndefined()
    })
  })

  describe('detectConflicts', () => {
    it.each([
      ['top', 0],
      ['bottom', 6]
    ] as const)('uses %s podium direction and heterogeneous group rows for zone/range checks', (podiumPosition, rowIndex) => {
      seatRules.addRule({
        priority: 'required',
        predicate: 'IN_ZONE',
        subjects: [{ type: 'person', id: 1 }],
        params: { zoneId: 1 }
      })
      seatRules.addRule({
        priority: 'required',
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 1 }
      })

      const seatId = `seat-1-0-${rowIndex}`
      const conflicts = seatRules.detectConflicts({
        zones: [{ id: 1, name: '前排', tagIds: [], seatIds: [seatId], visible: true }]
      }, {
        seats: [{
          id: seatId,
          groupIndex: 1,
          columnIndex: 0,
          rowIndex,
          studentId: null,
          isEmpty: false
        }],
        seatConfig: {
          groupCount: 2,
          columnsPerGroup: 2,
          seatsPerColumn: 3,
          groups: [{ columns: 2, rows: 3 }, { columns: 2, rows: 7 }],
          shiftDistance: 4,
          podiumPosition
        }
      })

      expect(conflicts).toEqual([])
    })

    it.each([
      [1, false],
      [2, false],
      [3, true]
    ])('treats deskmates plus minimum distance %i as conflicting=%s', (distance, conflicting) => {
      seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_BE_SEATMATES',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {}
      })
      seatRules.addRule({
        priority: 'required',
        predicate: 'DISTANCE_AT_LEAST',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: { distance }
      })

      expect(seatRules.detectConflicts().some(conflict => conflict.type === 'infeasible')).toBe(conflicting)
    })

    it('does not report a deskmate/distance conflict for different student pairs', () => {
      seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_BE_SEATMATES',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {}
      })
      seatRules.addRule({
        priority: 'required',
        predicate: 'DISTANCE_AT_LEAST',
        subjects: [{ type: 'person', id: 2 }, { type: 'person', id: 3 }],
        params: { distance: 3 }
      })

      expect(seatRules.detectConflicts()).toEqual([])
    })

    it('canonicalizes supported negation before checking opposite pair rules', () => {
      seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_BE_SEATMATES',
        not: true,
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {}
      })
      seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_NOT_BE_SEATMATES',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {}
      })

      expect(seatRules.detectConflicts()).toEqual([])
    })

    it('still detects a positive opposite pair-rule contradiction', () => {
      seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_BE_SEATMATES',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {}
      })
      seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_NOT_BE_SEATMATES',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {}
      })

      const conflicts = seatRules.detectConflicts()

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('contradiction')
    })

    it('detects contradictory same-group conditions inside a required AND rule', () => {
      const added = seatRules.addRule({
        priority: 'required',
        predicate: 'MUST_BE_SAME_GROUP',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: {},
        logicOperator: 'AND',
        subRules: [
          { predicate: 'MUST_BE_SAME_GROUP', not: false, params: {} },
          { predicate: 'MUST_NOT_BE_SAME_GROUP', not: false, params: {} }
        ]
      })

      const conflicts = seatRules.detectConflicts()

      expect(added.success).toBe(true)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]).toMatchObject({
        type: 'contradiction',
        ruleIds: [added.rule?.id, added.rule?.id]
      })
    })

    it('detects incompatible distance bounds inside a required AND rule', () => {
      const added = seatRules.addRule({
        priority: 'required',
        predicate: 'DISTANCE_AT_MOST',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: { distance: 1 },
        logicOperator: 'AND',
        subRules: [
          { predicate: 'DISTANCE_AT_MOST', not: false, params: { distance: 1 } },
          { predicate: 'DISTANCE_AT_LEAST', not: false, params: { distance: 3 } }
        ]
      })

      const conflicts = seatRules.detectConflicts()

      expect(added.success).toBe(true)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]).toMatchObject({
        type: 'infeasible',
        ruleIds: [added.rule?.id, added.rule?.id]
      })
    })
  })

  describe('clearAllRules', () => {
    it('should remove all rules', () => {
      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minRow: 1, maxRow: 3 }
      })
      seatRules.addRule({
        predicate: 'IN_ROW_RANGE',
        subjects: [{ type: 'person', id: 2 }],
        params: { minRow: 1, maxRow: 3 }
      })

      expect(seatRules.rules.value).toHaveLength(2)

      seatRules.clearAllRules()
      expect(seatRules.rules.value).toHaveLength(0)
    })
  })
})
