<template>
  <Transition name="drop-zone">
    <div v-if="visible" class="global-drop-zone"
      @dragover.prevent.stop="handleDragOver" @dragleave="handleDragLeave" @drop.prevent.stop="handleDrop"
      :class="{ 'drag-over': isDragOver, 'excel-drop': isFileDragActive }">
      <div class="drop-zone-content">
        <FileSpreadsheet v-if="isFileDragActive" class="drop-zone-icon" :size="20" stroke-width="2.2" />
        <LogOut v-else class="drop-zone-icon" :size="20" stroke-width="2.2" />
        <span class="drop-zone-text">{{ dropZoneText }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FileSpreadsheet, LogOut } from 'lucide-vue-next'
import { useDragState } from '@/composables/useDragState'
import { isExcelRosterFile, useRosterExcelImport } from '@/composables/useRosterExcelImport'
import { useSeatChart } from '@/composables/useSeatChart'
import { useStudentData } from '@/composables/useStudentData'
import { useLogger } from '@/composables/useLogger'
import { useSelection } from '@/composables/useSelection'
import { useUndo } from '@/composables/useUndo'

const { isDraggingFromSeat, endDragFromSeat } = useDragState()
const { clearSeat, getStudentAtSeat, findSeatByStudent } = useSeatChart()
const { students } = useStudentData()
const { clearSelection: clearSeatSelection } = useSelection()
const { recordBatch, createSnapshot } = useUndo()
const { success, warning } = useLogger()
const { beginExcelRosterImport } = useRosterExcelImport()

const isDragOver = ref(false)
const isFileDragActive = ref(false)
const isImportingExcel = ref(false)

const shouldShowSeatDropZone = computed(() => {
  const allAssigned = students.value.length > 0 && students.value.every(s => {
    return findSeatByStudent(s.id)
  })
  return isDraggingFromSeat.value && allAssigned
})

const visible = computed(() => shouldShowSeatDropZone.value || isFileDragActive.value || isImportingExcel.value)
const dropZoneText = computed(() => {
  if (isImportingExcel.value) return '正在导入 Excel 名单...'
  if (isFileDragActive.value) return '松开以导入 Excel 名单'
  return '拖到此处移出座位'
})

const hasFileTransfer = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer?.types) return false
  return Array.from(dataTransfer.types).includes('Files')
}

const handleDragOver = (e: DragEvent) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = isFileDragActive.value ? 'copy' : 'move'
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  if (
    e.currentTarget instanceof Node &&
    e.relatedTarget instanceof Node &&
    e.currentTarget.contains(e.relatedTarget)
  ) return
  isDragOver.value = false
}

const handleDrop = async (e: DragEvent) => {
  isDragOver.value = false
  if (hasFileTransfer(e.dataTransfer)) {
    await handleExcelDrop(e)
    return
  }

  const raw = getDragData(e)
  if (!raw) return

  try {
    const value: unknown = JSON.parse(raw)
    if (isSeatDragPayload(value)) {
      if (value.selectedSeatIds && value.selectedSeatIds.length > 1) {
        const beforeSnapshot = createSnapshot()
        value.selectedSeatIds.forEach(seatId => {
          if (getStudentAtSeat(seatId) !== null) {
            clearSeat(seatId, false)
          }
        })
        const afterSnapshot = createSnapshot()
        recordBatch(beforeSnapshot, afterSnapshot)
        clearSeatSelection()
        success(`已将 ${value.selectedSeatIds.length} 名学生移出座位`)
      } else {
        clearSeat(value.seatId)
        clearSeatSelection()
        success('已将学生移出座位')
      }
    }
  } catch {
    // ignore
  } finally {
    endDragFromSeat()
  }
}

interface SeatDragPayload {
  type: 'seat'
  seatId: string
  selectedSeatIds?: string[]
}

const isSeatDragPayload = (value: unknown): value is SeatDragPayload => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return candidate.type === 'seat' &&
    typeof candidate.seatId === 'string' &&
    (candidate.selectedSeatIds === undefined || (
      Array.isArray(candidate.selectedSeatIds) && candidate.selectedSeatIds.every(id => typeof id === 'string')
    ))
}

const getDragData = (e: DragEvent) => {
  return e.dataTransfer?.getData('application/json') || e.dataTransfer?.getData('text/plain') || ''
}

const handleDocumentDragOver = (e: DragEvent) => {
  if (!hasFileTransfer(e.dataTransfer)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  isFileDragActive.value = true
  isDragOver.value = true
}

const handleDocumentDragLeave = (e: DragEvent) => {
  if (!isFileDragActive.value) return
  const leftWindow = e.clientX <= 0 ||
    e.clientY <= 0 ||
    e.clientX >= window.innerWidth ||
    e.clientY >= window.innerHeight
  if (!leftWindow) return
  isFileDragActive.value = false
  isDragOver.value = false
}

const handleDocumentDrop = async (e: DragEvent) => {
  if (!hasFileTransfer(e.dataTransfer)) return
  e.preventDefault()
  await handleExcelDrop(e)
}

const handleExcelDrop = async (e: DragEvent) => {
  isFileDragActive.value = false
  isDragOver.value = false
  if (isImportingExcel.value) return

  const files = Array.from(e.dataTransfer?.files || [])
  const excelFiles = files.filter(file => isExcelRosterFile(file))
  if (excelFiles.length === 0) {
    warning('请拖入 .xlsx 或 .xls 格式的 Excel 名单文件')
    return
  }
  if (excelFiles.length > 1) {
    warning('一次只能导入一个 Excel 名单文件，已使用第一个文件')
  }

  isImportingExcel.value = true
  try {
    const firstFile = excelFiles[0]
    if (firstFile) await beginExcelRosterImport(firstFile)
  } finally {
    isImportingExcel.value = false
  }
}

onMounted(() => {
  document.addEventListener('dragover', handleDocumentDragOver)
  document.addEventListener('dragleave', handleDocumentDragLeave)
  document.addEventListener('drop', handleDocumentDrop)
})

onUnmounted(() => {
  document.removeEventListener('dragover', handleDocumentDragOver)
  document.removeEventListener('dragleave', handleDocumentDragLeave)
  document.removeEventListener('drop', handleDocumentDrop)
})
</script>

<style scoped>
.global-drop-zone {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  background: var(--color-primary);
  box-shadow: 0 -4px 20px var(--shadow-md);
  cursor: pointer;
}

.global-drop-zone.drag-over {
  background: var(--color-primary-hover);
}

.global-drop-zone.excel-drop {
  background: var(--color-success);
}

.drop-zone-content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-surface);
}

.drop-zone-icon {
  flex-shrink: 0;
  animation: drop-bounce 1s ease-in-out infinite;
}

.drop-zone-text {
  letter-spacing: 0;
}

@keyframes drop-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.drop-zone-enter-active,
.drop-zone-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.drop-zone-enter-from,
.drop-zone-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
