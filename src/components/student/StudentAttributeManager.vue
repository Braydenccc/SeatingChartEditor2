<template>
  <div class="attribute-manager">
    <div class="attribute-header">
      <div>
        <h3>数值属性</h3>
        <p>用于身高、成绩等智能排位参考</p>
      </div>
      <button class="add-attribute-btn" @click="handleAdd">
        <Plus :size="14" />
        <span>添加属性</span>
      </button>
    </div>

    <div class="attribute-list">
      <div v-for="attribute in attributeDefinitions" :key="attribute.id" class="attribute-row">
        <input
          class="attr-input name-input"
          :value="attribute.name"
          aria-label="属性名"
          placeholder="属性名"
          @change="updateAttribute(attribute.id, { name: $event.target.value })"
        />
        <input
          class="attr-input unit-input"
          :value="attribute.unit"
          aria-label="单位"
          placeholder="单位"
          @change="updateAttribute(attribute.id, { unit: $event.target.value })"
        />
        <div class="range-compact" aria-label="数值范围">
          <input
            class="attr-input number-input"
            type="number"
            :value="attribute.min ?? ''"
            aria-label="最小值"
            placeholder="最小"
            @change="updateAttribute(attribute.id, { min: parseOptionalNumber($event.target.value) })"
          />
          <span>至</span>
          <input
            class="attr-input number-input"
            type="number"
            :value="attribute.max ?? ''"
            aria-label="最大值"
            placeholder="最大"
            @change="updateAttribute(attribute.id, { max: parseOptionalNumber($event.target.value) })"
          />
        </div>

        <label class="attr-enabled" title="启用为表格列">
          <input
            type="checkbox"
            :checked="attribute.enabled !== false"
            @change="updateAttribute(attribute.id, { enabled: $event.target.checked })"
          />
          <span class="switch-track"></span>
        </label>
        <button class="icon-btn danger" title="删除属性" @click="handleDelete(attribute.id)">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Plus, Trash2 } from 'lucide-vue-next'
import { useStudentAttributes } from '@/composables/useStudentAttributes'

const {
  attributeDefinitions,
  addAttribute,
  updateAttribute,
  deleteAttribute
} = useStudentAttributes()

const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const handleAdd = () => {
  const customCount = attributeDefinitions.value.filter(attribute =>
    String(attribute.name || '').startsWith('自定义数值')
  ).length
  addAttribute({
    name: `自定义数值${customCount + 1}`,
    unit: '',
    min: null,
    max: null,
    precision: 1,
    enabled: true,
    createdFrom: 'manual'
  })
}

const handleDelete = (attributeId) => {
  deleteAttribute(attributeId)
}
</script>

<style scoped>
.attribute-manager {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 10px;
  container-type: inline-size;
}

.attribute-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.attribute-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-primary);
}

.attribute-header p {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.add-attribute-btn,
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-radius: 6px;
  min-height: 28px;
  padding: 0 9px;
  cursor: pointer;
  white-space: nowrap;
}

.add-attribute-btn:hover,
.icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-btn {
  width: 30px;
  padding: 0;
}

.icon-btn.danger:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.attribute-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attribute-row {
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  padding: 6px;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  grid-template-areas:
    "name delete"
    "unit enabled"
    "range range";
  gap: 5px;
  align-items: center;
}

.name-input { grid-area: name; }
.unit-input { grid-area: unit; }
.range-compact { grid-area: range; }
.attr-enabled { grid-area: enabled; }
.attribute-row .icon-btn { grid-area: delete; }

.range-compact {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  width: 100%;
}

.range-compact > span {
  flex: 0 0 auto;
  color: var(--color-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.attr-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  min-height: 28px;
  padding: 0 7px;
  font-size: 12px;
}

.number-input {
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.attr-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.attr-enabled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  user-select: none;
}

.attr-enabled input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-border-strong);
  flex-shrink: 0;
  transition: background 0.18s ease;
}

.switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: 0 1px 3px var(--shadow-md);
  transition: transform 0.18s ease;
}

.attr-enabled input:checked + .switch-track {
  background: var(--color-primary);
}

.attr-enabled input:checked + .switch-track::after {
  transform: translateX(12px);
}

.attr-enabled:focus-within .switch-track {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  outline-offset: 2px;
}

@container (min-width: 520px) {
  .attribute-row {
    grid-template-columns: minmax(96px, 1fr) 58px minmax(132px, 0.9fr) 32px 30px;
    grid-template-areas: "name unit range enabled delete";
  }
}

@container (max-width: 360px) {
  .attribute-header {
    align-items: stretch;
    flex-direction: column;
  }

  .attribute-header p {
    display: none;
  }

  .add-attribute-btn {
    width: 100%;
  }
}

@container (max-width: 240px) {
  .range-compact {
    grid-template-columns: 1fr;
  }

  .range-compact > span {
    display: none;
  }
}
</style>
