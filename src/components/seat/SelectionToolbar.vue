<template>
  <Transition name="sel-toolbar">
    <div v-if="visible" class="selection-toolbar" :style="positionStyle" @mousedown.stop @pointerdown.stop>
      <button class="sel-btn sel-btn--edit" title="编辑学生" :disabled="!hasStudent" @click="handleEdit">
        <Edit3 :size="15" stroke-width="2" />
        <span class="sel-btn-label">编辑</span>
      </button>
      <button class="sel-btn sel-btn--clear" title="移出学生" @click="handleClear">
        <UserMinus :size="15" stroke-width="2" />
        <span class="sel-btn-label">移出</span>
      </button>
      <button v-if="isExactlyTwo" class="sel-btn sel-btn--swap" title="交换座位" :disabled="!canShuffle" @click="handleShuffle">
        <ArrowLeftRight :size="15" stroke-width="2" />
        <span class="sel-btn-label">交换</span>
      </button>
      <button v-else class="sel-btn sel-btn--shuffle" title="打乱顺序" :disabled="!canShuffle" @click="handleShuffle">
        <Shuffle :size="15" stroke-width="2" />
        <span class="sel-btn-label">打乱</span>
      </button>
      <button class="sel-btn sel-btn--assign" title="一键排入" :disabled="isFull" @click="handleAssign">
        <Sparkles :size="15" stroke-width="2" />
        <span class="sel-btn-label">排入</span>
      </button>
      <div class="sel-divider"></div>
      <button class="sel-btn sel-btn--cancel" title="取消选区" @click="handleCancel">
        <X :size="14" stroke-width="2.5" />
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { Edit3, Shuffle, Sparkles, UserMinus, X, ArrowLeftRight } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, default: false },
  anchorX: { type: Number, default: 0 },
  anchorY: { type: Number, default: 0 },
  isFull: { type: Boolean, default: false },
  hasStudent: { type: Boolean, default: false },
  canShuffle: { type: Boolean, default: true },
  isExactlyTwo: { type: Boolean, default: false }
})

const emit = defineEmits(['edit', 'clear', 'shuffle', 'assign', 'cancel'])

const positionStyle = computed(() => ({
  left: `${props.anchorX}px`,
  top: `${props.anchorY}px`
}))

const handleEdit = () => emit('edit')
const handleClear = () => emit('clear')
const handleShuffle = () => emit('shuffle')
const handleAssign = () => emit('assign')
const handleCancel = () => emit('cancel')
</script>

<style scoped>
.selection-toolbar {
  position: absolute;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: #fff;
  border: 1px solid #d0d7dc;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
  transform: translateX(-50%);
  pointer-events: auto;
  user-select: none;
}

.sel-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.sel-btn:hover {
  background: #f0f4f7;
  color: #23587b;
}

.sel-btn:active {
  transform: scale(0.95);
}

.sel-btn--edit:hover {
  background: #f0f4f8;
  color: #23587b;
}

.sel-btn--edit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
  color: #999;
}

.sel-btn--clear:hover {
  background: #fef2f2;
  color: #dc2626;
}

.sel-btn--shuffle:hover {
  background: #f0f9ff;
  color: #0369a1;
}

.sel-btn--shuffle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
  color: #999;
}

.sel-btn--swap:hover {
  background: #fef3c7;
  color: #d97706;
}

.sel-btn--swap:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
  color: #999;
}

.sel-btn--assign:hover {
  background: #f0fdf4;
  color: #15803d;
}

.sel-btn--assign:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
  color: #999;
}

.sel-btn--cancel {
  padding: 5px;
  color: #999;
}

.sel-btn--cancel:hover {
  background: #f5f5f5;
  color: #666;
}

.sel-btn-label {
  line-height: 1;
}

.sel-divider {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 2px;
  flex-shrink: 0;
}

.sel-toolbar-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sel-toolbar-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.sel-toolbar-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(6px) scale(0.95);
}

.sel-toolbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px) scale(0.97);
}

@media (max-width: 768px) {
  .sel-btn-label {
    display: none;
  }

  .sel-btn {
    padding: 6px;
  }

  .selection-toolbar {
    padding: 3px 4px;
    gap: 1px;
  }
}
</style>
