import { ref, computed } from 'vue'
import {
  assignStudentRaw,
  clearSeatRaw,
  createSeatSnapshot,
  getSeatRaw,
  restoreSeatSnapshotRaw,
  swapSeatsRaw,
  toggleEmptyRaw
} from './seatChartState'
import { useLogger } from './useLogger'
import type { SeatSnapshotEntry } from './seatChartState'

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
  const { info, warning } = useLogger()

  const createSnapshot = () => createSeatSnapshot()

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

  const restoreSnapshot = (snapshot: SeatSnapshotEntry[]) => restoreSeatSnapshotRaw(snapshot)

  const resetHistoryState = () => {
    undoStack.value = []
    redoStack.value = []
    highlightedSeats.value = new Set()
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
            const current = getSeatRaw(s.id)
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
    const command = undoStack.value[undoStack.value.length - 1]
    if (!command) return false
    if (!executeUndo(command)) {
      resetHistoryState()
      warning('座位状态已变化，撤销历史已安全失效')
      return false
    }
    undoStack.value.pop()
    redoStack.value.push(cloneCommand(command))

    const affectedSeats = getAffectedSeats(command)
    highlightSeats(affectedSeats)
    info(`已${getOperationDescription(command, true)}（影响 ${affectedSeats.length} 个座位）`)

    return true
  }

  const redo = () => {
    if (!canRedo.value) return false
    const command = redoStack.value[redoStack.value.length - 1]
    if (!command) return false
    if (!executeRedo(command)) {
      resetHistoryState()
      warning('座位状态已变化，重做历史已安全失效')
      return false
    }
    redoStack.value.pop()
    undoStack.value.push(cloneCommand(command))

    const affectedSeats = getAffectedSeats(command)
    highlightSeats(affectedSeats)
    info(`已${getOperationDescription(command, false)}（影响 ${affectedSeats.length} 个座位）`)

    return true
  }

  const executeUndo = (command: UndoCommand) => {
    switch (command.type) {
      case 'assign': {
        const targetSeat = getSeatRaw(command.seatId)
        if (!targetSeat) return false
        if (command.previousSeatId) {
          const previousSeat = getSeatRaw(command.previousSeatId)
          if (!previousSeat || previousSeat.isEmpty || previousSeat.id === targetSeat.id) return false
          if (!assignStudentRaw(previousSeat.id, command.studentId)) return false
        }
        return clearSeatRaw(command.seatId)
      }
      case 'clear':
        return command.studentId === null
          ? getSeatRaw(command.seatId) !== null
          : assignStudentRaw(command.seatId, command.studentId)
      case 'swap':
        return swapSeatsRaw(command.seatId1, command.seatId2)
      case 'toggleEmpty':
        return toggleEmptyRaw(command.seatId)
      case 'batch':
        return restoreSnapshot(command.beforeSnapshot)
      case 'redo_wrapper':
        return restoreSnapshot(command.snapshot)
      default:
        return false
    }
  }

  const executeRedo = (command: UndoCommand) => {
    switch (command.type) {
      case 'assign': {
        const targetSeat = getSeatRaw(command.seatId)
        if (!targetSeat || targetSeat.isEmpty) return false
        if (command.previousSeatId) {
          const previousSeat = getSeatRaw(command.previousSeatId)
          if (!previousSeat || previousSeat.id === targetSeat.id) return false
          if (!clearSeatRaw(previousSeat.id)) return false
        }
        return assignStudentRaw(command.seatId, command.studentId)
      }
      case 'clear':
        return clearSeatRaw(command.seatId)
      case 'swap':
        return swapSeatsRaw(command.seatId1, command.seatId2)
      case 'toggleEmpty':
        return toggleEmptyRaw(command.seatId)
      case 'batch':
        return restoreSnapshot(command.afterSnapshot)
      case 'undo_wrapper':
        return restoreSnapshot(command.snapshot)
      default:
        return false
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
    if (studentId === null) return false
    pushCommand({
      type: 'clear',
      seatId,
      studentId
    })
    return true
  }

  const recordSwap = (seatId1: string, seatId2: string) => {
    const seat1 = getSeatRaw(seatId1)
    const seat2 = getSeatRaw(seatId2)
    if (
      !seat1 ||
      !seat2 ||
      seat1.isEmpty ||
      seat2.isEmpty ||
      seatId1 === seatId2 ||
      seat1.studentId === seat2.studentId
    ) return false
    pushCommand({
      type: 'swap',
      seatId1,
      seatId2
    })
    return true
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
    resetHistoryState()
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
