import type { Seat, Student } from '@/types/models'

export const requireDefined = <T>(value: T | null | undefined, message = 'Expected value to be defined'): T => {
  if (value === null || value === undefined) throw new Error(message)
  return value
}

export const waitFor = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export const findStudentById = (students: Student[], id: number) => {
  return students.find(s => s.id === id)
}

export const findSeatById = (seats: Seat[], id: string) => {
  return seats.find(s => s.id === id)
}

export const assignStudentsToSeats = (
  seats: Seat[],
  assignments: Array<{ seatId: string; studentId: number }>
) => {
  assignments.forEach(({ seatId, studentId }) => {
    const seat = findSeatById(seats, seatId)
    if (seat) seat.studentId = studentId
  })
}

export const countOccupiedSeats = (seats: Seat[]) => {
  return seats.filter(s => s.studentId !== null && !s.isEmpty).length
}

export const countEmptySeats = (seats: Seat[]) => {
  return seats.filter(s => s.studentId === null && !s.isEmpty).length
}
