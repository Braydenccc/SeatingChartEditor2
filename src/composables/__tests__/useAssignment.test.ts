import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAssignment } from '../useAssignment'
import { maxRuleBandCount } from '@/constants/ruleTypes'

const assignmentFixtures = vi.hoisted(() => ({
  students: { value: [] as any[] },
  seats: { value: [] as any[] },
  rules: { value: [] as any[] },
  seatConfig: {
    value: {
      groupCount: 2,
      columnsPerGroup: 1,
      seatsPerColumn: 1,
      groups: [
        { columns: 1, rows: 1 },
        { columns: 1, rows: 1 }
      ],
      podiumPosition: 'top',
      guardSeats: { includeInAutoAssignment: false }
    }
  },
  assignStudent: vi.fn(),
  clearAllSeats: vi.fn(),
  createSnapshot: vi.fn(() => ({})),
  recordBatch: vi.fn()
}))

vi.mock('../useStudentData', () => ({
  useStudentData: () => ({
    students: assignmentFixtures.students
  })
}))

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => ({
    seats: assignmentFixtures.seats,
    seatConfig: assignmentFixtures.seatConfig,
    assignStudent: assignmentFixtures.assignStudent,
    clearAllSeats: assignmentFixtures.clearAllSeats,
    getAvailableSeats: () => assignmentFixtures.seats.value,
    getEmptySeats: () => assignmentFixtures.seats.value.filter(seat => seat.studentId == null),
    areDeskmates: (seatId1: string, seatId2: string) => {
      const [, group1, column1, row1] = seatId1.split('-').map(Number)
      const [, group2, column2, row2] = seatId2.split('-').map(Number)
      const columnDistance = Math.abs(column1 - column2)
      return group1 === group2 && row1 === row2 && columnDistance >= 1 && columnDistance <= 2
    },
    getSeatDistance: vi.fn(() => 1),
    getAdjacentSeats: vi.fn(() => []),
    validateRepulsion: vi.fn(() => true),
    isInRowRange: (seatId: string, minRow: number, maxRow: number) => {
      const row = Number(seatId.split('-')[3]) + 1
      return row >= minRow && row <= maxRow
    },
    isColumnType: vi.fn(() => false),
    isDirectlyBehind: vi.fn(() => false),
    isAdjacentRow: vi.fn(() => false),
    isInGroupRange: (seatId: string, minGroup: number, maxGroup: number) => {
      const group = Number(seatId.split('-')[1]) + 1
      return group >= minGroup && group <= maxGroup
    },
    getTotalRows: vi.fn(() => 1),
    getSeatGroup: (seatId: string) => Number(seatId.split('-')[1]),
    getGroupConfig: (groupIndex: number) => assignmentFixtures.seatConfig.value.groups[groupIndex]
  })
}))

vi.mock('../useZoneData', () => ({
  useZoneData: () => ({
    zones: { value: [] },
    getZoneForSeat: vi.fn(() => null)
  })
}))

vi.mock('../useSeatRules', () => ({
  useSeatRules: () => ({
    rules: assignmentFixtures.rules,
    getActiveRules: () => assignmentFixtures.rules.value
  })
}))

vi.mock('../useUndo', () => ({
  useUndo: () => ({
    createSnapshot: assignmentFixtures.createSnapshot,
    recordBatch: assignmentFixtures.recordBatch
  })
}))

const createSeat = (id: string) => {
  const [, groupIndex = '0', columnIndex = '0', rowIndex = '0'] = id.split('-')
  return {
    id,
    groupIndex: Number(groupIndex),
    columnIndex: Number(columnIndex),
    rowIndex: Number(rowIndex),
    studentId: null,
    isEmpty: false,
    kind: 'regular'
  }
}

describe('useAssignment', () => {
  let assignment: ReturnType<typeof useAssignment>

  beforeEach(() => {
    assignmentFixtures.students.value = []
    assignmentFixtures.seats.value = []
    assignmentFixtures.rules.value = []
    assignmentFixtures.assignStudent.mockReset()
    assignmentFixtures.clearAllSeats.mockReset()
    assignmentFixtures.createSnapshot.mockClear()
    assignmentFixtures.recordBatch.mockReset()
    assignment = useAssignment()
  })

  describe('basic functionality', () => {
    it('should export useAssignment function', () => {
      expect(typeof useAssignment).toBe('function')
    })

    it('should return an object with expected methods', () => {
      expect(assignment).toBeDefined()
      expect(typeof assignment).toBe('object')
      expect(typeof assignment.runSmartAssignment).toBe('function')
      expect(typeof assignment.cancelSmartAssignment).toBe('function')
      expect(assignment.isAssignmentCancelRequested.value).toBe(false)
    })

    it('rejects an oversized bandCount before starting the assignment algorithm', async () => {
      assignmentFixtures.students.value = [{
        id: 1,
        name: '甲',
        numericAttributes: { score: 90 }
      }]
      assignmentFixtures.seats.value = [createSeat('seat-0-0-0')]
      assignmentFixtures.rules.value = [{
        id: 'unsafe-band-count',
        enabled: true,
        priority: 'prefer',
        predicate: 'ATTRIBUTE_DISTRIBUTE_BANDS',
        subjects: [{ type: 'all', id: null }],
        params: { attributeId: 'score', bandCount: maxRuleBandCount + 1 }
      }]

      const result = await assignment.runSmartAssignment({ iterations: 0 })

      expect(result.success).toBe(false)
      expect(result.message).toContain(`不能大于 ${maxRuleBandCount}`)
      expect(result.message).toContain('排位未开始')
      expect(assignmentFixtures.clearAllSeats).not.toHaveBeenCalled()
      expect(assignmentFixtures.assignStudent).not.toHaveBeenCalled()
    })

    it('should request cancellation when smart assignment is triggered while running', async () => {
      assignment.isAssigning.value = true

      const result = await assignment.runSmartAssignment()

      expect(result.success).toBe(false)
      expect(result.canceled).toBe(true)
      expect(result.message).toContain('中断')
      expect(assignment.isAssignmentCancelRequested.value).toBe(true)
    })

    it('should ignore cancellation when assignment is idle', () => {
      expect(assignment.cancelSmartAssignment()).toBe(false)
      expect(assignment.isAssignmentCancelRequested.value).toBe(false)
    })

    it('does not mutate seats when directly called with more students than available seats', async () => {
      const occupiedSeat = { ...createSeat('seat-0-0-0'), studentId: 2 }
      assignmentFixtures.students.value = [
        { id: 1, name: '甲' },
        { id: 2, name: '乙' }
      ]
      assignmentFixtures.seats.value = [occupiedSeat]

      const result = await assignment.runSmartAssignment({ useRules: false, iterations: 0 })

      expect(result.success).toBe(false)
      expect(result.message).toContain('可用座位不足')
      expect(occupiedSeat.studentId).toBe(2)
      expect(assignmentFixtures.clearAllSeats).not.toHaveBeenCalled()
      expect(assignmentFixtures.assignStudent).not.toHaveBeenCalled()
      expect(assignmentFixtures.createSnapshot).not.toHaveBeenCalled()
      expect(assignmentFixtures.recordBatch).not.toHaveBeenCalled()
    })
  })

  describe('negated rules', () => {
    it('does not pre-position a required negated group rule as its positive form', async () => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0)
      assignmentFixtures.students.value = [{ id: 1, name: '甲' }]
      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-1-0-0')
      ]
      assignmentFixtures.rules.value = [{
        id: 'not-first-group',
        enabled: true,
        priority: 'required',
        predicate: 'IN_GROUP_RANGE',
        not: true,
        subjects: [{ type: 'person', id: 1 }],
        params: { minGroup: 1, maxGroup: 1 }
      }]

      try {
        const result = await assignment.runSmartAssignment({ iterations: 0 })

        expect(result.success).toBe(true)
        expect(result.solution?.get(1)).toBe('seat-1-0-0')
      } finally {
        random.mockRestore()
      }
    })

    it('treats negated clustering as satisfied only when subjects are separated', async () => {
      assignmentFixtures.students.value = [
        { id: 1, name: '甲' },
        { id: 2, name: '乙' }
      ]
      assignmentFixtures.rules.value = [{
        id: 'negated-cluster',
        enabled: true,
        priority: 'prefer',
        predicate: 'CLUSTER_TOGETHER',
        not: true,
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: { scope: 'group' }
      }]

      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-0-0-1')
      ]
      const clusteredResult = await assignment.runSmartAssignment({ iterations: 0 })

      expect(clusteredResult.success).toBe(true)
      expect(clusteredResult.report?.violated).toHaveLength(1)

      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-1-0-0')
      ]
      const separatedResult = await assignment.runSmartAssignment({ iterations: 0 })
      const assignedGroups = [...(separatedResult.solution?.values() ?? [])]
        .map(seatId => Number(seatId.split('-')[1]))

      expect(separatedResult.success).toBe(true)
      expect(new Set(assignedGroups).size).toBe(2)
      expect(separatedResult.report?.satisfied).toHaveLength(1)
      expect(separatedResult.report?.violated).toHaveLength(0)
    })

    it('negates evaluated numeric pair rules but skips missing numeric values', async () => {
      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-1-0-0')
      ]
      assignmentFixtures.rules.value = [{
        id: 'negated-pair-delta',
        enabled: true,
        priority: 'prefer',
        predicate: 'ATTRIBUTE_PAIR_DELTA',
        not: true,
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: { attributeId: 'score', maxDelta: 10 }
      }]
      assignmentFixtures.students.value = [
        { id: 1, name: '甲', numericAttributes: { score: 10 } },
        { id: 2, name: '乙', numericAttributes: { score: 30 } }
      ]

      const exceededResult = await assignment.runSmartAssignment({ iterations: 0 })

      expect(exceededResult.success).toBe(true)
      expect(exceededResult.report?.satisfied).toHaveLength(1)
      expect(exceededResult.report?.violated).toHaveLength(0)

      assignmentFixtures.students.value = [
        { id: 1, name: '甲', numericAttributes: { score: 10 } },
        { id: 2, name: '乙', numericAttributes: {} }
      ]
      const missingValueResult = await assignment.runSmartAssignment({ iterations: 0 })

      expect(missingValueResult.success).toBe(true)
      expect(missingValueResult.report?.satisfied).toHaveLength(1)
      expect(missingValueResult.report?.violated).toHaveLength(0)
    })
  })

  describe('required rule enforcement', () => {
    it('keeps required rules ahead of any number of conflicting preferences', async () => {
      let seed = 17
      const random = vi.spyOn(Math, 'random').mockImplementation(() => {
        seed = (seed * 48271) % 2147483647
        return seed / 2147483647
      })
      assignmentFixtures.students.value = [
        { id: 1, name: '甲' },
        { id: 2, name: '乙' }
      ]
      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-1-0-0')
      ]
      assignmentFixtures.rules.value = [
        {
          id: 'required-first-group',
          enabled: true,
          priority: 'required',
          predicate: 'IN_GROUP_RANGE',
          subjects: [{ type: 'person', id: 1 }],
          params: { minGroup: 1, maxGroup: 1 }
        },
        ...Array.from({ length: 150 }, (_, index) => ({
          id: `prefer-second-group-${index}`,
          enabled: true,
          priority: 'prefer',
          predicate: 'IN_GROUP_RANGE',
          subjects: [{ type: 'person', id: 1 }],
          params: { minGroup: 2, maxGroup: 2 }
        }))
      ]

      try {
        const result = await assignment.runSmartAssignment({ iterations: 200 })

        expect(result.success).toBe(true)
        expect(result.solution?.get(1)).toBe('seat-0-0-0')
        expect(result.report?.violated).toHaveLength(150)
      } finally {
        random.mockRestore()
      }
    })

    it('does not mutate seats when the final solution still violates a required rule', async () => {
      assignmentFixtures.students.value = [{ id: 1, name: '甲' }]
      assignmentFixtures.seats.value = [createSeat('seat-0-0-0')]
      assignmentFixtures.rules.value = [{
        id: 'impossible-required-group',
        enabled: true,
        priority: 'required',
        predicate: 'IN_GROUP_RANGE',
        subjects: [{ type: 'person', id: 1 }],
        params: { minGroup: 2, maxGroup: 2 }
      }]

      const result = await assignment.runSmartAssignment({ iterations: 0 })

      expect(result.success).toBe(false)
      expect(result.message).toContain('必须规则未满足')
      expect(assignmentFixtures.clearAllSeats).not.toHaveBeenCalled()
      expect(assignmentFixtures.assignStudent).not.toHaveBeenCalled()
      expect(assignmentFixtures.createSnapshot).not.toHaveBeenCalled()
      expect(assignmentFixtures.recordBatch).not.toHaveBeenCalled()
    })

    it('commits and reports an exact required continuous rule with a zero value range', async () => {
      assignmentFixtures.students.value = [
        { id: 1, name: '甲', numericAttributes: { score: 10 } },
        { id: 2, name: '乙', numericAttributes: { score: 10 } }
      ]
      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-1-0-0')
      ]
      assignmentFixtures.rules.value = [{
        id: 'required-near-balance',
        enabled: true,
        priority: 'required',
        predicate: 'ATTRIBUTE_GROUP_BALANCE',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: { attributeId: 'score', aggregate: 'average' }
      }]

      const result = await assignment.runSmartAssignment({ iterations: 0 })

      expect(result.success).toBe(true)
      expect(result.report?.satisfied).toHaveLength(1)
      expect(result.report?.violated).toHaveLength(0)
      expect(assignmentFixtures.clearAllSeats).toHaveBeenCalledOnce()
      expect(assignmentFixtures.recordBatch).toHaveBeenCalledOnce()
    })

    it('keeps the original seats and reports a required continuous rule outside tolerance', async () => {
      assignmentFixtures.students.value = [
        { id: 1, name: '甲', numericAttributes: { score: 10 } },
        { id: 2, name: '乙', numericAttributes: { score: 10.3 } }
      ]
      assignmentFixtures.seats.value = [
        createSeat('seat-0-0-0'),
        createSeat('seat-1-0-0')
      ]
      assignmentFixtures.rules.value = [{
        id: 'required-imbalanced',
        enabled: true,
        priority: 'required',
        predicate: 'ATTRIBUTE_GROUP_BALANCE',
        subjects: [{ type: 'person', id: 1 }, { type: 'person', id: 2 }],
        params: { attributeId: 'score', aggregate: 'average' }
      }]

      const result = await assignment.runSmartAssignment({ iterations: 0 })

      expect(result.success).toBe(false)
      expect(result.report?.satisfied).toHaveLength(0)
      expect(result.report?.violated).toHaveLength(1)
      expect(assignmentFixtures.clearAllSeats).not.toHaveBeenCalled()
      expect(assignmentFixtures.recordBatch).not.toHaveBeenCalled()
    })
  })
})
