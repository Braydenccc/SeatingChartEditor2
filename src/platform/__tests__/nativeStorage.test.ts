import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  writeTextFileAtomicPath: vi.fn()
}))

vi.mock('../runtime', () => ({
  isTauriRuntime: mocks.isTauriRuntime
}))

vi.mock('../files', () => ({
  writeTextFileAtomicPath: mocks.writeTextFileAtomicPath
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 26 },
  readTextFile: mocks.readTextFile,
  remove: mocks.remove
}))

import { readStoredText, removeStoredText, writeStoredText } from '../nativeStorage'

describe('nativeStorage in Tauri', () => {
  beforeEach(() => {
    mocks.isTauriRuntime.mockReset().mockReturnValue(true)
    mocks.readTextFile.mockReset()
    mocks.remove.mockReset()
    mocks.writeTextFileAtomicPath.mockReset().mockResolvedValue(undefined)
  })

  it('maps only not-found reads and deletes to an absent value', async () => {
    const notFound = Object.assign(new Error('file not found'), { code: 'ENOENT' })
    mocks.readTextFile.mockRejectedValueOnce(notFound)
    mocks.remove.mockRejectedValueOnce(notFound)

    await expect(readStoredText('sce-autosave-backup')).resolves.toBeNull()
    await expect(removeStoredText('sce-autosave-backup')).resolves.toBe(true)
  })

  it('surfaces non-not-found read failures and reports delete failures', async () => {
    mocks.readTextFile.mockRejectedValueOnce(new Error('permission denied'))
    mocks.remove.mockRejectedValueOnce(new Error('permission denied'))

    await expect(readStoredText('sce-autosave-backup'))
      .rejects.toThrow('读取原生存储“sce-autosave-backup”失败：permission denied')
    await expect(removeStoredText('sce-autosave-backup')).resolves.toBe(false)
  })

  it('delegates writes to the atomic AppData writer', async () => {
    await expect(writeStoredText('sce/autosave', 'latest')).resolves.toBe(true)

    expect(mocks.writeTextFileAtomicPath).toHaveBeenCalledWith(
      'sce_autosave.json',
      'latest',
      26
    )
  })

  it('returns false when the atomic writer fails', async () => {
    mocks.writeTextFileAtomicPath.mockRejectedValueOnce(new Error('disk full'))

    await expect(writeStoredText('sce-autosave-backup', 'latest')).resolves.toBe(false)
  })
})
