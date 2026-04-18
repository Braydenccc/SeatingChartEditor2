import { ref } from 'vue'
import { useSeatChart } from './useSeatChart'
import { useLogger } from './useLogger'

const MAX_HISTORY = 50

const undoStack = ref([])
const redoStack = ref([])
const highlightedSeats = ref(new Set())

export function useUndo() {
  const { seats, assignStudent, clearSeat, swapSeats, toggleEmpty, clearAllSeats } = useSeatChart()
  const { info } = useLogger()

  const createSnapshot = () => {
    return seats.value.map(seat => ({
      id: seat.id,
      studentId: seat.studentId,
      isEmpty: seat.isEmpty
    }))
  }

  const restoreSnapshot = (snapshot) => {
    snapshot.forEach(data => {
      const seat = seats.value.find(s => s.id === data.id)
      if (seat) {
        seat.studentId = data.studentId
        seat.isEmpty = data.isEmpty
      }
    })
  }

  const pushCommand = (command) => {
    undoStack.value.push(command)
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  const canUndo = () => undoStack.value.length > 0
  const canRedo = () => redoStack.value.length > 0

  const highlightSeats = (seatIds) => {
    highlightedSeats.value = new Set(seatIds)
    setTimeout(() => {
      highlightedSeats.value = new Set()
    }, 2000)
  }

  const getAffectedSeats = (command) => {
    const affected = []
    switch (command.type) {
      case 'assign':
        affected.push(command.seatId)
        if (command.previousSeatId) affected.push(command.previousSeatId)
        break
      case 'clear':
        affected.push(command.seatId)
        break
      case 'swap':
        affected.push(command.seatId1, command.seatId2)
        break
      case 'toggleEmpty':
        affected.push(command.seatId)
        break
      case 'batch':
        if (command.beforeSnapshot && command.afterSnapshot) {
          command.beforeSnapshot.forEach((before, idx) => {
            const after = command.afterSnapshot[idx]
            if (before.studentId !== after.studentId || before.isEmpty !== after.isEmpty) {
              affected.push(before.id)
            }
          })
        }
        break
      case 'redo_wrapper':
      case 'undo_wrapper':
        if (command.snapshot) {
          command.snapshot.forEach(s => affected.push(s.id))
        }
        break
    }
    return affected
  }

  const getOperationDescription = (command, isUndo) => {
    switch (command.type) {
      case 'assign':
        return isUndo ? '撤销分配' : '重做分配'
      case 'clear':
        return isUndo ? '撤销清空' : '重做清空'
      case 'swap':
        return isUndo ? '撤销交换' : '重做交换'
      case 'toggleEmpty':
        return isUndo ? '撤销空置切换' : '重做空置切换'
      case 'batch':
        return isUndo ? '撤销批量操作' : '重做批量操作'
      default:
        return isUndo ? '撤销操作' : '重做操作'
    }
  }

  const undo = () => {
    if (!canUndo()) return false
    const command = undoStack.value.pop()
    const beforeSnapshot = createSnapshot()
    executeUndo(command)
    redoStack.value.push({
      type: 'redo_wrapper',
      snapshot: beforeSnapshot
    })

    const affectedSeats = getAffectedSeats(command)
    highlightSeats(affectedSeats)
    info(`已${getOperationDescription(command, true)}（影响 ${affectedSeats.length} 个座位）`)

    return true
  }

  const redo = () => {
    if (!canRedo()) return false
    const command = redoStack.value.pop()
    const beforeSnapshot = createSnapshot()
    executeRedo(command)
    undoStack.value.push({
      type: 'undo_wrapper',
      snapshot: beforeSnapshot
    })

    const affectedSeats = getAffectedSeats(command)
    highlightSeats(affectedSeats)
    info(`已${getOperationDescription(command, false)}（影响 ${affectedSeats.length} 个座位）`)

    return true
  }

  const executeUndo = (command) => {
    switch (command.type) {
      case 'assign':
        if (command.previousSeatId) {
          assignStudent(command.previousSeatId, command.studentId, false)
        }
        clearSeat(command.seatId, false)
        break
      case 'clear':
        assignStudent(command.seatId, command.studentId, false)
        break
      case 'swap':
        swapSeats(command.seatId1, command.seatId2, false)
        break
      case 'toggleEmpty':
        toggleEmpty(command.seatId, false)
        break
      case 'batch':
        restoreSnapshot(command.beforeSnapshot)
        break
      case 'redo_wrapper':
        restoreSnapshot(command.snapshot)
        break
    }
  }

  const executeRedo = (command) => {
    switch (command.type) {
      case 'assign':
        if (command.previousSeatId) {
          clearSeat(command.previousSeatId, false)
        }
        assignStudent(command.seatId, command.studentId, false)
        break
      case 'clear':
        clearSeat(command.seatId, false)
        break
      case 'swap':
        swapSeats(command.seatId1, command.seatId2, false)
        break
      case 'toggleEmpty':
        toggleEmpty(command.seatId, false)
        break
      case 'batch':
        restoreSnapshot(command.afterSnapshot)
        break
      case 'undo_wrapper':
        restoreSnapshot(command.snapshot)
        break
    }
  }

  const recordAssign = (seatId, studentId, previousSeatId = null) => {
    pushCommand({
      type: 'assign',
      seatId,
      studentId,
      previousSeatId
    })
  }

  const recordClear = (seatId, studentId) => {
    pushCommand({
      type: 'clear',
      seatId,
      studentId
    })
  }

  const recordSwap = (seatId1, seatId2) => {
    pushCommand({
      type: 'swap',
      seatId1,
      seatId2
    })
  }

  const recordToggleEmpty = (seatId) => {
    pushCommand({
      type: 'toggleEmpty',
      seatId
    })
  }

  const recordBatch = (beforeSnapshot, afterSnapshot) => {
    pushCommand({
      type: 'batch',
      beforeSnapshot,
      afterSnapshot
    })
  }

  const isHighlighted = (seatId) => highlightedSeats.value.has(seatId)

  const clearHistory = () => {
    undoStack.value = []
    redoStack.value = []
    highlightedSeats.value = new Set()
  }

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    undo,
    redo,
    recordAssign,
    recordClear,
    recordSwap,
    recordToggleEmpty,
    recordBatch,
    clearHistory,
    createSnapshot,
    highlightedSeats,
    isHighlighted
  }
}
