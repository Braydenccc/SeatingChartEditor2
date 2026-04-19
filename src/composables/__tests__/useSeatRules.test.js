import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSeatRules } from '../useSeatRules'

vi.mock('../useStudentData', () => ({
  useStudentData: () => ({
    students: { value: [] }
  })
}))

vi.mock('../useTagData', () => ({
  useTagData: () => ({
    tags: { value: [] }
  })
}))

vi.mock('../useZoneData', () => ({
  useZoneData: () => ({
    zones: { value: [] }
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
