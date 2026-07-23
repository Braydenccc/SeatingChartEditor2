import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useZoneRotation } from '../useZoneRotation'
import type { RotationGroup, Seat } from '@/types/models'

const batchUpdateSeats = vi.hoisted(() => vi.fn())

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => ({ batchUpdateSeats })
}))

const createSeat = (id: string, studentId: number | null, overrides: Partial<Seat> = {}): Seat => {
  const [, groupIndex = '0', columnIndex = '0', rowIndex = '0'] = id.split('-')
  return {
    id,
    groupIndex: Number(groupIndex),
    columnIndex: Number(columnIndex),
    rowIndex: Number(rowIndex),
    studentId,
    isEmpty: false,
    kind: 'regular',
    ...overrides
  }
}

const swapGroup = (
  id: number,
  firstSeatIds: string[],
  secondSeatIds: string[]
): RotationGroup => ({
  id,
  name: `轮换组 ${id}`,
  type: 'swap',
  zones: [
    { id: id * 10 + 1, name: `选区 ${id}-1`, seatIds: firstSeatIds },
    { id: id * 10 + 2, name: `选区 ${id}-2`, seatIds: secondSeatIds }
  ]
})

describe('useZoneRotation', () => {
  const rotation = useZoneRotation()
  let seatMap: Map<string, Seat>

  beforeEach(() => {
    rotation.clearAllRotData()
    batchUpdateSeats.mockReset()
    seatMap = new Map([
      ['seat-0-0-0', createSeat('seat-0-0-0', 1)],
      ['seat-0-1-0', createSeat('seat-0-1-0', 2)],
      ['seat-0-2-0', createSeat('seat-0-2-0', 3)],
      ['seat-0-3-0', createSeat('seat-0-3-0', null)]
    ])
    batchUpdateSeats.mockImplementation((updates: Array<{ seatId: string; studentId: number | null }>) => {
      for (const update of updates) {
        const seat = seatMap.get(update.seatId)
        if (seat) seat.studentId = update.studentId
      }
    })
  })

  it('rejects overlapping seats inside one rotation group without mutating assignments', () => {
    rotation.replaceRotationData([
      swapGroup(1, ['seat-0-0-0', 'seat-0-1-0'], ['seat-0-1-0', 'seat-0-2-0'])
    ])
    const before = [...seatMap.values()].map(seat => seat.studentId)

    const result = rotation.applyZoneRotation(seatMap)

    expect(result.moved).toBe(0)
    expect(result.errors.join('\n')).toContain('重叠')
    expect(batchUpdateSeats).not.toHaveBeenCalled()
    expect([...seatMap.values()].map(seat => seat.studentId)).toEqual(before)
  })

  it('rejects overlapping seats across simultaneously executed rotation groups', () => {
    rotation.replaceRotationData([
      swapGroup(1, ['seat-0-0-0'], ['seat-0-1-0']),
      swapGroup(2, ['seat-0-1-0'], ['seat-0-2-0'])
    ])

    const result = rotation.applyZoneRotation(seatMap)

    expect(result.moved).toBe(0)
    expect(result.errors.join('\n')).toContain('重叠')
    expect(batchUpdateSeats).not.toHaveBeenCalled()
  })

  it.each([
    ['不存在', ['seat-0-0-0'], ['seat-9-9-9']],
    ['不可用于轮换', ['seat-0-0-0'], ['seat-0-3-0']]
  ])('rejects a seat that is %s', (message, firstSeatIds, secondSeatIds) => {
    if (message === '不可用于轮换') {
      const seat = seatMap.get('seat-0-3-0')
      if (seat) seat.isEmpty = true
    }
    rotation.replaceRotationData([swapGroup(1, firstSeatIds, secondSeatIds)])

    const result = rotation.applyZoneRotation(seatMap)

    expect(result.moved).toBe(0)
    expect(result.errors.join('\n')).toContain(message)
    expect(batchUpdateSeats).not.toHaveBeenCalled()
  })

  it('commits one validated permutation and preserves the non-null student multiset', () => {
    rotation.replaceRotationData([
      swapGroup(1, ['seat-0-0-0', 'seat-0-1-0'], ['seat-0-2-0', 'seat-0-3-0'])
    ])
    const before = [...seatMap.values()]
      .map(seat => seat.studentId)
      .filter((studentId): studentId is number => studentId !== null)
      .sort((a, b) => a - b)

    const result = rotation.applyZoneRotation(seatMap)
    const after = [...seatMap.values()]
      .map(seat => seat.studentId)
      .filter((studentId): studentId is number => studentId !== null)
      .sort((a, b) => a - b)

    expect(result.errors).toEqual([])
    expect(result.moved).toBe(4)
    expect(batchUpdateSeats).toHaveBeenCalledTimes(1)
    expect(before).toEqual(after)
    expect(new Set(after).size).toBe(after.length)
    expect(seatMap.get('seat-0-0-0')?.studentId).toBe(3)
    expect(seatMap.get('seat-0-2-0')?.studentId).toBe(1)
  })

  it('clones replaced rotation data and advances both persisted ID counters', () => {
    const source = [swapGroup(5, ['seat-0-0-0'], ['seat-0-1-0'])]
    const result = rotation.replaceRotationData(source)
    source[0].zones[0].seatIds.push('seat-0-2-0')

    const firstRead = rotation.getRotationData()
    firstRead[0].zones[0].seatIds.push('seat-0-3-0')
    const secondRead = rotation.getRotationData()
    const addedGroup = rotation.addRotGroup()
    const addedZone = rotation.addZoneToGroup(addedGroup.id)

    expect(result.success).toBe(true)
    expect(secondRead[0].zones[0].seatIds).toEqual(['seat-0-0-0'])
    expect(addedGroup.id).toBe(6)
    expect(addedZone?.id).toBe(53)

    rotation.resetRotationData()
    expect(rotation.getRotationData()).toEqual([])
    expect(rotation.addRotGroup().id).toBe(1)
  })

  it('rejects malformed persisted rotation data without replacing current state', () => {
    rotation.replaceRotationData([
      swapGroup(1, ['seat-0-0-0'], ['seat-0-1-0'])
    ])
    const before = rotation.getRotationData()

    const result = rotation.replaceRotationData([null])

    expect(result.success).toBe(false)
    expect(rotation.getRotationData()).toEqual(before)
  })
})
