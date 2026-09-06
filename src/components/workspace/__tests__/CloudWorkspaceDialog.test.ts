import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CloudWorkspaceDialog from '../CloudWorkspaceDialog.vue'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    isFetching: ref(false),
    token: ref<string | null>('token'),
    webdavConfig: ref({ url: 'https://dav.example.test', username: 'tester', password: 'secret' }),
    authType: ref<'retiehe' | 'webdav'>('retiehe'),
    backupMode: ref(false),
    listWorkspaces: vi.fn(),
    saveWorkspaceToCloud: vi.fn(),
    loadWorkspaceFromCloud: vi.fn(),
    deleteWorkspaceFromCloud: vi.fn(),
    getWorkspaceJson: vi.fn(() => '{"version":1}'),
    applyWorkspaceData: vi.fn(),
    saveLastWorkspace: vi.fn(),
    getLastWorkspace: vi.fn(),
    clearLastWorkspace: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    confirm: vi.fn()
  }
})

vi.mock('@/composables/useCloudWorkspace', () => ({
  useCloudWorkspace: () => ({
    isFetching: mocks.isFetching,
    listWorkspaces: mocks.listWorkspaces,
    saveWorkspaceToCloud: mocks.saveWorkspaceToCloud,
    loadWorkspaceFromCloud: mocks.loadWorkspaceFromCloud,
    deleteWorkspaceFromCloud: mocks.deleteWorkspaceFromCloud
  })
}))
vi.mock('@/composables/useWorkspace', () => ({
  useWorkspace: () => ({
    getWorkspaceJson: mocks.getWorkspaceJson,
    applyWorkspaceData: mocks.applyWorkspaceData,
    saveLastWorkspace: mocks.saveLastWorkspace,
    getLastWorkspace: mocks.getLastWorkspace,
    clearLastWorkspace: mocks.clearLastWorkspace
  })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ success: mocks.success, warning: mocks.warning, error: mocks.error, confirm: mocks.confirm })
}))
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    token: mocks.token,
    webdavConfig: mocks.webdavConfig,
    authType: mocks.authType,
    backupMode: mocks.backupMode
  })
}))

const workspaces = [
  {
    fileId: 'sce-workspace',
    source: 'retiehe' as const,
    metadata: { name: '一班', time: '2026-07-24T01:00:00.000Z' }
  },
  {
    fileId: 'dav-workspace',
    source: 'webdav' as const,
    metadata: { name: '二班', time: '2026-07-24T02:00:00.000Z' }
  }
]

const mountedWrappers: Array<ReturnType<typeof mount>> = []

const mountDialog = async (mode: 'load' | 'save' = 'save') => {
  const wrapper = mount(CloudWorkspaceDialog, {
    props: { visible: true, mode },
    global: {
      stubs: {
        ResponsiveOverlay: {
          props: ['show', 'title', 'busy', 'desktopWidth'],
          template: '<div><slot /></div>'
        }
      }
    }
  })
  mountedWrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => {
  const button = wrapper.findAll('button').find(item => item.text().includes(text))
  if (!button) throw new Error(`未找到按钮：${text}`)
  return button
}

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

describe('CloudWorkspaceDialog', () => {
  beforeEach(() => {
    mocks.isFetching.value = false
    mocks.token.value = 'token'
    mocks.webdavConfig.value = { url: 'https://dav.example.test', username: 'tester', password: 'secret' }
    mocks.authType.value = 'retiehe'
    mocks.backupMode.value = false
    mocks.listWorkspaces.mockReset()
    mocks.listWorkspaces.mockResolvedValue({ success: true, data: workspaces })
    mocks.saveWorkspaceToCloud.mockReset()
    mocks.saveWorkspaceToCloud.mockResolvedValue({ success: true, data: { fileId: 'saved-workspace' } })
    mocks.loadWorkspaceFromCloud.mockReset()
    mocks.loadWorkspaceFromCloud.mockResolvedValue({ success: false })
    mocks.warning.mockReset()
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('blocks an implicit same-name overwrite until the user selects the workspace', async () => {
    const wrapper = await mountDialog()

    await wrapper.get('#cloud-workspace-name').setValue('一班')
    await findButtonByText(wrapper, '保存为新工作区').trigger('click')

    expect(mocks.saveWorkspaceToCloud).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('已存在同名工作区，请从列表选择后覆盖，或更换名称')
  })

  it('uses the selected workspace id for an explicit overwrite', async () => {
    const wrapper = await mountDialog()
    const row = wrapper.get('[aria-label="覆盖工作区 一班"]')

    await row.trigger('keydown', { key: 'Enter' })
    expect(row.attributes('aria-pressed')).toBe('true')
    await findButtonByText(wrapper, '覆盖已有工作区').trigger('click')
    await flushPromises()

    expect(mocks.saveWorkspaceToCloud).toHaveBeenCalledWith(
      '一班',
      '{"version":1}',
      'sce-workspace',
      'retiehe'
    )
  })

  it('shows a warning when SCE save succeeds but its WebDAV backup fails', async () => {
    mocks.saveWorkspaceToCloud.mockResolvedValueOnce({
      success: true,
      data: { fileId: 'saved-workspace' },
      backupWarning: 'SCE 云端已保存，但 WebDAV 备份失败'
    })
    const wrapper = await mountDialog()

    await wrapper.get('#cloud-workspace-name').setValue('三班')
    await findButtonByText(wrapper, '保存为新工作区').trigger('click')
    await flushPromises()

    expect(mocks.warning).toHaveBeenCalledWith('SCE 云端已保存，但 WebDAV 备份失败')
  })

  it('blocks repeated keyboard saves while the first cloud save is pending', async () => {
    const deferred = createDeferred<{ success: boolean; data: { fileId: string } }>()
    mocks.saveWorkspaceToCloud.mockReturnValueOnce(deferred.promise)
    const wrapper = await mountDialog()
    const input = wrapper.get('#cloud-workspace-name')

    await input.setValue('三班')
    await input.trigger('keyup', { key: 'Enter' })
    await input.trigger('keyup', { key: 'Enter' })

    expect(mocks.saveWorkspaceToCloud).toHaveBeenCalledTimes(1)
    expect(input.attributes('disabled')).toBeDefined()

    deferred.resolve({ success: true, data: { fileId: 'saved-workspace' } })
    await flushPromises()
  })

  it('clears the selected file id on both provider switches while preserving the name', async () => {
    const wrapper = await mountDialog()
    const providerButtons = wrapper.findAll('.n-radio-button')
    const sceProvider = providerButtons.find(item => item.text().includes('SCE 云服务'))
    const webdavProvider = providerButtons.find(item => item.text().includes('WebDAV 网盘'))
    if (!sceProvider || !webdavProvider) throw new Error('未找到云服务选择器')

    await wrapper.get('[aria-label="覆盖工作区 一班"]').trigger('click')
    await webdavProvider.get('input[type="radio"]').setValue(true)
    expect(wrapper.get('#cloud-workspace-name').element).toHaveProperty('value', '一班')
    expect(findButtonByText(wrapper, '保存为新工作区').exists()).toBe(true)

    await wrapper.get('[aria-label="覆盖工作区 二班"]').trigger('click')
    await sceProvider.get('input[type="radio"]').setValue(true)
    expect(wrapper.get('#cloud-workspace-name').element).toHaveProperty('value', '二班')
    expect(findButtonByText(wrapper, '保存为新工作区').exists()).toBe(true)
  })

  it('loads a workspace from the keyboard and names icon-only delete buttons', async () => {
    mocks.loadWorkspaceFromCloud.mockResolvedValue({
      success: true,
      data: { content: '{"version":1}' }
    })
    mocks.applyWorkspaceData.mockResolvedValue(true)
    const wrapper = await mountDialog('load')

    await wrapper.get('[aria-label="加载工作区 一班"]').trigger('keydown', { key: ' ' })
    await flushPromises()

    expect(mocks.loadWorkspaceFromCloud).toHaveBeenCalledWith('sce-workspace', 'retiehe')
    expect(wrapper.get('[aria-label="删除工作区 一班"]').attributes('aria-label')).toBe('删除工作区 一班')
  })
})
