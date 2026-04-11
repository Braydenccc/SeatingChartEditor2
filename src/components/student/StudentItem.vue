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
    <div class="student-tags">
      <div 
        v-for="tagId in localTags" 
        :key="tagId"
        class="tag-pill"
        :style="{ 
          background: `color-mix(in srgb, ${getTagColor(tagId)} 15%, transparent)`,
          color: getTagColor(tagId),
          borderColor: `color-mix(in srgb, ${getTagColor(tagId)} 40%, transparent)`
        }"
      >
        <span class="tag-name">{{ getTagName(tagId) }}</span>
        <button class="remove-tag" @click="removeTag(tagId)" :style="{ color: getTagColor(tagId) }">
          <X :size="12" stroke-width="2.5" />
        </button>
      </div>

      <!-- 添加标签组件 -->
      <div class="add-tag-wrapper" ref="wrapperRef">
        <button class="add-tag-btn" @click="toggleTagDropdown" title="添加标签" :class="{ active: showTagDropdown }">
          <Plus :size="14" stroke-width="2.5" />
        </button>
        
        <transition name="dropdown-pop">
          <div v-if="showTagDropdown" class="tag-dropdown">
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

const localName = ref(props.student.name || '')
const localNumber = ref(props.student.studentNumber || '')
const localTags = ref(props.student.tags ? [...props.student.tags] : [])

// 外部数据更新时同步
watch(() => props.student, (newVal) => {
  localName.value = newVal.name || ''
  localNumber.value = newVal.studentNumber || ''
  localTags.value = newVal.tags ? [...newVal.tags] : []
}, { deep: true })

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

onClickOutside(wrapperRef, () => {
  showTagDropdown.value = false
})

const unassignedTags = computed(() => {
  return props.availableTags.filter(t => !localTags.value.includes(t.id))
})

const toggleTagDropdown = () => {
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
  background: #ffffff;
  padding: 10px 16px;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid #eef2f5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
}

.student-list-item:hover {
  box-shadow: 0 5px 15px rgba(35, 88, 123, 0.08);
  border-color: #d1e2ec;
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
  background: #f7f9fa;
  border-radius: 6px;
  transition: background 0.3s ease;
}

.input-wrapper:hover,
.input-wrapper:focus-within {
  background: #f0f4f8;
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: #23587b;
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
  color: #333;
  width: 100%;
  outline: none;
  font-family: inherit;
}

.info-input::placeholder {
  color: #a0aec0;
  font-weight: 400;
}

.name-wrapper {
  width: 110px;
}

.name-wrapper .info-input {
  font-weight: 600;
  color: #23587b;
}

.number-wrapper {
  width: 130px;
  padding-left: 10px;
}

.number-prefix {
  color: #a0aec0;
  font-size: 13px;
  font-weight: bold;
  user-select: none;
}

.number-wrapper .info-input {
  padding-left: 6px;
}

/* ================= 标签区域 ================= */

.student-tags {
  flex: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  animation: scaleIn 0.2s ease-out;
}

.tag-name {
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-tag {
  background: none;
  border: none;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
  opacity: 0.7;
}

.remove-tag:hover {
  background: rgba(0, 0, 0, 0.08);
  opacity: 1;
}

.add-tag-wrapper {
  position: relative;
}

.add-tag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #f0f4f8;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.add-tag-btn:hover,
.add-tag-btn.active {
  background: #e2e8f0;
  color: #23587b;
  border-color: #94a3b8;
  transform: scale(1.05);
}

/* 标签下拉菜单 */
.tag-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  width: 160px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  z-index: 50;
  overflow: hidden;
}

.dropdown-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.tag-options {
  max-height: 200px;
  overflow-y: auto;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  transition: background 0.2s;
}

.tag-option:hover {
  background: #f1f5f9;
}

.tag-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.no-tags {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

/* 下拉菜单动画 */
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
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* ================= 响应式 ================= */

@media (max-width: 600px) {
  .student-list-item {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .student-tags {
    width: 100%;
    order: 3;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
  }
  
  .student-info {
    flex: 1;
  }
}
</style>