import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useConfirmAction } from '../useConfirmAction'

describe('useConfirmAction', () => {
  describe('requestConfirm', () => {
    it('should return false on first call and register action', () => {
      const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-1')
      const action = vi.fn()

      const result = requestConfirm('test-action-1', action, '确认操作')

      expect(result).toBe(false)
      expect(isConfirming('test-action-1').value).toBe(true)
      expect(action).not.toHaveBeenCalled()
      cancelConfirm('test-action-1')
    })

    it('should execute action on second call', () => {
      const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-2')
      const action = vi.fn()

      requestConfirm('test-action-2', action, '确认操作')
      const result = requestConfirm('test-action-2', action, '确认操作')

      expect(result).toBe(true)
      expect(action).toHaveBeenCalledTimes(1)
      expect(isConfirming('test-action-2').value).toBe(false)
    })

    it('should execute the second action parameter if provided', () => {
      const { requestConfirm, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-3')
      const firstAction = vi.fn()
      const secondAction = vi.fn()

      requestConfirm('test-action-3', firstAction, '确认操作')
      requestConfirm('test-action-3', secondAction, '确认操作')

      expect(firstAction).not.toHaveBeenCalled()
      expect(secondAction).toHaveBeenCalledTimes(1)
    })

    it('should handle different action keys independently', () => {
      const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
      cancelConfirm('action-1')
      cancelConfirm('action-2')
      const action1 = vi.fn()
      const action2 = vi.fn()

      requestConfirm('action-1', action1, '确认操作1')
      requestConfirm('action-2', action2, '确认操作2')

      expect(isConfirming('action-1').value).toBe(true)
      expect(isConfirming('action-2').value).toBe(true)

      requestConfirm('action-1', action1, '确认操作1')

      expect(action1).toHaveBeenCalledTimes(1)
      expect(action2).not.toHaveBeenCalled()
      expect(isConfirming('action-1').value).toBe(false)
      expect(isConfirming('action-2').value).toBe(true)
      cancelConfirm('action-2')
    })
  })

  describe('isConfirming', () => {
    it('should return computed ref that updates when confirmation state changes', () => {
      const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-4')
      const action = vi.fn()

      const confirming = isConfirming('test-action-4')
      expect(confirming.value).toBe(false)

      requestConfirm('test-action-4', action, '确认操作')
      expect(confirming.value).toBe(true)

      requestConfirm('test-action-4', action, '确认操作')
      expect(confirming.value).toBe(false)
    })
  })

  describe('getRemainingTime', () => {
    it('should return 0 when no action is pending', () => {
      const { getRemainingTime } = useConfirmAction()

      const remaining = getRemainingTime('non-existent')
      expect(remaining.value).toBe(0)
    })

    it('should return positive time when action is pending', () => {
      const { requestConfirm, getRemainingTime, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-5')
      const action = vi.fn()

      requestConfirm('test-action-5', action, '确认操作')
      const remaining = getRemainingTime('test-action-5')
      expect(remaining.value).toBeGreaterThan(0)
      expect(remaining.value).toBeLessThanOrEqual(3000)
      cancelConfirm('test-action-5')
    })
  })

  describe('isPending', () => {
    it('should return true when action is pending', () => {
      const { requestConfirm, isPending, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-6')
      const action = vi.fn()

      expect(isPending('test-action-6')).toBe(false)

      requestConfirm('test-action-6', action, '确认操作')
      expect(isPending('test-action-6')).toBe(true)
      cancelConfirm('test-action-6')
    })

    it('should return false after confirmation', () => {
      const { requestConfirm, isPending, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-7')
      const action = vi.fn()

      requestConfirm('test-action-7', action, '确认操作')
      requestConfirm('test-action-7', action, '确认操作')

      expect(isPending('test-action-7')).toBe(false)
    })
  })

  describe('cancelConfirm', () => {
    it('should cancel pending confirmation', () => {
      const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-8')
      const action = vi.fn()

      requestConfirm('test-action-8', action, '确认操作')
      expect(isConfirming('test-action-8').value).toBe(true)

      cancelConfirm('test-action-8')
      expect(isConfirming('test-action-8').value).toBe(false)
    })

    it('should not throw when canceling non-existent action', () => {
      const { cancelConfirm } = useConfirmAction()

      expect(() => cancelConfirm('non-existent')).not.toThrow()
    })

    it('should prevent action from executing after cancel', () => {
      const { requestConfirm, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-9')
      const action = vi.fn()

      requestConfirm('test-action-9', action, '确认操作')
      cancelConfirm('test-action-9')
      
      const result = requestConfirm('test-action-9', action, '确认操作')
      expect(result).toBe(false)
      expect(action).not.toHaveBeenCalled()
    })
  })

  describe('default message', () => {
    it('should use default message when not provided', () => {
      const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
      cancelConfirm('test-action-10')
      const action = vi.fn()

      requestConfirm('test-action-10', action)

      expect(isConfirming('test-action-10').value).toBe(true)
      cancelConfirm('test-action-10')
    })
  })
})
