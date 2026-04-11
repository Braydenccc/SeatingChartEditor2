<template>
  <Transition name="drop-zone">
    <div v-if="visible" class="global-drop-zone"
      @dragover.prevent="handleDragOver" @dragleave="handleDragLeave" @drop.prevent="handleDrop"
      :class="{ 'drag-over': isDragOver }">
      <div class="drop-zone-content">
        <span class="drop-zone-icon">↑</span>
        <span class="drop-zone-text">拖到此处移出座位</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useDragState } from '@/composables/useDragState'
import { useSeatChart } from '@/composables/useSeatChart'
import { useStudentData } from '@/composables/useStudentData'
import { useUndo } from '@/composables/useUndo'
import { useLogger } from '@/composables/useLogger'

const { isDraggingFromSeat } = useDragState()
const { clearSeat, getStudentAtSeat } = useSeatChart()
const { clearSelection, students } = useStudentData()
const { recordClear } = useUndo()
const { success } = useLogger()

const isDragOver = ref(false)

const visible = computed(() => {
  const allAssigned = students.value.length > 0 && students.value.every(s => {
    const { findSeatByStudent } = useSeatChart()
    return findSeatByStudent(s.id)
  })
  return isDraggingFromSeat.value && allAssigned
})

const handleDragOver = (e) => {
  e.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

const handleDragLeave = (e) => {
  if (e.currentTarget.contains(e.relatedTarget)) return
  isDragOver.value = false
}

const handleDrop = (e) => {
  isDragOver.value = false
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.type === 'seat' && data.seatId) {
      const studentId = getStudentAtSeat(data.seatId)
      recordClear(data.seatId, studentId)
      clearSeat(data.seatId)
      clearSelection()
      success('已将学生移出座位')
    }
  } catch {
    // ignore
  }
}
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
  background: linear-gradient(180deg, rgba(35, 88, 123, 0.95) 0%, rgba(35, 88, 123, 1) 100%);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.global-drop-zone.drag-over {
  background: linear-gradient(180deg, rgba(35, 88, 123, 1) 0%, #1a4a6b 100%);
}

.drop-zone-content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.drop-zone-icon {
  font-size: 20px;
  animation: drop-bounce 1s ease-in-out infinite;
}

.drop-zone-text {
  letter-spacing: 2px;
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
