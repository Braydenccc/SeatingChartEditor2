import { describe, it, expect, beforeEach } from 'vitest'
import { useTagData } from '../useTagData'

describe('useTagData', () => {
  let tagData

  beforeEach(() => {
    tagData = useTagData()
    tagData.tags.value = []
  })

  describe('addTag', () => {
    it('should add a new tag with default properties', () => {
      const id = tagData.addTag()

      expect(tagData.tags.value).toHaveLength(1)
      expect(tagData.tags.value[0]).toMatchObject({
        id: expect.any(Number),
        name: '',
        color: expect.any(String)
      })
    })

    it('should generate unique IDs for multiple tags', () => {
      const id1 = tagData.addTag()
      const id2 = tagData.addTag()
      const id3 = tagData.addTag()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(tagData.tags.value).toHaveLength(3)
    })

    it('should assign colors from predefined palette', () => {
      const id = tagData.addTag()
      const tag = tagData.tags.value.find(t => t.id === id)

      expect(tag.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })

  describe('updateTag', () => {
    it('should update tag properties', () => {
      const id = tagData.addTag()

      tagData.updateTag(id, {
        name: '优秀学生',
        color: '#FF5733'
      })

      const tag = tagData.tags.value.find(t => t.id === id)
      expect(tag.name).toBe('优秀学生')
      expect(tag.color).toBe('#FF5733')
    })

    it('should trim whitespace from tag names', () => {
      const id = tagData.addTag()
      tagData.updateTag(id, { name: '  优秀学生  ' })

      const tag = tagData.tags.value.find(t => t.id === id)
      expect(tag.name).toBe('优秀学生')
    })

    it('should not update non-existent tag', () => {
      const initialLength = tagData.tags.value.length
      tagData.updateTag(999, { name: '不存在' })

      expect(tagData.tags.value).toHaveLength(initialLength)
    })
  })

  describe('deleteTag', () => {
    it('should remove tag from list', () => {
      const id = tagData.addTag()
      expect(tagData.tags.value).toHaveLength(1)

      tagData.deleteTag(id)
      expect(tagData.tags.value).toHaveLength(0)
    })

    it('should not throw when deleting non-existent tag', () => {
      expect(() => tagData.deleteTag(999)).not.toThrow()
    })
  })

  describe('getTagById', () => {
    it('should return tag by id', () => {
      const id = tagData.addTag()
      tagData.updateTag(id, { name: '测试标签' })

      const tag = tagData.getTagById(id)
      expect(tag).toBeDefined()
      expect(tag.name).toBe('测试标签')
    })

    it('should return undefined for non-existent tag', () => {
      const tag = tagData.getTagById(999)
      expect(tag).toBeUndefined()
    })
  })

  describe('clearAllTags', () => {
    it('should remove all tags', () => {
      tagData.addTag()
      tagData.addTag()
      tagData.addTag()

      expect(tagData.tags.value).toHaveLength(3)

      tagData.clearAllTags()
      expect(tagData.tags.value).toHaveLength(0)
    })
  })
})
