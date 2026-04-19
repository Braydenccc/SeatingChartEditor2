import { expect } from 'vitest'

export function expectSeatToHaveStudent(seat, studentId) {
  expect(seat).toBeDefined()
  expect(seat.studentId).toBe(studentId)
}

export function expectSeatToBeEmpty(seat) {
  expect(seat).toBeDefined()
  expect(seat.studentId).toBe(null)
  expect(seat.isEmpty).toBe(false)
}

export function expectSeatToBeDisabled(seat) {
  expect(seat).toBeDefined()
  expect(seat.isEmpty).toBe(true)
}

export function expectStudentToHaveTags(student, tagIds) {
  expect(student).toBeDefined()
  expect(student.tags).toEqual(expect.arrayContaining(tagIds))
  expect(student.tags).toHaveLength(tagIds.length)
}

export function expectStudentToBeSelected(studentData, studentId) {
  expect(studentData.selectedStudentId.value).toBe(studentId)
}

export function expectNoStudentSelected(studentData) {
  expect(studentData.selectedStudentId.value).toBe(null)
}

export function expectRuleToBeEnabled(rule) {
  expect(rule).toBeDefined()
  expect(rule.enabled).toBe(true)
}

export function expectRuleToBeDisabled(rule) {
  expect(rule).toBeDefined()
  expect(rule.enabled).toBe(false)
}

export function expectZoneToContainSeat(zone, seatId) {
  expect(zone).toBeDefined()
  expect(zone.seatIds).toContain(seatId)
}

export function expectZoneNotToContainSeat(zone, seatId) {
  expect(zone).toBeDefined()
  expect(zone.seatIds).not.toContain(seatId)
}

export function expectUndoAvailable(undo) {
  expect(undo.canUndo.value).toBe(true)
}

export function expectUndoNotAvailable(undo) {
  expect(undo.canUndo.value).toBe(false)
}

export function expectRedoAvailable(undo) {
  expect(undo.canRedo.value).toBe(true)
}

export function expectRedoNotAvailable(undo) {
  expect(undo.canRedo.value).toBe(false)
}

export function expectModeToBeActive(editMode, mode) {
  expect(editMode.currentMode.value).toBe(mode)
}

export function expectArrayToHaveUniqueItems(array) {
  const uniqueItems = new Set(array)
  expect(uniqueItems.size).toBe(array.length)
}

export function expectArrayToBeSortedAscending(array, key) {
  for (let i = 1; i < array.length; i++) {
    const prev = key ? array[i - 1][key] : array[i - 1]
    const curr = key ? array[i][key] : array[i]
    expect(curr).toBeGreaterThanOrEqual(prev)
  }
}

export function expectFunctionToHaveBeenCalledWithPartial(fn, partial) {
  expect(fn).toHaveBeenCalled()
  const calls = fn.mock.calls
  const matchingCall = calls.find(call =>
    Object.entries(partial).every(([key, value]) => call[0]?.[key] === value)
  )
  expect(matchingCall).toBeDefined()
}
