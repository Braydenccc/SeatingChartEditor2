<template>
  <div class="empty-state">
    <div class="empty-icon">
      <component :is="iconComponent" :size="64" stroke-width="1.5" />
    </div>
    <p class="empty-text">{{ message }}</p>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
    <div v-if="$slots.default" class="empty-action">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Users, Tag, ClipboardList } from 'lucide-vue-next'

const props = defineProps({
  type: {
    type: String,
    default: 'student',
  },
  message: {
    type: String,
    required: true
  },
  hint: {
    type: String,
    default: ''
  }
})

const iconComponent = computed(() => {
  switch (props.type) {
    case 'student': return Users
    case 'tag': return Tag
    case 'rule': return ClipboardList
    default: return ClipboardList
  }
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  margin-bottom: 20px;
  color: #ccc;
  opacity: 0.6;
}

.empty-text {
  font-size: 16px;
  color: #666;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.empty-hint {
  font-size: 14px;
  color: #999;
  margin: 0;
  text-align: center;
}

.empty-action {
  margin-top: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .empty-state {
    padding: 30px 16px;
  }

  .empty-icon {
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 14px;
  }

  .empty-hint {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .empty-state {
    padding: 20px 12px;
  }

  .empty-text {
    font-size: 13px;
  }

  .empty-hint {
    font-size: 11px;
  }
}
</style>
