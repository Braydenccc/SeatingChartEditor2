import { describe, it, expect, beforeEach } from 'vitest'
import { useEditMode, EditMode } from '../useEditMode'

describe('useEditMode', () => {
  let editMode

  beforeEach(() => {
    editMode = useEditMode()
    editMode.setMode(EditMode.NORMAL)
  })

  describe('setMode', () => {
    it('should change current mode', () => {
      expect(editMode.currentMode.value).toBe(EditMode.NORMAL)

      editMode.setMode(EditMode.SWAP)
      expect(editMode.currentMode.value).toBe(EditMode.SWAP)
    })

    it('should accept all valid modes', () => {
      const modes = [
        EditMode.NORMAL,
        EditMode.SWAP,
        EditMode.CLEAR,
        EditMode.EMPTY_EDIT,
        EditMode.ZONE_EDIT
      ]

      modes.forEach(mode => {
        expect(() => editMode.setMode(mode)).not.toThrow()
        expect(editMode.currentMode.value).toBe(mode)
      })
    })
  })

  describe('isMode', () => {
    it('should correctly identify current mode', () => {
      editMode.setMode(EditMode.NORMAL)
      expect(editMode.isMode(EditMode.NORMAL)).toBe(true)
      expect(editMode.isMode(EditMode.SWAP)).toBe(false)

      editMode.setMode(EditMode.SWAP)
      expect(editMode.isMode(EditMode.SWAP)).toBe(true)
      expect(editMode.isMode(EditMode.NORMAL)).toBe(false)
    })
  })

  describe('resetMode', () => {
    it('should reset to NORMAL mode', () => {
      editMode.setMode(EditMode.SWAP)
      expect(editMode.currentMode.value).toBe(EditMode.SWAP)

      editMode.resetMode()
      expect(editMode.currentMode.value).toBe(EditMode.NORMAL)
    })
  })

  describe('mode transitions', () => {
    it('should allow switching between any modes', () => {
      editMode.setMode(EditMode.NORMAL)
      editMode.setMode(EditMode.SWAP)
      editMode.setMode(EditMode.CLEAR)
      editMode.setMode(EditMode.EMPTY_EDIT)
      editMode.setMode(EditMode.ZONE_EDIT)

      expect(editMode.currentMode.value).toBe(EditMode.ZONE_EDIT)
    })
  })
})
