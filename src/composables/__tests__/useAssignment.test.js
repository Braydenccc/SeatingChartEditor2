import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAssignment } from '../useAssignment'

vi.mock('../useStudentData', () => ({
  useStudentData: () => ({
    students: { value: [] }
  })
}))

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => ({
    seats: { value: [] },
    assignStudent: vi.fn(),
    clearSeat: vi.fn(),
    areDeskmates: vi.fn(),
    getSeatDistance: vi.fn(),
    isInRowRange: vi.fn(),
    getColumnType: vi.fn()
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
    rules: { value: [] }
  })
}))

vi.mock('../useUndo', () => ({
  useUndo: () => ({
    recordBatch: vi.fn()
  })
}))

describe('useAssignment', () => {
  let assignment

  beforeEach(() => {
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
  })
})
