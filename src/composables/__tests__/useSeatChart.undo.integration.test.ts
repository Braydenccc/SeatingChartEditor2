import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('clears undo and redo history after committing a layout configuration', () => {
    seatChart.assignStudent('seat-0-0-0', 1)
    expect(undo.undo()).toBe(true)
    expect(undo.canRedo.value).toBe(true)

    seatChart.updateConfig({
      seatsPerColumn: 2,
      groups: [{ columns: 1, rows: 2 }]
    })

    expect(undo.canUndo.value).toBe(false)
    expect(undo.canRedo.value).toBe(false)
    expect(undo.redo()).toBe(false)
  })

  it('refuses a stale snapshot after a layout shrink without partially restoring it', () => {
    seatChart.assignStudent('seat-0-0-0', 1, false)
    seatChart.assignStudent('seat-0-0-2', 2, false)
    const staleSnapshot = undo.createSnapshot()

    seatChart.updateConfig({
      seatsPerColumn: 2,
      groups: [{ columns: 1, rows: 2 }]
    })
    const afterShrink = undo.createSnapshot()
    undo.recordBatch(staleSnapshot, afterShrink)

    expect(undo.undo()).toBe(false)
    expect(undo.createSnapshot()).toEqual(afterShrink)
    expect(undo.canUndo.value).toBe(false)
    expect(undo.canRedo.value).toBe(false)
  })

  it('keeps redo history when clear and swap are no-op operations', () => {
    seatChart.assignStudent('seat-0-0-0', 1)
    expect(undo.undo()).toBe(true)
    expect(undo.canRedo.value).toBe(true)

    expect(seatChart.clearSeat('seat-0-0-1')).toBe(false)
    expect(seatChart.swapSeats('seat-0-0-1', 'seat-0-0-2')).toBe(false)

    expect(undo.canRedo.value).toBe(true)
    expect(undo.redo()).toBe(true)
    expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(1)
  })
})

describe('seat chart dependency boundary', () => {
  it('keeps undo independent from the seat chart business composable', () => {
    const undoSource = readFileSync(resolve(process.cwd(), 'src/composables/useUndo.ts'), 'utf8')
    const stateSource = readFileSync(resolve(process.cwd(), 'src/composables/seatChartState.ts'), 'utf8')

    expect(undoSource).toContain("from './seatChartState'")
    expect(undoSource).not.toContain("from './useSeatChart'")
    expect(stateSource).not.toContain("from './useUndo'")
    expect(stateSource).not.toContain("from './useSeatChart'")
  })
})
