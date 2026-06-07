import { safeStorageGet, safeStorageRemove, safeStorageSet } from '@/utils/storage'
import { isTauriRuntime } from './runtime'

const normalizeFileName = (key: string) => `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`

export async function readStoredText(key: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return safeStorageGet(key)
  }

  try {
    const { readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    return await readTextFile(normalizeFileName(key), { baseDir: BaseDirectory.AppData })
  } catch (_error) {
    return null
  }
}

export async function writeStoredText(key: string, value: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return safeStorageSet(key, value)
  }

  try {
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(normalizeFileName(key), value, { baseDir: BaseDirectory.AppData })
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
  } catch (_error) {
    return true
  }
}
