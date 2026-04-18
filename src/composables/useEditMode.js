import { ref } from 'vue'

// 编辑模式类型
export const EditMode = {
  NORMAL: 'normal',           // 普通模式（分配学生）
  EMPTY_EDIT: 'empty_edit',   // 空置编辑模式
  SWAP: 'swap',               // 交换座位模式
  CLEAR: 'clear',             // 清空座位模式
  ZONE_EDIT: 'zone_edit'     // 选区编辑模式
}

// 当前编辑模式
const currentMode = ref(EditMode.NORMAL)

// 交换模式下第一个选中的座位
const firstSelectedSeat = ref(null)

export function useEditMode() {
  // 设置编辑模式
  const setMode = (mode) => {
    currentMode.value = mode
    // 切换模式时清除选中的座位
    if (mode !== EditMode.SWAP) {
      firstSelectedSeat.value = null
    }
  }

  // 切换空置编辑模式
  const toggleEmptyEditMode = () => {
    if (currentMode.value === EditMode.EMPTY_EDIT) {
      setMode(EditMode.NORMAL)
    } else {
      setMode(EditMode.EMPTY_EDIT)
    }
  }

  // 是否为空置编辑模式
  const isEmptyEditMode = () => {
    return currentMode.value === EditMode.EMPTY_EDIT
  }

  // 是否为交换模式
  const isSwapMode = () => {
    return currentMode.value === EditMode.SWAP
  }

  // 是否为选区编辑模式
  const isZoneEditMode = () => {
    return currentMode.value === EditMode.ZONE_EDIT
  }

  // 设置第一个选中的座位（交换模式）
  const setFirstSelectedSeat = (seatId) => {
    firstSelectedSeat.value = seatId
  }

  // 清除第一个选中的座位
  const clearFirstSelectedSeat = () => {
    firstSelectedSeat.value = null
  }

  return {
    currentMode,
    firstSelectedSeat,
    setMode,
    toggleEmptyEditMode,
    isEmptyEditMode,
    isSwapMode,
    isZoneEditMode,
    setFirstSelectedSeat,
    clearFirstSelectedSeat,
    EditMode
  }
}
