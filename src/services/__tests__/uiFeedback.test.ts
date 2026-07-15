import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUiApis, registerUiApis, requestUiConfirm, type UiApiSet } from '../uiFeedback'

const createApis = () => {
  const warning = vi.fn()
  const error = vi.fn()
  const info = vi.fn()
  const apis = {
    message: {},
    dialog: { warning, error, info },
    notification: {},
    loadingBar: {}
  } as unknown as UiApiSet
  return { apis, warning, error, info }
}

describe('uiFeedback', () => {
  afterEach(clearUiApis)

  it('resolves an asynchronous confirmation from the shared dialog bridge', async () => {
    const { apis, warning } = createApis()
    registerUiApis(apis)

    const result = requestUiConfirm({ title: '覆盖数据', content: '确认覆盖当前工作区？' })
    const dialogOptions = warning.mock.calls[0][0]
    expect(dialogOptions.maskClosable).toBe(false)
    await dialogOptions.onPositiveClick()

    await expect(result).resolves.toBe(true)
  })

  it('resolves false when the dialog is cancelled or the bridge is unavailable', async () => {
    await expect(requestUiConfirm({ title: '确认', content: '继续？' })).resolves.toBe(false)

    const { apis, error } = createApis()
    registerUiApis(apis)
    const result = requestUiConfirm({ title: '清空', content: '继续？', type: 'error' })
    error.mock.calls[0][0].onEsc()

    await expect(result).resolves.toBe(false)
  })
})
