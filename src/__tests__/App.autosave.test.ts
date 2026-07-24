import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    token: ref<string | null>(null),
    webdavConfig: ref<Record<string, unknown> | null>(null),
    isLoginDialogVisible: ref(false),
    showCloudDialog: ref(false),
    cloudDialogMode: ref<'load' | 'save'>('load'),
    isWelcomeIntroVisible: ref(false),
    autoSaveBackup: ref<Record<string, unknown> | null>(null),
    settings: ref({
      editor: { undoHistorySize: 50 },
      ui: { enableAnimations: true }
    }),
    canUndo: ref(false),
    canRedo: ref(false),
    initAuth: vi.fn(async () => undefined),
    loadWorkspaceFromCloud: vi.fn(),
    applyWorkspaceData: vi.fn(),
    getLastWorkspace: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    setMaxHistory: vi.fn(),
    handleCloudSuccess: vi.fn(),
    applyThemeColor: vi.fn(),
    applyColorScheme: vi.fn(),
    startAutoSave: vi.fn(),
    flushAutoSave: vi.fn(async () => undefined),
    getAutoSaveBackup: vi.fn(),
    restoreAutoSaveBackup: vi.fn(),
    discardAutoSaveRecovery: vi.fn(),
    showWelcomeIntroIfNeeded: vi.fn(),
    initializeTags: vi.fn()
  }
})

vi.mock('vue-router', () => ({
  RouterView: { template: '<main />' }
}))
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    isLoginDialogVisible: mocks.isLoginDialogVisible,
    initAuth: mocks.initAuth,
    token: mocks.token,
    webdavConfig: mocks.webdavConfig
  })
}))
vi.mock('@/composables/useCloudWorkspace', () => ({
  useCloudWorkspace: () => ({ loadWorkspaceFromCloud: mocks.loadWorkspaceFromCloud })
}))
vi.mock('@/composables/useWorkspace', () => ({
  useWorkspace: () => ({
    applyWorkspaceData: mocks.applyWorkspaceData,
    getLastWorkspace: mocks.getLastWorkspace
  })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error
  })
}))
vi.mock('@/composables/useUndo', () => ({
  useUndo: () => ({
    undo: mocks.undo,
    redo: mocks.redo,
    canUndo: mocks.canUndo,
    canRedo: mocks.canRedo,
    setMaxHistory: mocks.setMaxHistory
  })
}))
vi.mock('@/composables/useCloudWorkspaceDialog', () => ({
  useCloudWorkspaceDialog: () => ({
    showCloudDialog: mocks.showCloudDialog,
    cloudDialogMode: mocks.cloudDialogMode,
    handleCloudSuccess: mocks.handleCloudSuccess
  })
}))
vi.mock('@/composables/useGlobalSettings', () => ({
  useGlobalSettings: () => ({
    settings: mocks.settings,
    applyThemeColor: mocks.applyThemeColor,
    applyColorScheme: mocks.applyColorScheme
  })
}))
vi.mock('@/composables/useAutoSave', () => ({
  useAutoSave: () => ({
    startAutoSave: mocks.startAutoSave,
    flushAutoSave: mocks.flushAutoSave,
    autoSaveBackup: mocks.autoSaveBackup,
    getAutoSaveBackup: mocks.getAutoSaveBackup,
    restoreAutoSaveBackup: mocks.restoreAutoSaveBackup,
    discardAutoSaveRecovery: mocks.discardAutoSaveRecovery
  })
}))
vi.mock('@/composables/useWelcomeOnboarding', () => ({
  useWelcomeOnboarding: () => ({
    isWelcomeIntroVisible: mocks.isWelcomeIntroVisible,
    showWelcomeIntroIfNeeded: mocks.showWelcomeIntroIfNeeded
  })
}))
vi.mock('@/composables/useTagData', () => ({ initializeTags: mocks.initializeTags }))

vi.mock('@/components/providers/AppUiProvider.vue', () => ({
  default: { template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/GlobalDropZone.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/ui/ResponsiveOverlay.vue', () => ({
  default: {
    props: ['show'],
    template: '<section v-if="show"><slot /><slot name="footer" /></section>'
  }
}))
vi.mock('@/components/student/RosterExcelImportDialog.vue', () => ({
  default: { template: '<div />' }
}))

const backup = {
  data: {
    students: [{ id: 1, name: '张三', studentNumber: 1, tags: [] }],
    layout: { seats: [{ id: 'seat-0-0-0', studentId: 1 }] }
  },
  time: new Date('2026-07-05T08:00:00.000Z'),
  timeIso: '2026-07-05T08:00:00.000Z',
  size: 128,
  slot: 'recovery-pending',
  snapshotId: 'snapshot-1'
}

const wrappers: VueWrapper[] = []

const mountApp = () => {
  const wrapper = mount(App, {
    global: {
      stubs: {
        RosterExcelImportDialog: true,
        LoginDialog: true,
        CloudWorkspaceDialog: true,
        WelcomeIntroDialog: true,
        NButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
        },
        History: true,
        RotateCcw: true
      }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('App autosave startup coordination', () => {
  beforeEach(() => {
    mocks.token.value = null
    mocks.webdavConfig.value = null
    mocks.isLoginDialogVisible.value = false
    mocks.showCloudDialog.value = false
    mocks.isWelcomeIntroVisible.value = false
    mocks.autoSaveBackup.value = null
    mocks.getLastWorkspace.mockReturnValue(null)
    mocks.loadWorkspaceFromCloud.mockResolvedValue({ success: false })
    mocks.applyWorkspaceData.mockResolvedValue(true)
    mocks.getAutoSaveBackup.mockResolvedValue(null)
    mocks.restoreAutoSaveBackup.mockResolvedValue(true)
    mocks.discardAutoSaveRecovery.mockResolvedValue(true)
    window.requestIdleCallback = vi.fn()
  })

  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('does not enable the autosave watcher while the protected startup prompt is unresolved', async () => {
    let resolveBackup: ((value: typeof backup) => void) | undefined
    mocks.getAutoSaveBackup.mockImplementationOnce(() => new Promise((resolve) => {
      resolveBackup = resolve
    }))

    mountApp()
    await flushPromises()

    expect(mocks.getAutoSaveBackup).toHaveBeenCalledWith({
      preserveCurrentAsRecovery: true
    })
    expect(mocks.startAutoSave).not.toHaveBeenCalled()

    mocks.autoSaveBackup.value = backup
    resolveBackup?.(backup)
    await flushPromises()

    expect(mocks.startAutoSave).not.toHaveBeenCalled()
  })

  it('starts autosave immediately when startup has no recovery candidate', async () => {
    mountApp()
    await flushPromises()

    expect(mocks.startAutoSave).toHaveBeenCalledTimes(1)
    expect(mocks.showWelcomeIntroIfNeeded).toHaveBeenCalledTimes(1)
  })

  it('keeps the recovery candidate when the user defers and then restores the last cloud workspace', async () => {
    mocks.token.value = 'token'
    mocks.autoSaveBackup.value = backup
    mocks.getAutoSaveBackup.mockResolvedValue(backup)
    mocks.getLastWorkspace.mockReturnValue({
      type: 'cloud',
      fileId: 'cloud-1',
      name: '一班',
      source: 'retiehe'
    })
    mocks.loadWorkspaceFromCloud.mockResolvedValue({
      success: true,
      data: { content: { students: [], layout: { seats: [] } } }
    })

    const wrapper = mountApp()
    await flushPromises()
    expect(mocks.startAutoSave).not.toHaveBeenCalled()
    const deferButton = wrapper.findAll('button').find(button => button.text().includes('稍后处理'))
    expect(deferButton).toBeDefined()

    await deferButton?.trigger('click')
    await flushPromises()

    expect(mocks.autoSaveBackup.value).toMatchObject({
      slot: 'recovery-pending',
      snapshotId: 'snapshot-1'
    })
    expect(mocks.discardAutoSaveRecovery).not.toHaveBeenCalled()
    expect(mocks.startAutoSave).toHaveBeenCalledTimes(1)
    expect(mocks.loadWorkspaceFromCloud).toHaveBeenCalledWith('cloud-1', 'retiehe')
    expect(mocks.applyWorkspaceData).toHaveBeenCalledWith({ students: [], layout: { seats: [] } })
  })

  it('consumes the protected candidate only when the user explicitly ignores it', async () => {
    mocks.autoSaveBackup.value = backup
    mocks.getAutoSaveBackup.mockResolvedValue(backup)

    const wrapper = mountApp()
    await flushPromises()
    expect(mocks.startAutoSave).not.toHaveBeenCalled()
    const discardButton = wrapper.findAll('button').find(button => button.text().includes('忽略此备份'))
    expect(discardButton).toBeDefined()

    await discardButton?.trigger('click')
    await flushPromises()

    expect(mocks.discardAutoSaveRecovery).toHaveBeenCalledTimes(1)
    expect(mocks.startAutoSave).toHaveBeenCalledTimes(1)
    expect(mocks.discardAutoSaveRecovery.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startAutoSave.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(mocks.initializeTags.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startAutoSave.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(mocks.flushAutoSave).not.toHaveBeenCalled()
    expect(mocks.showWelcomeIntroIfNeeded).toHaveBeenCalled()

    mocks.getAutoSaveBackup.mockResolvedValue(null)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    const reloadedWrapper = mountApp()
    await flushPromises()

    expect(reloadedWrapper.text()).not.toContain('恢复自动保存')
    expect(mocks.startAutoSave).toHaveBeenCalledTimes(2)
  })

  it('starts autosave after restore without loading the previous cloud workspace over it', async () => {
    mocks.token.value = 'token'
    mocks.autoSaveBackup.value = backup
    mocks.getAutoSaveBackup.mockResolvedValue(backup)
    mocks.getLastWorkspace.mockReturnValue({
      type: 'cloud',
      fileId: 'cloud-1',
      name: '一班',
      source: 'retiehe'
    })

    const wrapper = mountApp()
    await flushPromises()
    expect(mocks.startAutoSave).not.toHaveBeenCalled()
    const restoreButton = wrapper.findAll('button').find(button => button.text().includes('恢复自动保存'))
    expect(restoreButton).toBeDefined()

    await restoreButton?.trigger('click')
    await flushPromises()

    expect(mocks.restoreAutoSaveBackup).toHaveBeenCalledWith(mocks.autoSaveBackup.value)
    expect(mocks.startAutoSave).toHaveBeenCalledTimes(1)
    expect(mocks.loadWorkspaceFromCloud).not.toHaveBeenCalled()
    expect(mocks.showWelcomeIntroIfNeeded).toHaveBeenCalledTimes(1)
  })
})
