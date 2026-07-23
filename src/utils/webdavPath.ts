const invalidWebDavSegmentCharacterPattern = /[\\/\u0000-\u001f\u007f]/

export const encodeWebDavPathSegment = (value: string): string => {
  if (!value || value === '.' || value === '..' || invalidWebDavSegmentCharacterPattern.test(value)) {
    throw new Error('WebDAV 工作区文件名必须是单个有效路径段')
  }

  try {
    return encodeURIComponent(value)
  } catch {
    throw new Error('WebDAV 工作区文件名包含无效字符')
  }
}

export const buildWebDavWorkspacePath = (fileId: string): string => (
  `/sce_data/${encodeWebDavPathSegment(fileId)}`
)

export const decodeWebDavHrefFilename = (href: string): string | null => {
  const baseHref = href.endsWith('/') ? href.slice(0, -1) : href
  const encodedFilename = baseHref.split('/').pop()
  if (!encodedFilename) return null
  try {
    return decodeURIComponent(encodedFilename)
  } catch {
    return null
  }
}
