import { describe, expect, it } from 'vitest'
import {
  buildWebDavWorkspacePath,
  decodeWebDavHrefFilename,
  encodeWebDavPathSegment
} from '../webdavPath'

describe('WebDAV workspace paths', () => {
  it('encodes one Unicode filename segment without changing application state', () => {
    expect(buildWebDavWorkspacePath('班级 #1%.sce'))
      .toBe('/sce_data/%E7%8F%AD%E7%BA%A7%20%231%25.sce')
    expect(decodeURIComponent(encodeWebDavPathSegment('中文 空格.sce')))
      .toBe('中文 空格.sce')
  })

  it('splits a PROPFIND href before decoding its final filename segment', () => {
    expect(decodeWebDavHrefFilename('/root/sce_data/class%2Fnested.sce'))
      .toBe('class/nested.sce')
  })

  it.each(['', '.', '..', '../escape.sce', 'folder/file.sce', 'folder\\file.sce', 'bad\u0000.sce'])(
    'rejects unsafe path segment %j',
    fileId => {
      expect(() => buildWebDavWorkspacePath(fileId)).toThrow(/单个有效路径段/)
    }
  )
})
