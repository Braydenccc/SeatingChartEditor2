import { safeStorageGet, safeStorageRemove, safeStorageSet } from '@/utils/storage'
import { isTauriRuntime } from './runtime'
import { writeTextFileAtomicPath } from './files'

const normalizeFileName = (key: string) => `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`

const isFileNotFoundError = (error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : ''
  const message = error instanceof Error ? error.message : String(error || '')

  return code === 'ENOENT' ||
    code === 'NotFound' ||
    /\bENOENT\b|\bnot found\b|cannot find the (?:file|path)|os error 2/i.test(message)
}

const createStorageError = (operation: '读取' | '删除', key: string, cause: unknown) => {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new Error(`${operation}原生存储“${key}”失败：${detail}`)
}

export async function readStoredText(key: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return safeStorageGet(key)
  }

  try {
    const { readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    return await readTextFile(normalizeFileName(key), { baseDir: BaseDirectory.AppData })
  } catch (error) {
    if (isFileNotFoundError(error)) return null
    throw createStorageError('读取', key, error)
  }
}

export async function writeStoredText(key: string, value: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return safeStorageSet(key, value)
  }

  try {
    const { BaseDirectory } = await import('@tauri-apps/plugin-fs')
    await writeTextFileAtomicPath(normalizeFileName(key), value, BaseDirectory.AppData)
    return true
  } catch (error) {
    console.warn(`Failed to write native storage key "${key}":`, error)
    return false
  }
}

export async function removeStoredText(key: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return safeStorageRemove(key)
  }

  try {
    const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    await remove(normalizeFileName(key), { baseDir: BaseDirectory.AppData })
    return true
  } catch (error) {
    if (isFileNotFoundError(error)) return true
    console.warn(`Failed to remove native storage key "${key}":`, error)
    return false
  }
}
