<template>
  <div v-if="visible" class="dialog-overlay" @click.self="emit('close')">
    <section class="workbench-dialog">
      <header class="dialog-header">
        <div>
          <h2>位移轮换</h2>
          <p>按行列偏移整体移动当前座位中的学生</p>
        </div>
        <button class="icon-button" title="关闭" @click="emit('close')">
          <X :size="18" stroke-width="2" />
        </button>
      </header>

      <div class="dialog-body">
        <div class="direction-pad">
          <button :class="{ active: form.shiftDistance < 0 }" @click="setForward">
            <ArrowUp :size="18" stroke-width="2" />
            <span>向前</span>
          </button>
          <button :class="{ active: form.shiftColShift < 0 }" @click="setLeft">
            <ArrowLeft :size="18" stroke-width="2" />
            <span>向左</span>
          </button>
          <div class="shift-summary">
            <strong>{{ statusText }}</strong>
            <span>支持同时设置行偏移和列偏移</span>
          </div>
          <button :class="{ active: form.shiftColShift > 0 }" @click="setRight">
            <ArrowRight :size="18" stroke-width="2" />
            <span>向右</span>
          </button>
          <button :class="{ active: form.shiftDistance > 0 }" @click="setBackward">
            <ArrowDown :size="18" stroke-width="2" />
            <span>向后</span>
          </button>
        </div>

        <div class="field-grid">
          <label>
            <span>行偏移</span>
            <input v-model.number="form.shiftDistance" type="number" />
          </label>
          <label>
            <span>列直移</span>
            <input v-model.number="form.shiftColShift" type="number" />
          </label>
          <label>
            <span>溢出列移</span>
            <input v-model.number="form.shiftDirection" type="number" />
          </label>
        </div>
      </div>

      <footer class="dialog-footer">
        <button class="secondary-button" @click="resetForm">重置</button>
        <button class="primary-button" @click="applySeatShift">
          <RefreshCcw :size="16" stroke-width="2" />
          <span>应用位移</span>
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RefreshCcw, X } from 'lucide-vue-next'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useUndo } from '@/composables/useUndo'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])
const { seatConfig, shiftSeats } = useSeatChart()
const { createSnapshot, recordBatch } = useUndo()
const { success, warning } = useLogger()

const form = reactive({
  shiftDistance: 4,
  shiftColShift: 0,
  shiftDirection: -1
})

const resetForm = () => {
  form.shiftDistance = Number(seatConfig.value.shiftDistance ?? 4)
  form.shiftColShift = Number(seatConfig.value.shiftColShift ?? 0)
  form.shiftDirection = Number(seatConfig.value.shiftDirection ?? -1)
}

watch(() => props.visible, (visible) => {
  if (visible) resetForm()
}, { immediate: true })

const setForward = () => { form.shiftDistance = -Math.abs(form.shiftDistance || 4) }
const setBackward = () => { form.shiftDistance = Math.abs(form.shiftDistance || 4) }
const setLeft = () => { form.shiftColShift = -Math.abs(form.shiftColShift || 1) }
const setRight = () => { form.shiftColShift = Math.abs(form.shiftColShift || 1) }

const statusText = computed(() => {
  const parts = []
  if (form.shiftDistance) parts.push(`${form.shiftDistance > 0 ? '向后' : '向前'} ${Math.abs(form.shiftDistance)} 行`)
  if (form.shiftColShift) parts.push(`${form.shiftColShift > 0 ? '向右' : '向左'} ${Math.abs(form.shiftColShift)} 列`)
  if (form.shiftDirection) parts.push(`溢出列移 ${form.shiftDirection}`)
  return parts.length ? parts.join('，') : '尚未设置位移'
})

const applySeatShift = () => {
  const shiftDistance = Number(form.shiftDistance || 0)
  const shiftColShift = Number(form.shiftColShift || 0)
  const shiftDirection = Number(form.shiftDirection || 0)
  if (shiftDistance === 0 && shiftColShift === 0) {
    warning('行偏移和列偏移不能同时为 0')
    return
  }

  const before = createSnapshot()
  shiftSeats(shiftDistance, shiftDirection, shiftColShift)
  const after = createSnapshot()
  recordBatch(before, after)
  success(`座位轮换完成：${statusText.value}`)
  emit('close')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg-overlay);
}

.workbench-dialog {
  width: min(560px, 100%);
  max-height: min(720px, 90vh);
  display: flex;
  flex-direction: column;
  background: var(--color-dialog-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.dialog-footer {
  border-top: 1px solid var(--color-border);
  border-bottom: none;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text-primary);
}

.dialog-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.icon-button {
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.dialog-body {
  overflow-y: auto;
  padding: 16px;
}

.direction-pad {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 10px;
  align-items: stretch;
}

.direction-pad button,
.primary-button,
.secondary-button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
}

.direction-pad button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.shift-summary {
  grid-row: span 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.shift-summary strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.shift-summary span {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.field-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.field-grid input {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 10px;
  background: var(--color-input-bg);
  color: var(--color-text-primary);
}

.primary-button {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.secondary-button {
  color: var(--color-text-secondary);
}

@media (max-width: 640px) {
  .dialog-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .workbench-dialog {
    border-radius: 12px 12px 0 0;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
