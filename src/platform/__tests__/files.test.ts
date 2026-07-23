import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseDirectory } from '@tauri-apps/plugin-fs'

const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 26 },
  exists: mocks.exists,
  remove: mocks.remove,
  rename: mocks.rename,
  writeFile: mocks.writeFile,
  writeTextFile: mocks.writeTextFile
}))

import { writeBinaryFileAtomicPath, writeTextFileAtomicPath } from '../files'

describe('atomic Tauri file writes', () => {
  beforeEach(() => {
    mocks.exists.mockReset()
    mocks.remove.mockReset().mockResolvedValue(undefined)
    mocks.rename.mockReset().mockResolvedValue(undefined)
    mocks.writeFile.mockReset().mockResolvedValue(undefined)
    mocks.writeTextFile.mockReset().mockResolvedValue(undefined)
  })

  it('commits a temporary sibling with a direct rename', async () => {
    await writeTextFileAtomicPath('workspace.sce', 'latest')

    const temporaryPath = mocks.writeTextFile.mock.calls[0]?.[0] as string
    expect(temporaryPath).toMatch(/^workspace\.sce\.sce-tmp-/)
    expect(mocks.writeTextFile).toHaveBeenCalledWith(temporaryPath, 'latest', undefined)
    expect(mocks.rename).toHaveBeenCalledWith(temporaryPath, 'workspace.sce', undefined)
    expect(mocks.exists).not.toHaveBeenCalled()
  })

  it('removes a partially written temporary file when the write fails', async () => {
    const writeError = new Error('disk full')
    mocks.writeTextFile.mockRejectedValueOnce(writeError)
    mocks.exists.mockResolvedValue(true)

    await expect(writeTextFileAtomicPath('workspace.sce', 'latest')).rejects.toBe(writeError)

    const temporaryPath = mocks.writeTextFile.mock.calls[0]?.[0] as string
    expect(mocks.remove).toHaveBeenCalledWith(temporaryPath, undefined)
    expect(mocks.exists).not.toHaveBeenCalled()
    expect(mocks.rename).not.toHaveBeenCalled()
  })

  it('falls back to the dialog-authorized target for Tauri forbidden-path scope denial', async () => {
    mocks.writeTextFile
      .mockRejectedValueOnce(new Error('forbidden path: workspace.sce.sce-tmp-id'))
      .mockResolvedValueOnce(undefined)

    await writeTextFileAtomicPath('workspace.sce', 'latest')

    const temporaryPath = mocks.writeTextFile.mock.calls[0]?.[0] as string
    expect(temporaryPath).toMatch(/^workspace\.sce\.sce-tmp-/)
    expect(mocks.writeTextFile.mock.calls).toEqual([
      [temporaryPath, 'latest', undefined],
      ['workspace.sce', 'latest', undefined]
    ])
    expect(mocks.rename).not.toHaveBeenCalled()
  })

  it('applies the forbidden-path scope fallback to binary dialog saves', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    mocks.writeFile
      .mockRejectedValueOnce(new Error('forbidden path: chart.png.sce-tmp-id'))
      .mockResolvedValueOnce(undefined)

    await writeBinaryFileAtomicPath('chart.png', bytes)

    const temporaryPath = mocks.writeFile.mock.calls[0]?.[0] as string
    expect(mocks.writeFile.mock.calls).toEqual([
      [temporaryPath, bytes, undefined],
      ['chart.png', bytes, undefined]
    ])
  })

  it('does not turn ordinary write failures into a direct target overwrite', async () => {
    const writeError = new Error('disk full')
    mocks.writeTextFile.mockRejectedValueOnce(writeError)

    await expect(writeTextFileAtomicPath('workspace.sce', 'latest')).rejects.toBe(writeError)

    expect(mocks.writeTextFile).toHaveBeenCalledTimes(1)
  })

  it('does not use the dialog fallback for BaseDirectory writes', async () => {
    const scopeError = new Error('forbidden path: autosave.tmp')
    mocks.writeTextFile.mockRejectedValueOnce(scopeError)

    await expect(writeTextFileAtomicPath('autosave.json', 'latest', BaseDirectory.AppData)).rejects.toBe(scopeError)

    expect(mocks.writeTextFile).toHaveBeenCalledTimes(1)
  })

  it('falls back to a backup rename when the target cannot be replaced directly', async () => {
    mocks.rename
      .mockRejectedValueOnce(new Error('destination exists'))
      .mockResolvedValue(undefined)
    mocks.exists.mockResolvedValue(true)

    await writeTextFileAtomicPath('workspace.sce', 'latest')

    const temporaryPath = mocks.writeTextFile.mock.calls[0]?.[0] as string
    const backupPath = mocks.rename.mock.calls[1]?.[1] as string
    expect(backupPath).toMatch(/^workspace\.sce\.sce-bak-/)
    expect(mocks.rename.mock.calls).toEqual([
      [temporaryPath, 'workspace.sce', undefined],
      ['workspace.sce', backupPath, undefined],
      [temporaryPath, 'workspace.sce', undefined]
    ])
    expect(mocks.remove).toHaveBeenCalledWith(backupPath, undefined)
  })

  it('restores the backup when committing the temporary file fails', async () => {
    const commitError = new Error('commit failed')
    mocks.rename
      .mockRejectedValueOnce(new Error('destination exists'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(commitError)
      .mockResolvedValueOnce(undefined)
    mocks.exists.mockResolvedValue(true)

    await expect(writeTextFileAtomicPath('workspace.sce', 'latest')).rejects.toBe(commitError)

    const temporaryPath = mocks.writeTextFile.mock.calls[0]?.[0] as string
    const backupPath = mocks.rename.mock.calls[1]?.[1] as string
    expect(mocks.rename.mock.calls[3]).toEqual([backupPath, 'workspace.sce', undefined])
    expect(mocks.remove).toHaveBeenCalledWith(temporaryPath, undefined)
  })
})
