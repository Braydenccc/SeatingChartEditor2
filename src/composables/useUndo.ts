import { ref, computed } from 'vue'
import { useSeatChart } from './useSeatChart'
import { useLogger } from './useLogger'

interface SeatSnapshotEntry {
  id: string
  studentId: number | null
  isEmpty: boolean
}

type UndoCommand =
  | { type: 'assign'; seatId: string; studentId: number; previousSeatId: string | null }
  | { type: 'clear'; seatId: string; studentId: number | null }
  | { type: 'swap'; seatId1: string; seatId2: string }
  | { type: 'toggleEmpty'; seatId: string }
  | { type: 'batch'; beforeSnapshot: SeatSnapshotEntry[]; afterSnapshot: SeatSnapshotEntry[] }
  | { type: 'redo_wrapper' | 'undo_wrapper'; snapshot: SeatSnapshotEntry[] }

let MAX_HISTORY = 50

const undoStack = ref<UndoCommand[]>([])
const redoStack = ref<UndoCommand[]>([])
const highlightedSeats = ref<Set<string>>(new Set())

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

  const cloneSnapshot = (snapshot: SeatSnapshotEntry[]) => {
    return snapshot.map(item => ({ ...item }))
  }

  const cloneCommand = (command: UndoCommand): UndoCommand => {
    if (command.type === 'batch') {
      return {
        ...command,
        beforeSnapshot: cloneSnapshot(command.beforeSnapshot),
        afterSnapshot: cloneSnapshot(command.afterSnapshot)
      }
    }
    if (command.type === 'redo_wrapper' || command.type === 'undo_wrapper') {
      return {
        ...command,
        snapshot: cloneSnapshot(command.snapshot)
      }
    }
    return { ...command }
  }

  const restoreSnapshot = (snapshot: SeatSnapshotEntry[]) => {
    snapshot.forEach(data => {
      const seat = seats.value.find(s => s.id === data.id)
      if (seat) {
        seat.isEmpty = data.isEmpty
        seat.studentId = data.isEmpty ? null : data.studentId
      }
    })
  }

  const pushCommand = (command: UndoCommand) => {
    undoStack.value.push(command)
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  const highlightSeats = (seatIds: string[]) => {
    highlightedSeats.value = new Set(seatIds)
    setTimeout(() => {
      highlightedSeats.value = new Set()
    }, 2000)
  }

  const getAffectedSeats = (command: UndoCommand) => {
    const affected: string[] = []
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
            if (after && (before.studentId !== after.studentId || before.isEmpty !== after.isEmpty)) {
              affected.push(before.id)
            }
          })
        }
        break
      case 'redo_wrapper':
      case 'undo_wrapper':
        if (command.snapshot) {
          command.snapshot.forEach(s => {
            const current = seats.value.find(seat => seat.id === s.id)
            if (current && (current.studentId !== s.studentId || current.isEmpty !== s.isEmpty)) {
              affected.push(s.id)
            }
          })
        }
        break
    }
    return affected
  }

  const getOperationDescription = (command: UndoCommand, isUndo: boolean) => {
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
    if (!canUndo.value) return false
    const command = undoStack.value.pop()
    if (!command) return false
    executeUndo(command)
    redoStack.value.push(cloneCommand(command))

    const affectedSeats = getAffectedSeats(command)
    highlightSeats(affectedSeats)
    info(`已${getOperationDescription(command, true)}（影响 ${affectedSeats.length} 个座位）`)

    return true
  }

  const redo = () => {
    if (!canRedo.value) return false
    const command = redoStack.value.pop()
    if (!command) return false
    executeRedo(command)
    undoStack.value.push(cloneCommand(command))

    const affectedSeats = getAffectedSeats(command)
    highlightSeats(affectedSeats)
    info(`已${getOperationDescription(command, false)}（影响 ${affectedSeats.length} 个座位）`)

    return true
  }

  const executeUndo = (command: UndoCommand) => {
    switch (command.type) {
      case 'assign':
        if (command.previousSeatId) {
          assignStudent(command.previousSeatId, command.studentId, false)
        }
        clearSeat(command.seatId, false)
        break
      case 'clear':
        if (command.studentId !== null) assignStudent(command.seatId, command.studentId, false)
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

  const executeRedo = (command: UndoCommand) => {
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

  const recordAssign = (seatId: string, studentId: number, previousSeatId: string | null = null) => {
    pushCommand({
      type: 'assign',
      seatId,
      studentId,
      previousSeatId
    })
  }

  const recordClear = (seatId: string, studentId: number | null) => {
    pushCommand({
      type: 'clear',
      seatId,
      studentId
    })
  }

  const recordSwap = (seatId1: string, seatId2: string) => {
    pushCommand({
      type: 'swap',
      seatId1,
      seatId2
    })
  }

  const recordToggleEmpty = (seatId: string) => {
    pushCommand({
      type: 'toggleEmpty',
      seatId
    })
  }

  const recordBatch = (beforeSnapshot: SeatSnapshotEntry[], afterSnapshot: SeatSnapshotEntry[]) => {
    const changed = beforeSnapshot.length !== afterSnapshot.length || beforeSnapshot.some((before, index) => {
      const after = afterSnapshot[index]
      return !after ||
        before.id !== after.id ||
        before.studentId !== after.studentId ||
        before.isEmpty !== after.isEmpty
    })
    if (!changed) return false

    pushCommand({
      type: 'batch',
      beforeSnapshot: cloneSnapshot(beforeSnapshot),
      afterSnapshot: cloneSnapshot(afterSnapshot)
    })
    return true
  }

  const isHighlighted = (seatId: string) => highlightedSeats.value.has(seatId)

  const clearHistory = () => {
    undoStack.value = []
    redoStack.value = []
    highlightedSeats.value = new Set()
  }

  // 别名方法
  const clear = () => {
    clearHistory()
  }

  // 设置最大历史记录数
  const setMaxHistory = (size: number) => {
    if (size && size >= 10 && size <= 100) {
      MAX_HISTORY = size
      // 如果当前历史超过新限制，裁剪
      while (undoStack.value.length > MAX_HISTORY) {
        undoStack.value.shift()
      }
      while (redoStack.value.length > MAX_HISTORY) {
        redoStack.value.shift()
      }
    }
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
    clear,
    createSnapshot,
    highlightedSeats,
    isHighlighted,
    setMaxHistory
  }
}
