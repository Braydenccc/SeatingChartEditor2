import { describe, expect, it } from 'vitest'
import {
  createOrderedSeatGroups,
  getCenteredPodiumLayout,
  getEffectivePodiumPosition,
  getGuardSideForVisualSlot,
  getImageExportVerticalLayout,
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

  it('should derive visual podium side from configured side and vertical flip', () => {
    expect(getEffectivePodiumPosition('bottom', false)).toBe('bottom')
    expect(getEffectivePodiumPosition('bottom', true)).toBe('top')
    expect(getEffectivePodiumPosition('top', false)).toBe('top')
    expect(getEffectivePodiumPosition('top', true)).toBe('bottom')
  })

  it('should swap guard seat order when the podium is visually at the top', () => {
    expect(getGuardSideForVisualSlot('left', 'bottom')).toBe('left')
    expect(getGuardSideForVisualSlot('right', 'bottom')).toBe('right')
    expect(getGuardSideForVisualSlot('left', 'top')).toBe('right')
    expect(getGuardSideForVisualSlot('right', 'top')).toBe('left')
  })

  it('should keep the podium centered to the seat table when only the left guard seat is shown', () => {
    const layout = getCenteredPodiumLayout({
      seatTableWidth: 800,
      podiumWidth: 300,
      sideSeatWidth: 100,
      gap: 20,
      hasLeftSideSeat: true,
      hasRightSideSeat: false
    })

    expect(layout.innerContentWidth).toBe(800)
    expect(layout.seatTableLeft + 400).toBe(layout.podiumLeft + 150)
    expect(layout.leftSideSeatLeft).toBe(130)
    expect(layout.rightSideSeatLeft).toBeNull()
  })

  it('should reserve symmetric room for one guard seat when the podium row is wider than the seat table', () => {
    const layout = getCenteredPodiumLayout({
      seatTableWidth: 360,
      podiumWidth: 300,
      sideSeatWidth: 100,
      gap: 20,
      hasLeftSideSeat: true,
      hasRightSideSeat: false
    })

    expect(layout.innerContentWidth).toBe(540)
    expect(layout.seatTableLeft + 180).toBe(layout.podiumLeft + 150)
    expect(layout.leftSideSeatLeft).toBe(0)
  })

  it('should keep the same podium-to-seat gap when the podium is at the top', () => {
    const layout = getImageExportVerticalLayout({
      titleHeight: 60,
      seatRowCount: 4,
      seatHeight: 100,
      rowGap: 15,
      groupLabelHeight: 50,
      podiumHeight: 100,
      padding: 40,
      showPodium: true,
      showGroupLabels: true,
      isPodiumTop: true,
      areGroupLabelsAboveSeats: false
    })

    expect(layout.seatStartY - (layout.podiumRowY! + 100)).toBe(15)
  })

  it('should keep the same podium-to-seat gap when the podium is at the bottom', () => {
    const layout = getImageExportVerticalLayout({
      titleHeight: 60,
      seatRowCount: 4,
      seatHeight: 100,
      rowGap: 15,
      groupLabelHeight: 0,
      podiumHeight: 100,
      padding: 40,
      showPodium: true,
      showGroupLabels: false,
      isPodiumTop: false,
      areGroupLabelsAboveSeats: false
    })
    const seatBlockBottom = layout.seatStartY + 4 * 100 + 3 * 15

    expect(layout.podiumRowY! - seatBlockBottom).toBe(15)
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
