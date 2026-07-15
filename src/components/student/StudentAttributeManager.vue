<template>
  <div class="attribute-manager">
    <div class="attribute-header">
      <div>
        <h3>数值属性</h3>
        <p>用于身高、成绩等智能排位参考</p>
      </div>
      <NButton class="add-attribute-btn" size="small" type="primary" secondary @click="handleAdd">
        <Plus :size="14" />
        <span>添加属性</span>
      </NButton>
    </div>

    <div class="attribute-list">
      <div v-for="attribute in attributeDefinitions" :key="attribute.id" class="attribute-row">
        <NInput
          class="attr-input name-input"
          size="small"
          :value="attribute.name"
          aria-label="属性名"
          placeholder="属性名"
          @update:value="value => updateAttribute(attribute.id, { name: value })"
        />
        <NInput
          class="attr-input unit-input"
          size="small"
          :value="attribute.unit"
          aria-label="单位"
          placeholder="单位"
          @update:value="value => updateAttribute(attribute.id, { unit: value })"
        />
        <div class="range-compact" aria-label="数值范围">
          <NInputNumber
            class="attr-input number-input"
            size="small"
            :value="attribute.min"
            aria-label="最小值"
            placeholder="最小"
            @update:value="value => updateAttributeRange(attribute.id, 'min', value)"
          />
          <span>至</span>
          <NInputNumber
            class="attr-input number-input"
            size="small"
            :value="attribute.max"
            aria-label="最大值"
            placeholder="最大"
            @update:value="value => updateAttributeRange(attribute.id, 'max', value)"
          />
        </div>

        <NSwitch
          class="attr-enabled"
          :value="attribute.enabled !== false"
          title="启用为表格列"
          aria-label="启用为表格列"
          @update:value="value => updateAttribute(attribute.id, { enabled: value })"
        />
        <NButton class="icon-btn" size="small" quaternary circle type="error" title="删除属性" @click="handleDelete(attribute.id)">
          <Trash2 :size="14" />
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSwitch } from 'naive-ui'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { normalizeNumberInput } from '@/utils/inputNormalization'

const {
  attributeDefinitions,
  addAttribute,
  updateAttribute,
  deleteAttribute
} = useStudentAttributes()

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

const handleDelete = (attributeId: string) => {
  deleteAttribute(attributeId)
}

const updateAttributeRange = (
  attributeId: string,
  key: 'min' | 'max',
  value: number | null
) => {
  updateAttribute(attributeId, { [key]: normalizeNumberInput(value) })
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

.add-attribute-btn {
  white-space: nowrap;
}

.icon-btn {
  flex: 0 0 auto;
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
}

.number-input {
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.attr-enabled {
  justify-self: center;
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
