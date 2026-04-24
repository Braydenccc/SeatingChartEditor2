import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCloudWorkspace } from '../useCloudWorkspace'

const {
  mockListFiles,
  mockPutFile,
  mockGetFileText,
  mockDeleteFile,
  mockFetchWithRetry,
  mockLoggerError,
  mockCurrentUser,
  mockToken,
  mockAuthType,
  mockWebdavConfig,
  mockBackupMode
} = vi.hoisted(() => ({
  mockListFiles: vi.fn(),
  mockPutFile: vi.fn(),
  mockGetFileText: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockFetchWithRetry: vi.fn(),
  mockLoggerError: vi.fn(),
  mockCurrentUser: { value: { username: 'tester' } },
  mockToken: { value: 'token' },
  mockAuthType: { value: 'retiehe' },
  mockWebdavConfig: { value: { baseUrl: 'https://example.com' } },
  mockBackupMode: { value: false }
}))

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    token: mockToken,
    authType: mockAuthType,
    webdavConfig: mockWebdavConfig,
    backupMode: mockBackupMode
  }),
  getOrCreateCsrfToken: () => 'csrf-token'
}))

vi.mock('../useWebDav', () => ({
  useWebDav: () => ({
    listFiles: mockListFiles,
    putFile: mockPutFile,
    getFileText: mockGetFileText,
    deleteFile: mockDeleteFile
  })
}))

vi.mock('@/utils/fetchHelpers', () => ({
  fetchWithRetry: mockFetchWithRetry
}))

vi.mock('../useLogger', () => ({
  useLogger: () => ({
    error: mockLoggerError
  })
}))

describe('useCloudWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser.value = { username: 'tester' }
    mockToken.value = 'token'
    mockAuthType.value = 'retiehe'
    mockWebdavConfig.value = { baseUrl: 'https://example.com' }
    mockBackupMode.value = false
  })

  it('should return message on invalid JSON and stop save flow', async () => {
    const cloudWorkspace = useCloudWorkspace()

    await expect(
      cloudWorkspace.saveWorkspaceToCloud('invalid-json', '{invalid json')
    ).resolves.toEqual({
      success: false,
      message: '工作区数据格式错误',
      error: '工作区数据格式错误'
    })

    expect(mockLoggerError).toHaveBeenCalledWith('工作区数据格式错误')
    expect(mockFetchWithRetry).not.toHaveBeenCalled()
    expect(mockPutFile).not.toHaveBeenCalled()
  })
})
