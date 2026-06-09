import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSeatRules } from '../useSeatRules'

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
    tags: { value: [{ id: 'care', name: '视力照顾' }] }
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
    getAttributeById: (id) => id ? { id, name: id === 'height' ? '身高' : '成绩', unit: id === 'height' ? 'cm' : '分' } : undefined
  })
}))

describe('useSeatRules', () => {
  let seatRules

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

      expect(result1.rule.id).not.toBe(result2.rule.id)
      expect(seatRules.rules.value).toHaveLength(2)
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
        subjects: [{ type: 'tag', id: 'care' }],
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
      const id = result.rule.id

      seatRules.updateRule(id, {
        enabled: false,
        params: { minRow: 2, maxRow: 4 }
      })

      const rule = seatRules.rules.value.find(r => r.id === id)
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

      seatRules.deleteRule(result.rule.id)
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
      const rule = seatRules.rules.value.find(r => r.id === result.rule.id)

      expect(rule.enabled).toBe(true)
      seatRules.toggleRule(result.rule.id)
      expect(rule.enabled).toBe(false)
      seatRules.toggleRule(result.rule.id)
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

      seatRules.updateRule(result2.rule.id, { enabled: false })

      const activeRules = seatRules.getActiveRules()
      expect(activeRules).toHaveLength(2)
      expect(activeRules.find(r => r.id === result2.rule.id)).toBeUndefined()
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
