import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearUiApis, registerUiApis, type UiApiSet } from '@/services/uiFeedback'
import { useLogger } from '../useLogger'

const createApis = () => {
  const destroy = vi.fn()
  const message = {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => ({ destroy }))
  }
  return {
    apis: { message, dialog: {}, notification: {}, loadingBar: {} } as unknown as UiApiSet,
    message,
    destroy
  }
}

describe('useLogger feedback bridge', () => {
  beforeEach(() => {
    useLogger().clearLogs()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T00:00:00Z'))
  })

  afterEach(() => {
    clearUiApis()
    vi.useRealTimers()
  })

  it('deduplicates immediate feedback while retaining every activity log', () => {
    const { apis, message } = createApis()
    registerUiApis(apis)
    const logger = useLogger()

    logger.success('设置已保存')
    logger.success('设置已保存')

    expect(message.success).toHaveBeenCalledTimes(1)
    expect(logger.logs.value).toHaveLength(2)

    vi.advanceTimersByTime(1201)
    logger.success('设置已保存')
    expect(message.success).toHaveBeenCalledTimes(2)
  })

  it('records technical Error details without showing an immediate toast', () => {
    const { apis, message } = createApis()
    registerUiApis(apis)

    useLogger().error(new TypeError('network failed'), { operation: 'sync' })

    expect(message.error).not.toHaveBeenCalled()
    expect(useLogger().logs.value[0].context).toMatchObject({
      name: 'TypeError',
      operation: 'sync'
    })
  })

  it('returns a stable disposer for long-running task feedback', () => {
    const { apis, message, destroy } = createApis()
    registerUiApis(apis)

    const finish = useLogger().beginTask('正在导入')
    expect(message.loading).toHaveBeenCalledWith('正在导入', { duration: 0 })

    finish()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
