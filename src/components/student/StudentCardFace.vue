<template>
  <div
    class="student-card-face"
    :class="[
      `variant-${variant}`,
      `density-${density}`,
      {
        'bottom-tag-mode': tagDisplayMode === 'bottom',
        'name-hidden': !showStudentName,
        'number-hidden': !showStudentNumber,
        'large-name': largeNameMode,
        'large-number': largeNumberMode
      }
    ]"
  >
    <div class="face-main">
      <div v-if="showStudentName" class="student-name">{{ displayName }}</div>

      <div v-if="hasTags && tagDisplayMode === 'dot'" class="student-tags">
        <span
          v-for="tag in allVisibleTags"
          :key="tag.id"
          :class="['tag-dot', { 'tag-dot-hollow': !hasTag(tag.id) }]"
          :style="{ backgroundColor: hasTag(tag.id) ? tag.color : 'transparent', borderColor: tag.color }"
          :title="tag.name"
        ></span>
      </div>

      <div v-if="hasNumericAttributes && tagDisplayMode === 'dot'" class="student-attributes-text">
        <span
          v-for="attribute in visibleStudentAttributes"
          :key="attribute.id"
          class="attribute-text-item"
          :title="attribute.title"
        >
          {{ attribute.displayText }}
        </span>
      </div>

      <div v-if="showStudentNumber && tagDisplayMode === 'bottom'" class="student-number-corner">
        {{ displayNumber }}
      </div>
      <div v-else-if="showStudentNumber" class="student-number">{{ displayNumber }}</div>

      <div v-if="hasTags && tagDisplayMode === 'bottom'" class="student-tags-text">
        <span
          v-for="tag in studentTags"
          :key="tag.id"
          class="tag-text-item"
          :style="{ backgroundColor: tag.color }"
          :title="tag.name"
        >
          {{ tag.name.substring(0, 2) }}
        </span>
      </div>

      <div v-if="hasNumericAttributes && tagDisplayMode === 'bottom'" class="student-attributes-text">
        <span
          v-for="attribute in visibleStudentAttributes"
          :key="attribute.id"
          class="attribute-text-item"
          :title="attribute.title"
        >
          {{ attribute.displayText }}
        </span>
      </div>
    </div>

    <div v-if="hasTags && tagDisplayMode === 'corner'" class="corner-tags">
      <span
        v-for="tag in studentTags"
        :key="tag.id"
        class="corner-tag-item"
        :style="{ backgroundColor: tag.color }"
        :title="tag.name"
      >
        {{ tag.name.substring(0, 2) }}
      </span>
    </div>

    <div v-if="hasNumericAttributes && tagDisplayMode === 'corner'" class="corner-attributes">
      <span
        v-for="attribute in visibleStudentAttributes"
        :key="attribute.id"
        class="corner-attribute-item"
        :title="attribute.title"
      >
        {{ attribute.displayText }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useTagData } from '@/composables/useTagData'

const props = defineProps({
  student: {
    type: Object,
    default: null
  },
  variant: {
    type: String,
    default: 'seat',
    validator: value => ['seat', 'candidate', 'preview'].includes(value)
  },
  density: {
    type: String,
    default: 'standard',
    validator: value => ['standard', 'compact'].includes(value)
  },
  fallbackName: {
    type: String,
    default: '未命名'
  }
})

const { settings } = useGlobalSettings()
const { tags, showTagsInSeatChart, tagDisplayMode } = useTagData()
const { enabledAttributeDefinitions, formatNumericValue, showNumericAttributesInEditor } = useStudentAttributes()

const showStudentName = computed(() => settings.value.ui.showStudentName !== false)
const showStudentNumber = computed(() => settings.value.ui.showStudentNumber !== false)
const hasHiddenElement = computed(() => !showStudentName.value || !showStudentNumber.value)
const largeNameMode = computed(() => showStudentName.value && hasHiddenElement.value && settings.value.ui.largeNameMode)
const largeNumberMode = computed(() => showStudentNumber.value && hasHiddenElement.value && settings.value.ui.largeNumberMode)

const displayName = computed(() => props.student?.name || props.fallbackName)
const displayNumber = computed(() => props.student?.studentNumber || '-')

const allVisibleTags = computed(() => {
  if (!showTagsInSeatChart.value || !props.student) return []
  return tags.value.filter(tag => tag.showInSeatChart !== false)
})

const hasTag = (tagId) => {
  if (!props.student?.tags) return false
  return props.student.tags.includes(tagId)
}

const studentTags = computed(() => allVisibleTags.value.filter(tag => hasTag(tag.id)))

const hasTags = computed(() => {
  if (tagDisplayMode.value === 'dot') return allVisibleTags.value.length > 0
  return studentTags.value.length > 0
})

const visibleStudentAttributes = computed(() => {
  if (!showNumericAttributesInEditor.value || !props.student) return []
  const numericAttributes = props.student.numericAttributes || {}
  return enabledAttributeDefinitions.value
    .filter(attribute => attribute.showInEditor !== false)
    .map(attribute => {
      const rawValue = numericAttributes[attribute.id]
      if (rawValue === null || rawValue === undefined || rawValue === '') return null
      const numberValue = Number(rawValue)
      if (!Number.isFinite(numberValue)) return null
      const formattedValue = formatNumericValue(numberValue, attribute.id)
      if (!formattedValue) return null
      const shortName = (attribute.name || '数值').substring(0, 2)
      return {
        id: attribute.id,
        displayText: `${shortName}${formattedValue}`,
        title: `${attribute.name}: ${formattedValue}`
      }
    })
    .filter(Boolean)
})

const hasNumericAttributes = computed(() => visibleStudentAttributes.value.length > 0)
</script>

<style scoped>
.student-card-face {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
}

.face-main {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--student-card-face-gap);
  padding: var(--student-card-face-padding);
}

.student-card-face.variant-candidate .face-main {
  align-items: flex-start;
  gap: 3px;
  padding: 6px 10px;
}

.student-card-face.bottom-tag-mode .face-main {
  gap: 2px;
}

.student-card-face.name-hidden.number-hidden .face-main {
  justify-content: center;
}

.student-name {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--student-card-name-size);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0;
  text-align: center;
  text-overflow: ellipsis;
  word-break: break-word;
}

.student-card-face.variant-candidate .student-name {
  font-size: var(--student-card-candidate-name-size);
  text-align: left;
}

.student-card-face.large-name .student-name {
  font-size: var(--student-card-name-large-size);
}

.student-card-face.variant-candidate.large-name .student-name {
  font-size: 18px;
}

.student-number {
  min-width: 34px;
  padding: 2px 8px;
  border-radius: 5px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: var(--student-card-number-size);
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
}

.student-card-face.large-number .student-number {
  padding: 4px 12px;
  font-size: var(--student-card-number-large-size);
}

.student-number-corner {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  max-width: 42%;
  overflow: hidden;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-primary));
  color: var(--color-primary);
  font-size: var(--student-card-number-corner-size);
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-card-face.variant-candidate .student-number-corner {
  top: 5px;
  right: 8px;
}

.student-tags,
.student-tags-text,
.student-attributes-text {
  display: flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 3px;
}

.student-card-face.variant-candidate .student-tags,
.student-card-face.variant-candidate .student-tags-text,
.student-card-face.variant-candidate .student-attributes-text {
  justify-content: flex-start;
}

.tag-dot {
  width: var(--student-card-tag-dot-size);
  height: var(--student-card-tag-dot-size);
  flex-shrink: 0;
  border-radius: 50%;
  box-shadow: 0 1px 2px var(--shadow-lg);
}

.tag-dot-hollow {
  border: 1.5px solid;
  box-shadow: none;
}

.tag-text-item,
.corner-tag-item {
  max-width: 100%;
  overflow: hidden;
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--color-text-inverse);
  font-size: var(--student-card-tag-text-size);
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-shadow: 0 1px 1px var(--shadow-lg);
  white-space: nowrap;
}

.attribute-text-item,
.corner-attribute-item {
  max-width: 100%;
  overflow: hidden;
  padding: 1px 4px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
  border-radius: 3px;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary);
  font-size: var(--student-card-attribute-size);
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.corner-tags {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  display: flex;
  max-width: 80%;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 2px;
}

.corner-attributes {
  position: absolute;
  left: 4px;
  bottom: 4px;
  z-index: 1;
  display: flex;
  max-width: 82%;
  flex-wrap: wrap;
  gap: 2px;
}

.student-card-face.variant-candidate .corner-tags {
  top: 5px;
  right: 8px;
}

.student-card-face.variant-candidate .corner-attributes {
  left: 10px;
  bottom: 5px;
}

.student-card-face.density-compact {
  --student-card-face-gap: 2px;
  --student-card-face-padding: 5px 8px;
  --student-card-name-size: 15px;
  --student-card-candidate-name-size: 15px;
  --student-card-name-large-size: 18px;
  --student-card-number-size: 11px;
  --student-card-number-large-size: 14px;
  --student-card-number-corner-size: 8px;
  --student-card-tag-dot-size: 4px;
  --student-card-tag-text-size: 7px;
  --student-card-attribute-size: 7px;
}
</style>
