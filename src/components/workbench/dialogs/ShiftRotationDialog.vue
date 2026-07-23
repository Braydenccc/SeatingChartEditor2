<template>
  <ResponsiveOverlay :show="visible" title="位移轮换" :desktop-width="620" @update:show="value => !value && emit('close')">
      <p class="dialog-description">按行列偏移整体移动当前座位中的学生</p>
      <div class="dialog-body">
        <div class="direction-pad">
          <NButton size="small" :type="form.shiftDistance < 0 ? 'primary' : 'default'" :secondary="form.shiftDistance >= 0" @click="setForward">
            <template #icon><ArrowUp :size="18" stroke-width="2" /></template>
            <span>向前</span>
          </NButton>
          <NButton size="small" :type="form.shiftColShift < 0 ? 'primary' : 'default'" :secondary="form.shiftColShift >= 0" @click="setLeft">
            <template #icon><ArrowLeft :size="18" stroke-width="2" /></template>
            <span>向左</span>
          </NButton>
          <div class="shift-summary">
            <strong>{{ statusText }}</strong>
            <span>支持同时设置行偏移和列偏移</span>
          </div>
          <NButton size="small" :type="form.shiftColShift > 0 ? 'primary' : 'default'" :secondary="form.shiftColShift <= 0" @click="setRight">
            <template #icon><ArrowRight :size="18" stroke-width="2" /></template>
            <span>向右</span>
          </NButton>
          <NButton size="small" :type="form.shiftDistance > 0 ? 'primary' : 'default'" :secondary="form.shiftDistance <= 0" @click="setBackward">
            <template #icon><ArrowDown :size="18" stroke-width="2" /></template>
            <span>向后</span>
          </NButton>
        </div>

        <div class="field-grid">
          <label>
            <span>行偏移</span>
            <NInputNumber class="shift-number-input" :value="form.shiftDistance" :precision="0" @update:value="value => updateShiftField('shiftDistance', value)" />
          </label>
          <label>
            <span>列直移</span>
            <NInputNumber class="shift-number-input" :value="form.shiftColShift" :precision="0" @update:value="value => updateShiftField('shiftColShift', value)" />
          </label>
          <label>
            <span>溢出列移</span>
            <NInputNumber class="shift-number-input" :value="form.shiftDirection" :precision="0" @update:value="value => updateShiftField('shiftDirection', value)" />
          </label>
        </div>
      </div>

      <template #footer><footer class="dialog-footer">
        <NButton secondary @click="resetForm">重置</NButton>
        <NButton type="primary" @click="applySeatShift">
          <template #icon><RefreshCcw :size="16" stroke-width="2" /></template>
          <span>应用位移</span>
        </NButton>
      </footer></template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { NButton, NInputNumber } from 'naive-ui'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RefreshCcw } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useUndo } from '@/composables/useUndo'
import { normalizeRequiredNumberInput } from '@/utils/inputNormalization'

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

type ShiftField = keyof typeof form

const updateShiftField = (field: ShiftField, value: number | null) => {
  form[field] = normalizeRequiredNumberInput(value, form[field], { precision: 0 })
}

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

.dialog-body {
  flex: 1;
  min-height: 0;
}

.direction-pad {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 10px;
  align-items: stretch;
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

.shift-number-input {
  width: 100%;
}

@media (max-width: 640px) {

  .field-grid {
    grid-template-columns: 1fr;
  }

}
</style>
