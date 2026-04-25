<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="settings-overlay" @click.self="handleCancel">
        <div class="settings-dialog" @click.stop>
          <!-- 顶部 Tab 切换 -->
          <div class="settings-tabs">
            <button
              :class="['tab-button', { active: activeTab === 'global' }]"
              @click="activeTab = 'global'"
            >
              全局设置
            </button>
            <button
              :class="['tab-button', { active: activeTab === 'workspace' }]"
              @click="activeTab = 'workspace'"
            >
              工作区设置
            </button>
          </div>

          <!-- 主体区域 -->
          <div class="settings-body">
            <!-- 左侧导航 -->
            <nav class="settings-nav">
              <button
                v-for="category in currentCategories"
                :key="category.id"
                :class="['nav-item', { active: activeCategory === category.id }]"
                @click="activeCategory = category.id"
              >
                <component :is="category.icon" :size="18" />
                <span>{{ category.label }}</span>
              </button>
            </nav>

            <!-- 右侧内容 -->
            <div class="settings-content">
              <div class="content-header">
                <h2>{{ currentCategoryLabel }}</h2>
              </div>
              <div class="content-body">
                <PlaceholderPanel :category="currentCategoryLabel" />
              </div>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="settings-footer">
            <button class="btn-secondary" @click="handleReset">
              重置
            </button>
            <div class="footer-actions">
              <button class="btn-secondary" @click="handleCancel">
                取消
              </button>
              <button class="btn-primary" @click="handleSave">
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Cloud, Palette, Edit, Info, Grid, RotateCw, Wand2, FileDown } from 'lucide-vue-next'
import PlaceholderPanel from './panels/PlaceholderPanel.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'save'])

const activeTab = ref('global')
const activeCategory = ref('appearance')

const globalCategories = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'editor', label: '编辑器', icon: Edit },
  { id: 'about', label: '关于', icon: Info }
]

const workspaceCategories = [
  { id: 'layout', label: '布局', icon: Grid },
  { id: 'rotation', label: '轮换', icon: RotateCw },
  { id: 'assignment', label: '分配', icon: Wand2 },
  { id: 'export', label: '导出', icon: FileDown },
  { id: 'cloud', label: '云端', icon: Cloud }
]

const currentCategories = computed(() => {
  return activeTab.value === 'global' ? globalCategories : workspaceCategories
})

const currentCategoryLabel = computed(() => {
  const category = currentCategories.value.find(c => c.id === activeCategory.value)
  return category ? category.label : ''
})

const handleSave = () => {
  emit('save')
  emit('update:visible', false)
}

const handleCancel = () => {
  emit('update:visible', false)
}

const handleReset = () => {
  console.log('重置当前分类设置:', activeCategory.value)
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.settings-dialog {
  background: white;
  border-radius: 8px;
  width: 900px;
  height: 600px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 20px;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.tab-button:hover {
  color: #23587b;
}

.tab-button.active {
  color: #23587b;
  border-bottom-color: #23587b;
  font-weight: 500;
}

.settings-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  width: 200px;
  border-right: 1px solid #e0e0e0;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s;
  text-align: left;
}

.nav-item:hover {
  background: #f8f9fa;
  color: #23587b;
}

.nav-item.active {
  background: #e8f2f7;
  color: #23587b;
  font-weight: 500;
  border-right: 3px solid #23587b;
}

.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.content-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.content-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.settings-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn-primary,
.btn-secondary {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #23587b;
  color: white;
}

.btn-primary:hover {
  background: #1d4763;
}

.btn-secondary {
  background: white;
  color: #64748b;
  border: 1px solid #e0e0e0;
}

.btn-secondary:hover {
  background: #f8f9fa;
  border-color: #cbd5e1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
