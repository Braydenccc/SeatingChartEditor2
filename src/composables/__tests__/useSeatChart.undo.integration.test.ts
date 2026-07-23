import { beforeEach, describe, expect, it } from 'vitest'
import { useSeatChart } from '../useSeatChart'
import { useUndo } from '../useUndo'

describe('useSeatChart undo integration', () => {
  const seatChart = useSeatChart()
  const undo = useUndo()

  beforeEach(() => {
    seatChart.updateConfig({
      groupCount: 1,
      columnsPerGroup: 1,
      seatsPerColumn: 3,
      groups: [{ columns: 1, rows: 3 }]
    })
    seatChart.seats.value.forEach(seat => {
      seat.studentId = null
      seat.isEmpty = false
    })
    undo.clear()
  })

  it.each([
    {
      name: 'assigns a pool student to an unoccupied target',
      prepare: () => undefined
    },
    {
      name: 'assigns a pool student over an occupied target',
      prepare: () => seatChart.assignStudent('seat-0-0-1', 2, false)
    },
    {
      name: 'moves a seated student to an unoccupied target',
      prepare: () => seatChart.assignStudent('seat-0-0-0', 1, false)
    },
    {
      name: 'moves a seated student over an occupied target',
      prepare: () => {
        seatChart.assignStudent('seat-0-0-0', 1, false)
        seatChart.assignStudent('seat-0-0-1', 2, false)
      }
    }
  ])('$name and restores the exact states through undo/redo', ({ prepare }) => {
    prepare()
    const before = undo.createSnapshot()

    expect(seatChart.assignStudent('seat-0-0-1', 1)).toBe(true)
    const after = undo.createSnapshot()
    expect(after).not.toEqual(before)

    expect(undo.undo()).toBe(true)
    expect(undo.createSnapshot()).toEqual(before)

    expect(undo.redo()).toBe(true)
    expect(undo.createSnapshot()).toEqual(after)
  })

  it('restores the occupant when an occupied seat is toggled unavailable', () => {
    seatChart.assignStudent('seat-0-0-0', 1, false)
    const before = undo.createSnapshot()

    seatChart.toggleEmpty('seat-0-0-0')
    const after = undo.createSnapshot()
    expect(after).not.toEqual(before)
    expect(seatChart.getSeat('seat-0-0-0')).toMatchObject({ studentId: null, isEmpty: true })

    expect(undo.undo()).toBe(true)
    expect(undo.createSnapshot()).toEqual(before)

    expect(undo.redo()).toBe(true)
    expect(undo.createSnapshot()).toEqual(after)
  })
})
