import { describe, it, expect, beforeEach } from 'vitest'
import { useLogger, LogType } from '../useLogger'

describe('useLogger', () => {
  beforeEach(() => {
    const { clearLogs } = useLogger()
    clearLogs()
  })

  describe('addLog', () => {
    it('should add a log entry', () => {
      const { addLog, logs } = useLogger()

      addLog('Test message', LogType.INFO)

      expect(logs.value.length).toBe(1)
      expect(logs.value[0].message).toBe('Test message')
      expect(logs.value[0].type).toBe(LogType.INFO)
    })

    it('should add log with context', () => {
      const { addLog, logs } = useLogger()
      const context = { userId: 123, action: 'test' }

      addLog('Test message', LogType.ERROR, context)

      expect(logs.value[0].context).toEqual(context)
    })

    it('should generate unique IDs for logs', () => {
      const { addLog, logs } = useLogger()

      const id1 = addLog('Message 1', LogType.INFO)
      const id2 = addLog('Message 2', LogType.INFO)

      expect(id1).not.toBe(id2)
    })

    it('should add logs to the beginning of array', () => {
      const { addLog, logs } = useLogger()

      addLog('First', LogType.INFO)
      addLog('Second', LogType.INFO)

      expect(logs.value[0].message).toBe('Second')
      expect(logs.value[1].message).toBe('First')
    })

    it('should limit logs to MAX_LOGS', () => {
      const { addLog, logs } = useLogger()

      for (let i = 0; i < 150; i++) {
        addLog(`Message ${i}`, LogType.INFO)
      }

      expect(logs.value.length).toBe(100)
    })
  })

  describe('info', () => {
    it('should add info log', () => {
      const { info, logs } = useLogger()

      info('Info message')

      expect(logs.value[0].message).toBe('Info message')
      expect(logs.value[0].type).toBe(LogType.INFO)
    })
  })

  describe('success', () => {
    it('should add success log', () => {
      const { success, logs } = useLogger()

      success('Success message')

      expect(logs.value[0].message).toBe('Success message')
      expect(logs.value[0].type).toBe(LogType.SUCCESS)
    })
  })

  describe('warning', () => {
    it('should add warning log', () => {
      const { warning, logs } = useLogger()

      warning('Warning message')

      expect(logs.value[0].message).toBe('Warning message')
      expect(logs.value[0].type).toBe(LogType.WARNING)
    })
  })

  describe('error', () => {
    it('should add error log with string message', () => {
      const { error, logs } = useLogger()

      error('Error message')

      expect(logs.value[0].message).toBe('Error message')
      expect(logs.value[0].type).toBe(LogType.ERROR)
    })

    it('should handle Error objects', () => {
      const { error, logs } = useLogger()
      const err = new Error('Test error')

      error(err)

      expect(logs.value[0].message).toBe('Test error')
      expect(logs.value[0].type).toBe(LogType.ERROR)
      expect(logs.value[0].context.stack).toBeDefined()
      expect(logs.value[0].context.name).toBe('Error')
    })

    it('should merge context with Error object', () => {
      const { error, logs } = useLogger()
      const err = new Error('Test error')

      error(err, { additionalInfo: 'context' })

      expect(logs.value[0].context.additionalInfo).toBe('context')
      expect(logs.value[0].context.stack).toBeDefined()
    })
  })

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      const { info, clearLogs, logs } = useLogger()

      info('Message 1')
      info('Message 2')
      clearLogs()

      expect(logs.value.length).toBe(0)
    })
  })

  describe('removeLog', () => {
    it('should remove specific log by id', () => {
      const { info, removeLog, logs } = useLogger()

      const id1 = info('Message 1')
      const id2 = info('Message 2')
      removeLog(id1)

      expect(logs.value.length).toBe(1)
      expect(logs.value[0].message).toBe('Message 2')
    })

    it('should not throw when removing non-existent log', () => {
      const { removeLog } = useLogger()

      expect(() => removeLog(999)).not.toThrow()
    })
  })

  describe('LogType', () => {
    it('should have correct log types', () => {
      expect(LogType.INFO).toBe('info')
      expect(LogType.SUCCESS).toBe('success')
      expect(LogType.WARNING).toBe('warning')
      expect(LogType.ERROR).toBe('error')
    })
  })
})
