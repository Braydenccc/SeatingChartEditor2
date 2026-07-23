import { isTauriRuntime } from './runtime'

type DialogFilter = {
  name: string
  extensions: string[]
}

type OpenTextOptions = {
  title?: string
  accept?: string
  filters?: DialogFilter[]
}

type SaveOptions = {
  title?: string
  defaultPath: string
  filters?: DialogFilter[]
  extension?: string
  mimeType?: string
}

type OpenTextResult = {
  name: string
  path: string | null
  text: string
}

type OpenBinaryResult = {
  name: string
  path: string | null
  bytes: Uint8Array
}

type SaveResult = {
  success: boolean
  canceled: boolean
  path: string | null
}

type TauriBaseDirectory = import('@tauri-apps/plugin-fs').BaseDirectory

const isConfiguredScopeDeniedError = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : typeof error === 'string'
        ? error
        : ''

  // Tauri plugin-fs 2.5.1 的动态 scope 拒绝文案为 `forbidden path: ...`。
  // 同时保留早期 configured-scope 文案兼容；不匹配 EACCES/磁盘满等普通 I/O 错误，
  // 避免原子写失败时误用直写覆盖原文件。
  return /\bforbidden path\s*:/i.test(message) ||
    /\bpath\b.*\bnot allowed\b.*\bconfigured scope\b/i.test(message)
}

const createAtomicSiblingPath = (path: string, kind: 'tmp' | 'bak') => {
  const randomPart = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${path}.sce-${kind}-${randomPart}`
}

const writeTauriFileAtomically = async (
  path: string,
  writeTemporaryFile: (temporaryPath: string) => Promise<void>,
  baseDir?: TauriBaseDirectory
) => {
  const { exists, remove, rename } = await import('@tauri-apps/plugin-fs')
  const temporaryPath = createAtomicSiblingPath(path, 'tmp')
  const backupPath = createAtomicSiblingPath(path, 'bak')
  const pathOptions = baseDir === undefined ? undefined : { baseDir }
  const renameOptions = baseDir === undefined
    ? undefined
    : { oldPathBaseDir: baseDir, newPathBaseDir: baseDir }

  const removeQuietly = async (candidatePath: string) => {
    try {
      await remove(candidatePath, pathOptions)
    } catch {
      // 临时文件可能已经被 rename，或清理时已经不存在。
    }
  }

  try {
    await writeTemporaryFile(temporaryPath)

    try {
      // plugin-fs 声明同目录 rename 会替换已有普通文件；这是最短的原子提交路径。
      await rename(temporaryPath, path, renameOptions)
      return
    } catch (directReplaceError) {
      let targetExists = false
      try {
        targetExists = await exists(path, pathOptions)
      } catch {
        await removeQuietly(temporaryPath)
        throw directReplaceError
      }

      if (!targetExists) {
        await removeQuietly(temporaryPath)
        throw directReplaceError
      }

      // Windows 或特定文件系统若拒绝覆盖 rename，则先保留旧文件，再提交并在失败时回滚。
      try {
        await rename(path, backupPath, renameOptions)
      } catch {
        await removeQuietly(temporaryPath)
        throw directReplaceError
      }

      try {
        await rename(temporaryPath, path, renameOptions)
      } catch (commitError) {
        try {
          await rename(backupPath, path, renameOptions)
        } catch (rollbackError) {
          await removeQuietly(temporaryPath)
          const commitMessage = commitError instanceof Error ? commitError.message : String(commitError)
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          throw new Error(`原子写入失败，且旧文件回滚失败：${commitMessage}；${rollbackMessage}`)
        }
        await removeQuietly(temporaryPath)
        throw commitError
      }

      try {
        await remove(backupPath, pathOptions)
      } catch (cleanupError) {
        console.warn('原子写入已完成，但旧文件备份清理失败:', cleanupError)
      }
    }
  } finally {
    await removeQuietly(temporaryPath)
  }
}

const writeTauriFileWithDialogScopeFallback = async (
  atomicWrite: () => Promise<void>,
  directWrite: () => Promise<void>,
  baseDir?: TauriBaseDirectory
) => {
  try {
    await atomicWrite()
  } catch (error) {
    if (baseDir === undefined && isConfiguredScopeDeniedError(error)) {
      // save dialog 只为用户选中的目标文件授权，同目录临时文件可能不在动态 scope 内。
      // 只有能明确识别为 scope 拒绝时才回退直写已授权目标。
      await directWrite()
      return
    }
    throw error
  }
}

export const writeTextFileAtomicPath = async (
  path: string,
  content: string,
  baseDir?: TauriBaseDirectory
) => {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const writeOptions = baseDir === undefined ? undefined : { baseDir }
  await writeTauriFileWithDialogScopeFallback(
    () => writeTauriFileAtomically(
      path,
      temporaryPath => writeTextFile(temporaryPath, content, writeOptions),
      baseDir
    ),
    () => writeTextFile(path, content, writeOptions),
    baseDir
  )
}

export const writeBinaryFileAtomicPath = async (
  path: string,
  content: Uint8Array,
  baseDir?: TauriBaseDirectory
) => {
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  const writeOptions = baseDir === undefined ? undefined : { baseDir }
  await writeTauriFileWithDialogScopeFallback(
    () => writeTauriFileAtomically(
      path,
      temporaryPath => writeFile(temporaryPath, content, writeOptions),
      baseDir
    ),
    () => writeFile(path, content, writeOptions),
    baseDir
  )
}

const getBaseName = (path: string) => {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').pop() || path
}

const ensureExtension = (path: string, extension?: string) => {
  if (!extension) return path
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`
  return path.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? path
    : `${path}${normalizedExtension}`
}

const createInput = (accept?: string) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.style.display = 'none'
  if (accept) input.accept = accept
  document.body.appendChild(input)
  return input
}

const readFileAsText = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (event) => resolve(String(event.target?.result || ''))
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsText(file)
})

const readFileAsBytes = (file: File) => new Promise<Uint8Array>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (event) => resolve(new Uint8Array(event.target?.result as ArrayBuffer))
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsArrayBuffer(file)
})

export const openTextFile = async (options: OpenTextOptions = {}): Promise<OpenTextResult | null> => {
  if (isTauriRuntime()) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ])
    const selected = await open({
      title: options.title,
      filters: options.filters,
      multiple: false
    })
    if (!selected || Array.isArray(selected)) return null

    const text = await readTextFile(selected)
    return {
      name: getBaseName(selected),
      path: selected,
      text
    }
  }

  return new Promise((resolve, reject) => {
    const input = createInput(options.accept)
    input.onchange = async () => {
      const file = input.files?.[0]
      document.body.removeChild(input)
      if (!file) {
        resolve(null)
        return
      }
      try {
        resolve({
          name: file.name,
          path: null,
          text: await readFileAsText(file)
        })
      } catch (error) {
        reject(error)
      }
    }
    input.click()
  })
}

export const openBinaryFile = async (options: OpenTextOptions = {}): Promise<OpenBinaryResult | null> => {
  if (isTauriRuntime()) {
    const [{ open }, { readFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ])
    const selected = await open({
      title: options.title,
      filters: options.filters,
      multiple: false
    })
    if (!selected || Array.isArray(selected)) return null

    const bytes = await readFile(selected)
    return {
      name: getBaseName(selected),
      path: selected,
      bytes
    }
  }

  return new Promise((resolve, reject) => {
    const input = createInput(options.accept)
    input.onchange = async () => {
      const file = input.files?.[0]
      document.body.removeChild(input)
      if (!file) {
        resolve(null)
        return
      }
      try {
        resolve({
          name: file.name,
          path: null,
          bytes: await readFileAsBytes(file)
        })
      } catch (error) {
        reject(error)
      }
    }
    input.click()
  })
}

export const saveTextFile = async (content: string, options: SaveOptions): Promise<SaveResult> => {
  if (isTauriRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const selected = await save({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters
    })
    if (!selected) return { success: false, canceled: true, path: null }

    const path = ensureExtension(selected, options.extension)
    await writeTextFileAtomicPath(path, content)
    return { success: true, canceled: false, path }
  }

  const blob = new Blob([content], { type: options.mimeType || 'text/plain;charset=utf-8' })
  downloadBlob(blob, ensureExtension(options.defaultPath, options.extension))
  return { success: true, canceled: false, path: null }
}

export const writeTextFilePath = async (path: string, content: string): Promise<SaveResult> => {
  if (!isTauriRuntime()) {
    return saveTextFile(content, { defaultPath: getBaseName(path) })
  }
  await writeTextFileAtomicPath(path, content)
  return { success: true, canceled: false, path }
}

export const saveBinaryFile = async (
  content: ArrayBuffer | Uint8Array | Blob,
  options: SaveOptions
): Promise<SaveResult> => {
  if (isTauriRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const selected = await save({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters
    })
    if (!selected) return { success: false, canceled: true, path: null }

    const bytes = content instanceof Blob
      ? new Uint8Array(await content.arrayBuffer())
      : content instanceof Uint8Array
        ? content
        : new Uint8Array(content)
    const path = ensureExtension(selected, options.extension)
    await writeBinaryFileAtomicPath(path, bytes)
    return { success: true, canceled: false, path }
  }

  let binaryContent: ArrayBuffer | Blob
  if (content instanceof Blob) {
    binaryContent = content
  } else if (content instanceof Uint8Array) {
    const copy = new ArrayBuffer(content.byteLength)
    new Uint8Array(copy).set(content)
    binaryContent = copy
  } else {
    binaryContent = content
  }
  const blob = binaryContent instanceof Blob
    ? binaryContent
    : new Blob([binaryContent], { type: options.mimeType || 'application/octet-stream' })
  downloadBlob(blob, ensureExtension(options.defaultPath, options.extension))
  return { success: true, canceled: false, path: null }
}

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const workspaceFileFilters: DialogFilter[] = [
  { name: 'SCE 工作区', extensions: ['sce', 'bydsce.json'] }
]

export const excelFileFilters: DialogFilter[] = [
  { name: 'Excel 文件', extensions: ['xlsx', 'xls'] }
]

export const sdesFileFilters: DialogFilter[] = [
  { name: 'SDES 文件', extensions: ['sdes.json', 'json'] }
]
