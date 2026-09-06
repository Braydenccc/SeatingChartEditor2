import { describe, it, expect } from 'vitest'
import { useLayoutConstants } from '../useLayoutConstants'

describe('useLayoutConstants', () => {
  describe('LAYOUT constant', () => {
    it('should return LAYOUT object', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT).toBeDefined()
    })

    it('should have SEAT_W property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.SEAT_W).toBe(120)
    })

    it('should have SEAT_H property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.SEAT_H).toBe(80)
    })

    it('should have COL_GAP property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.COL_GAP).toBe(16)
    })

    it('should have ROW_GAP property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.ROW_GAP).toBe(12)
    })

    it('should have GROUP_GAP property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.GROUP_GAP).toBe(40)
    })

    it('should have LABEL_H property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.LABEL_H).toBe(47)
    })

    it('should have PAD_L property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.PAD_L).toBe(20)
    })

    it('should have PAD_T property', () => {
      const { LAYOUT } = useLayoutConstants()

      expect(LAYOUT.PAD_T).toBe(30)
    })
  })

  describe('consistency', () => {
    it('should return same LAYOUT object on multiple calls', () => {
      const { LAYOUT: layout1 } = useLayoutConstants()
      const { LAYOUT: layout2 } = useLayoutConstants()

      expect(layout1).toBe(layout2)
    })
  })
})
