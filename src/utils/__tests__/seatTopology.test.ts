import { describe, expect, it } from 'vitest'
import {
  areSeatPositionsDeskmates,
  buildDeskmateAdjacency,
  getRowNumberFromPodium,
  getSeatDepthRatio,
  isPositionInRowRange
} from '../seatTopology'
import type { SeatConfig } from '@/types/models'

const createConfig = (podiumPosition: SeatConfig['podiumPosition']): SeatConfig => ({
  groupCount: 2,
  columnsPerGroup: 2,
  seatsPerColumn: 7,
  groups: [
    { columns: 3, rows: 3 },
    { columns: 5, rows: 7 }
  ],
  shiftDistance: 4,
  podiumPosition
})

describe('seatTopology', () => {
  it.each([
    ['top', 0, 1, 0, 2, 3, 1],
    ['bottom', 2, 1, 0, 0, 3, 1]
  ] as const)(
    'numbers rows from a %s podium using each group row count',
    (podiumPosition, frontRowIndex, frontRowNumber, frontDepth, backRowIndex, backRowNumber, backDepth) => {
      const config = createConfig(podiumPosition)
      const front = { groupIndex: 0, columnIndex: 0, rowIndex: frontRowIndex }
      const back = { groupIndex: 0, columnIndex: 0, rowIndex: backRowIndex }

      expect(getRowNumberFromPodium(front, config)).toBe(frontRowNumber)
      expect(getRowNumberFromPodium(back, config)).toBe(backRowNumber)
      expect(getSeatDepthRatio(front, config)).toBe(frontDepth)
      expect(getSeatDepthRatio(back, config)).toBe(backDepth)
      expect(isPositionInRowRange(front, config, 1, 1)).toBe(true)
    }
  )

  it('normalizes short and tall groups independently', () => {
    const config = createConfig('bottom')

    expect(getSeatDepthRatio({ groupIndex: 0, columnIndex: 0, rowIndex: 0 }, config)).toBe(1)
    expect(getSeatDepthRatio({ groupIndex: 1, columnIndex: 0, rowIndex: 0 }, config)).toBe(1)
    expect(getSeatDepthRatio({ groupIndex: 0, columnIndex: 0, rowIndex: 2 }, config)).toBe(0)
    expect(getSeatDepthRatio({ groupIndex: 1, columnIndex: 0, rowIndex: 6 }, config)).toBe(0)
  })

  it('uses zero depth for a single-row group', () => {
    const config = createConfig('top')
    config.groups[0] = { columns: 2, rows: 1 }

    expect(getSeatDepthRatio({ groupIndex: 0, columnIndex: 0, rowIndex: 0 }, config)).toBe(0)
  })

  it.each([
    [1, true],
    [2, true],
    [3, false]
  ])('treats same-row column distance %i as deskmates=%s', (columnIndex, expected) => {
    const config = createConfig('bottom')
    expect(areSeatPositionsDeskmates(
      { groupIndex: 1, columnIndex: 0, rowIndex: 0 },
      { groupIndex: 1, columnIndex, rowIndex: 0 },
      config
    )).toBe(expected)
  })

  it('builds adjacency only from actual available seats and never across groups', () => {
    const config = createConfig('bottom')
    const adjacency = buildDeskmateAdjacency([
      { id: 'a', groupIndex: 0, columnIndex: 0, rowIndex: 0 },
      { id: 'c', groupIndex: 0, columnIndex: 2, rowIndex: 0 },
      { id: 'other-row', groupIndex: 0, columnIndex: 1, rowIndex: 1 },
      { id: 'other-group', groupIndex: 1, columnIndex: 1, rowIndex: 0 }
    ], config)

    expect(adjacency.get('a')).toEqual(new Set(['c']))
    expect(adjacency.get('c')).toEqual(new Set(['a']))
    expect(adjacency.get('other-row')).toEqual(new Set())
    expect(adjacency.get('other-group')).toEqual(new Set())
  })
})
