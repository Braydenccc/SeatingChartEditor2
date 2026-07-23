import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FilesView from '../FilesView.vue'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    token: ref<string | null>(null),
    isLoggedIn: ref(false),
    autoSaveBackup: ref<Record<string, unknown> | null>(null),
    workspaces: ref([{
      fileId: 'workspace-1',
      source: 'retiehe' as const,
      metadata: { name: '一班', time: '2026-07-24T01:00:00.000Z', size: 1024 }
    }]),
    workspaceCount: ref(1),
    totalSizeText: ref('1.0 KB'),
    recentWorkspaceName: ref('一班'),
    isRefreshing: ref(false),
    errorMessage: ref(''),
    isManagingCloud: ref(false),
    push: vi.fn(),
    refresh: vi.fn(async () => undefined),
    getAutoSaveBackup: vi.fn(async () => null),
    restoreAutoSaveBackup: vi.fn(),
    createNewWorkspace: vi.fn(),
    saveWorkspace: vi.fn(),
    saveWorkspaceAs: vi.fn(),
    loadWorkspace: vi.fn(),
    applyWorkspaceData: vi.fn(),
    saveLastWorkspace: vi.fn(),
    getLastWorkspace: vi.fn(),
    clearLastWorkspace: vi.fn(),
    getWorkspaceJson: vi.fn(),
    openCloudLoad: vi.fn(),
    openCloudSave: vi.fn(),
    saveWorkspaceToCloud: vi.fn(),
    loadWorkspaceFromCloud: vi.fn(),
    deleteWorkspaceFromCloud: vi.fn(),
    renameWorkspaceInCloud: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    confirm: vi.fn(),
    downloadTemplate: vi.fn(),
    exportToExcel: vi.fn(),
    parseSdesText: vi.fn(),
    getSdesImportTargets: vi.fn(),
    importSdesTarget: vi.fn(),
    exportCurrentSdes: vi.fn(),
    students: ref([]),
    tags: ref([]),
    beginExcelRosterImport: vi.fn()
  }
})

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ token: mocks.token, isLoggedIn: mocks.isLoggedIn })
}))
vi.mock('@/composables/useAutoSave', () => ({
  useAutoSave: () => ({
    autoSaveBackup: mocks.autoSaveBackup,
    getAutoSaveBackup: mocks.getAutoSaveBackup,
    restoreAutoSaveBackup: mocks.restoreAutoSaveBackup
  })
}))
vi.mock('@/composables/useWorkspace', () => ({
  useWorkspace: () => ({
    createNewWorkspace: mocks.createNewWorkspace,
    saveWorkspace: mocks.saveWorkspace,
    saveWorkspaceAs: mocks.saveWorkspaceAs,
    loadWorkspace: mocks.loadWorkspace,
    applyWorkspaceData: mocks.applyWorkspaceData,
    saveLastWorkspace: mocks.saveLastWorkspace,
    getLastWorkspace: mocks.getLastWorkspace,
    clearLastWorkspace: mocks.clearLastWorkspace,
    getWorkspaceJson: mocks.getWorkspaceJson
  })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
    confirm: mocks.confirm
  })
}))
vi.mock('@/composables/useCloudWorkspaceDialog', () => ({
  useCloudWorkspaceDialog: () => ({ openCloudLoad: mocks.openCloudLoad, openCloudSave: mocks.openCloudSave })
}))
vi.mock('@/composables/useCloudWorkspace', () => ({
  useCloudWorkspace: () => ({
    isFetching: mocks.isManagingCloud,
    saveWorkspaceToCloud: mocks.saveWorkspaceToCloud,
    loadWorkspaceFromCloud: mocks.loadWorkspaceFromCloud,
    deleteWorkspaceFromCloud: mocks.deleteWorkspaceFromCloud,
    renameWorkspaceInCloud: mocks.renameWorkspaceInCloud
  })
}))
vi.mock('@/composables/useCloudWorkspaceStats', () => ({
  useCloudWorkspaceStats: () => ({
    workspaces: mocks.workspaces,
    workspaceCount: mocks.workspaceCount,
    totalSizeText: mocks.totalSizeText,
    recentWorkspaceName: mocks.recentWorkspaceName,
    isRefreshing: mocks.isRefreshing,
    errorMessage: mocks.errorMessage,
    refresh: mocks.refresh
  })
}))
vi.mock('@/composables/useExcelData', () => ({
  useExcelData: () => ({ downloadTemplate: mocks.downloadTemplate, exportToExcel: mocks.exportToExcel })
}))
vi.mock('@/composables/useSdesExchange', () => ({
  formatSdesReportSummary: vi.fn(() => ''),
  useSdesExchange: () => ({
    parseSdesText: mocks.parseSdesText,
    getSdesImportTargets: mocks.getSdesImportTargets,
    importSdesTarget: mocks.importSdesTarget,
    exportCurrentSdes: mocks.exportCurrentSdes
  })
}))
vi.mock('@/composables/useStudentData', () => ({ useStudentData: () => ({ students: mocks.students }) }))
vi.mock('@/composables/useTagData', () => ({ useTagData: () => ({ tags: mocks.tags }) }))
vi.mock('@/composables/useRosterExcelImport', () => ({
  useRosterExcelImport: () => ({ beginExcelRosterImport: mocks.beginExcelRosterImport })
}))
vi.mock('@/platform/files', () => ({
  excelFileFilters: [],
  sdesFileFilters: [],
  openBinaryFile: vi.fn(),
  openTextFile: vi.fn()
}))

const mountView = () => mount(FilesView, {
  global: {
    stubs: {
      AppPageShell: { props: ['title', 'eyebrow'], template: '<main><slot /></main>' },
      FuckSeatsImportDialog: true,
      SdesImportDialog: true
    }
  }
})

describe('FilesView cloud refresh', () => {
  beforeEach(() => {
    mocks.token.value = null
    mocks.isLoggedIn.value = false
    mocks.autoSaveBackup.value = null
  })

  it('waits for a token and refreshes when login finishes after mount', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(mocks.refresh).not.toHaveBeenCalled()

    mocks.token.value = 'token'
    mocks.isLoggedIn.value = true
    await flushPromises()

    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('refreshes immediately for an already authenticated mount', async () => {
    mocks.token.value = 'token'
    mocks.isLoggedIn.value = true

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('names cloud workspace icon controls and the rename input', async () => {
    mocks.token.value = 'token'
    mocks.isLoggedIn.value = true
    mocks.autoSaveBackup.value = {
      data: { students: [], layout: { seats: [] } },
      size: 10,
      timeIso: '2026-07-24T01:00:00.000Z'
    }
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[aria-label="恢复自动保存"]').attributes('aria-label')).toBe('恢复自动保存')
    expect(wrapper.get('[aria-label="加载工作区"]').attributes('aria-label')).toBe('加载工作区')
    expect(wrapper.get('[aria-label="修改名称"]').attributes('aria-label')).toBe('修改名称')
    expect(wrapper.get('[aria-label="删除工作区"]').attributes('aria-label')).toBe('删除工作区')

    await wrapper.get('[aria-label="修改名称"]').trigger('click')
    expect(wrapper.get('input[aria-label="修改工作区 一班 的名称"]').attributes('aria-label')).toBe('修改工作区 一班 的名称')
    expect(wrapper.get('[aria-label="保存名称"]').attributes('aria-label')).toBe('保存名称')
    expect(wrapper.get('[aria-label="取消改名"]').attributes('aria-label')).toBe('取消改名')
    wrapper.unmount()
  })
})
