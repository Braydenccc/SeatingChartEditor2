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
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ])
    const selected = await save({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters
    })
    if (!selected) return { success: false, canceled: true, path: null }

    const path = ensureExtension(selected, options.extension)
    await writeTextFile(path, content)
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
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  await writeTextFile(path, content)
  return { success: true, canceled: false, path }
}

export const saveBinaryFile = async (
  content: ArrayBuffer | Uint8Array | Blob,
  options: SaveOptions
): Promise<SaveResult> => {
  if (isTauriRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ])
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
    await writeFile(path, bytes)
    return { success: true, canceled: false, path }
  }

  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: options.mimeType || 'application/octet-stream' })
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
