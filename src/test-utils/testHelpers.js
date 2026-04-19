export const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const findStudentById = (students, id) => {
  return students.find(s => s.id === id)
}

export const findSeatById = (seats, id) => {
  return seats.find(s => s.id === id)
}

export const assignStudentsToSeats = (seats, assignments) => {
  assignments.forEach(({ seatId, studentId }) => {
    const seat = findSeatById(seats, seatId)
    if (seat) seat.studentId = studentId
  })
}

export const countOccupiedSeats = (seats) => {
  return seats.filter(s => s.studentId !== null && !s.isEmpty).length
}

export const countEmptySeats = (seats) => {
  return seats.filter(s => s.studentId === null && !s.isEmpty).length
}
