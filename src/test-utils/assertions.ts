import { expect } from 'vitest'
import type { Mock } from 'vitest'
import type { Rule, Seat, Student, Zone } from '@/types/models'
import type { useEditMode } from '@/composables/useEditMode'
import type { useStudentData } from '@/composables/useStudentData'
import type { useUndo } from '@/composables/useUndo'

export function expectSeatToHaveStudent(seat: Seat | undefined, studentId: number) {
  expect(seat).toBeDefined()
  if (!seat) throw new Error('Expected seat to be defined')
  expect(seat.studentId).toBe(studentId)
}

export function expectSeatToBeEmpty(seat: Seat | undefined) {
  expect(seat).toBeDefined()
  if (!seat) throw new Error('Expected seat to be defined')
  expect(seat.studentId).toBe(null)
  expect(seat.isEmpty).toBe(false)
}

export function expectSeatToBeDisabled(seat: Seat | undefined) {
  expect(seat).toBeDefined()
  if (!seat) throw new Error('Expected seat to be defined')
  expect(seat.isEmpty).toBe(true)
}

export function expectStudentToHaveTags(student: Student | undefined, tagIds: number[]) {
  expect(student).toBeDefined()
  if (!student) throw new Error('Expected student to be defined')
  expect(student.tags).toEqual(expect.arrayContaining(tagIds))
  expect(student.tags).toHaveLength(tagIds.length)
}

export function expectStudentToBeSelected(studentData: ReturnType<typeof useStudentData>, studentId: number) {
  expect(studentData.selectedStudentId.value).toBe(studentId)
}

export function expectNoStudentSelected(studentData: ReturnType<typeof useStudentData>) {
  expect(studentData.selectedStudentId.value).toBe(null)
}

export function expectRuleToBeEnabled(rule: Rule | undefined) {
  expect(rule).toBeDefined()
  if (!rule) throw new Error('Expected rule to be defined')
  expect(rule.enabled).toBe(true)
}

export function expectRuleToBeDisabled(rule: Rule | undefined) {
  expect(rule).toBeDefined()
  if (!rule) throw new Error('Expected rule to be defined')
  expect(rule.enabled).toBe(false)
}

export function expectZoneToContainSeat(zone: Zone | undefined, seatId: string) {
  expect(zone).toBeDefined()
  if (!zone) throw new Error('Expected zone to be defined')
  expect(zone.seatIds).toContain(seatId)
}

export function expectZoneNotToContainSeat(zone: Zone | undefined, seatId: string) {
  expect(zone).toBeDefined()
  if (!zone) throw new Error('Expected zone to be defined')
  expect(zone.seatIds).not.toContain(seatId)
}

export function expectUndoAvailable(undo: ReturnType<typeof useUndo>) {
  expect(undo.canUndo.value).toBe(true)
}

export function expectUndoNotAvailable(undo: ReturnType<typeof useUndo>) {
  expect(undo.canUndo.value).toBe(false)
}

export function expectRedoAvailable(undo: ReturnType<typeof useUndo>) {
  expect(undo.canRedo.value).toBe(true)
}

export function expectRedoNotAvailable(undo: ReturnType<typeof useUndo>) {
  expect(undo.canRedo.value).toBe(false)
}

export function expectModeToBeActive(
  editMode: ReturnType<typeof useEditMode>,
  mode: ReturnType<typeof useEditMode>['currentMode']['value']
) {
  expect(editMode.currentMode.value).toBe(mode)
}

export function expectArrayToHaveUniqueItems<T>(array: T[]) {
  const uniqueItems = new Set(array)
  expect(uniqueItems.size).toBe(array.length)
}

export function expectArrayToBeSortedAscending<T extends Record<string, number>>(
  array: T[],
  key: keyof T
) {
  for (let i = 1; i < array.length; i++) {
    const prev = array[i - 1][key]
    const curr = array[i][key]
    expect(curr).toBeGreaterThanOrEqual(prev)
  }
}

export function expectFunctionToHaveBeenCalledWithPartial(
  fn: Mock,
  partial: Record<string, unknown>
) {
  expect(fn).toHaveBeenCalled()
  const calls = fn.mock.calls
  const matchingCall = calls.find(call =>
    Object.entries(partial).every(([key, value]) => {
      const firstArgument = call[0]
      return Boolean(firstArgument) && typeof firstArgument === 'object' && firstArgument[key] === value
    })
  )
  expect(matchingCall).toBeDefined()
}
