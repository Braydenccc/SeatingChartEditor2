<template>
  <div class="student-list-item">
    <!-- 左侧：输入区域 -->
    <div class="student-info">
      <div class="input-wrapper name-wrapper">
        <input 
          class="info-input input-name" 
          v-model="localName" 
          @blur="handleSave"
          @keyup.enter="handleSave"
          placeholder="姓名"
          title="学生姓名"
        />
        <div class="input-line"></div>
      </div>
      <div class="input-wrapper number-wrapper">
        <span class="number-prefix">#</span>
        <input 
          class="info-input input-number" 
          v-model="localNumber" 
          @blur="handleSave"
          @keyup.enter="handleSave"
          placeholder="学号 (可选)"
          title="学生学号"
        />
        <div class="input-line"></div>
      </div>
    </div>

    <!-- 中间：标签区域 -->
    <div class="student-tags-wrapper">
      <!-- 颜色点模式 -->
      <div v-if="displayMode === 'dot'" class="student-tags">
        <span v-for="tagId in localTags" :key="tagId" 
          class="tag-dot"
          :style="{ backgroundColor: getTagColor(tagId) }"
          :title="getTagName(tagId)">
        </span>
      </div>
      <!-- 文字模式（右上角/座位下部） -->
      <div v-else class="student-tags-text">
        <span v-for="tagId in localTags" :key="tagId" 
          class="tag-text-item"
          :style="{ backgroundColor: getTagColor(tagId) }"
          :title="getTagName(tagId)">
          {{ getTagName(tagId).substring(0, 2) }}
        </span>
      </div>

      <!-- 添加标签组件 -->
      <div class="add-tag-wrapper" ref="wrapperRef">
        <button class="add-tag-btn" @click="toggleTagDropdown" title="添加标签" :class="{ active: showTagDropdown }">
          <Plus :size="12" stroke-width="2.5" />
        </button>
        
        <Teleport to="body">
          <transition name="dropdown-pop">
            <div v-show="showTagDropdown" ref="dropdownRef" class="tag-dropdown" :style="dropdownStyle" @click.stop>
              <div class="dropdown-header">选择标签</div>
              <div class="tag-options">
                <template v-for="tag in availableTags" :key="tag.id">
                  <div 
                    v-if="!localTags.includes(tag.id)"
                    class="tag-option" 
                    @click="addTag(tag.id)"
                  >
                    <div class="tag-color-dot" :style="{ backgroundColor: tag.color }"></div>
                    {{ tag.name }}
                  </div>
                </template>
                <div v-if="unassignedTags.length === 0" class="no-tags">暂无可用标签</div>
              </div>
            </div>
          </transition>
        </Teleport>
      </div>
    </div>

    <!-- 右侧：操作区域 -->
    <div class="student-actions">
      <button class="action-btn delete-btn" @click="handleDelete" title="删除">
        <Trash2 :size="16" stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Plus, X, Trash2 } from 'lucide-vue-next'
import { onClickOutside } from '@vueuse/core'
import { useTagData } from '@/composables/useTagData'

const props = defineProps({
  student: {
    type: Object,
    required: true
  },
  availableTags: {
    type: Array,
    required: false,
    default: () => []
  }
})

const emit = defineEmits(['update-student', 'delete-student'])

const { tagDisplayMode } = useTagData()

const displayMode = computed(() => tagDisplayMode.value)

const localName = ref(props.student.name || '')
const localNumber = ref(props.student.studentNumber || '')
const localTags = ref(props.student.tags ? [...props.student.tags] : [])

// 外部数据更新时同步
watch(() => props.student, (newVal) => {
  localName.value = newVal.name || ''
  localNumber.value = newVal.studentNumber || ''
  localTags.value = newVal.tags ? [...newVal.tags] : []
})

// 统一保存逻辑
const handleSave = () => {
  emit('update-student', props.student.id, {
    name: localName.value,
    studentNumber: localNumber.value,
    tags: localTags.value
  })
}

const handleDelete = () => {
  emit('delete-student', props.student.id)
}

// ================= 标签逻辑 =================
const showTagDropdown = ref(false)
const wrapperRef = ref(null)
const dropdownRef = ref(null)
const dropdownStyle = ref({})

onClickOutside(wrapperRef, () => {
  showTagDropdown.value = false
}, { ignore: [dropdownRef] })

const unassignedTags = computed(() => {
  return props.availableTags.filter(t => !localTags.value.includes(t.id))
})

const updateDropdownPosition = () => {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    zIndex: 9999
  }
}

const toggleTagDropdown = () => {
  if (!showTagDropdown.value) {
    updateDropdownPosition()
  }
  showTagDropdown.value = !showTagDropdown.value
}

const addTag = (tagId) => {
  if (!localTags.value.includes(tagId)) {
    localTags.value.push(tagId)
    handleSave()
  }
  showTagDropdown.value = false
}

const removeTag = (tagId) => {
  localTags.value = localTags.value.filter(id => id !== tagId)
  handleSave()
}

const getTag = (id) => props.availableTags.find(t => t.id === id)
const getTagName = (id) => getTag(id)?.name || '未知'
const getTagColor = (id) => getTag(id)?.color || '#999999'

</script>

<style scoped>
.student-list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--color-surface);
  padding: 10px 16px;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border-light);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
}

.student-list-item:hover {
  box-shadow: 0 5px 15px color-mix(in srgb, var(--color-primary) 8%, transparent);
  border-color: var(--color-border);
  transform: translateY(-1px);
}

/* ================= 左右分栏布局 ================= */

.student-info {
  display: flex;
  gap: 12px;
  min-width: 200px;
}

/* ================= 柔和清爽的输入框设计 ================= */

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  transition: background 0.3s ease;
}

.input-wrapper:hover,
.input-wrapper:focus-within {
  background: var(--color-bg-subtle);
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--color-primary);
  transition: width 0.3s ease, left 0.3s ease;
  border-radius: 2px;
}

.input-wrapper:focus-within .input-line {
  left: 0;
  width: 100%;
}

.info-input {
  border: none;
  background: transparent;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  width: 100%;
  outline: none;
  font-family: inherit;
}

.info-input::placeholder {
  color: var(--color-text-disabled);
  font-weight: 400;
}

.name-wrapper {
  width: 110px;
}

.name-wrapper .info-input {
  font-weight: 600;
  color: var(--color-primary);
}

.number-wrapper {
  width: 130px;
  padding-left: 10px;
}

.number-prefix {
  color: var(--color-text-disabled);
  font-size: 13px;
  font-weight: bold;
  user-select: none;
}

.number-wrapper .info-input {
  padding-left: 6px;
}

/* ================= 标签区域 ================= */

.student-tags-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.student-tags {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.student-tags-text {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.tag-text-item {
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-inverse);
  padding: 1px 4px;
  border-radius: 3px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}

.add-tag-wrapper {
  position: relative;
}

.add-tag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-bg-subtle);
  border: 1px dashed var(--color-border-strong);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.add-tag-btn:hover,
.add-tag-btn.active {
  background: var(--color-border);
  color: var(--color-primary);
  border-color: var(--color-border-strong);
}



/* ================= 右侧操作区域 ================= */

.student-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 40px;
}

.action-btn {
  background: transparent;
  border: none;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-disabled);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* ================= 响应式 ================= */

@media (max-width: 600px) {
  .student-list-item {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .student-tags-wrapper {
    width: 100%;
    order: 3;
    padding-top: 8px;
    border-top: 1px dashed var(--color-border);
  }
  
  .student-info {
    flex: 1;
  }
}
</style>

<!-- Teleport 到 body 的下拉菜单不受 scoped 限制，需独立全局样式 -->
<style>
.tag-dropdown {
  position: fixed;
  z-index: 9999;
  width: 160px;
  background: var(--color-surface);
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.tag-dropdown .dropdown-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.tag-dropdown .tag-options {
  max-height: 200px;
  overflow-y: auto;
}

.tag-dropdown .tag-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.2s;
}

.tag-dropdown .tag-option:hover {
  background: var(--color-bg-secondary);
}

.tag-dropdown .tag-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-dropdown .no-tags {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-disabled);
}

/* 下拉菜单展开动画 */
.dropdown-pop-enter-active,
.dropdown-pop-leave-active {
  transition: opacity 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: top left;
}

.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-5px);
}
</style>
