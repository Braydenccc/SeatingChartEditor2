import { describe, expect, it } from 'vitest'
import {
  createOrderedSeatGroups,
  getSourceRowIndex,
  getVisualRowNumber
} from '../exportLayout'

describe('exportLayout', () => {
  const organizedSeats = [
    [
      ['g0c0r0', 'g0c0r1'],
      ['g0c1r0', 'g0c1r1']
    ],
    [
      ['g1c0r0', 'g1c0r1'],
      ['g1c1r0', 'g1c1r1']
    ]
  ]

  it('should keep the original order when no flip is enabled', () => {
    const groups = createOrderedSeatGroups(organizedSeats, {
      flipHorizontal: false,
      flipVertical: false
    })

    expect(groups.map(group => group.groupIndex)).toEqual([0, 1])
    expect(groups[0].columns.map(column => column.columnIndex)).toEqual([0, 1])
    expect(groups[0].columns[0].seats).toEqual(['g0c0r0', 'g0c0r1'])
  })

  it('should mirror groups and columns when horizontal flip is enabled', () => {
    const groups = createOrderedSeatGroups(organizedSeats, {
      flipHorizontal: true,
      flipVertical: false
    })

    expect(groups.map(group => group.groupIndex)).toEqual([1, 0])
    expect(groups[0].columns.map(column => column.columnIndex)).toEqual([1, 0])
    expect(groups[0].columns[0].seats).toEqual(['g1c1r0', 'g1c1r1'])
  })

  it('should reverse row source indexes when vertical flip is enabled', () => {
    expect(getSourceRowIndex(0, 4, true)).toBe(3)
    expect(getSourceRowIndex(3, 4, true)).toBe(0)
    expect(getSourceRowIndex(2, 4, false)).toBe(2)
  })

  it('should keep row numbers tied to podium direction after vertical flip', () => {
    expect(getVisualRowNumber(0, 4, 'bottom', false)).toBe(4)
    expect(getVisualRowNumber(0, 4, 'bottom', true)).toBe(1)
    expect(getVisualRowNumber(0, 4, 'top', false)).toBe(1)
    expect(getVisualRowNumber(0, 4, 'top', true)).toBe(4)
  })

  it('should combine horizontal and vertical flips as a visual 180 degree turn', () => {
    const groups = createOrderedSeatGroups(organizedSeats, {
      flipHorizontal: true,
      flipVertical: true
    })

    expect(groups.map(group => group.groupIndex)).toEqual([1, 0])
    expect(groups[0].columns[0].columnIndex).toBe(1)
    expect(groups[0].columns[0].seats).toEqual(['g1c1r1', 'g1c1r0'])
  })
})
