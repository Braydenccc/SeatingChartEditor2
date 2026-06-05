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
            <button
              :class="['tab-button', { active: activeTab === 'about' }]"
              @click="activeTab = 'about'"
            >
              关于
            </button>
          </div>

          <!-- 主体区域 -->
          <div class="settings-body">
            <!-- 左侧导航（桌面端） -->
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
              <!-- 移动端顶部二级Tab -->
              <div class="settings-sub-tabs">
                <button
                  v-for="category in currentCategories"
                  :key="category.id"
                  :class="['sub-tab-btn', { active: activeCategory === category.id }]"
                  @click="activeCategory = category.id"
                >
                  {{ category.label }}
                </button>
              </div>

              <div class="content-header">
                <h2>{{ currentCategoryLabel }}</h2>
              </div>
              <div class="content-body">
                <component
                  :is="currentComponent"
                  v-if="currentComponent"
                  :settings="activeTab === 'global' && activeCategory !== 'sync' ? currentSettings : undefined"
                  @update:settings="(val) => activeTab === 'global' && activeCategory !== 'sync' && Object.assign(currentSettings, val)"
                />
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
import { ref, computed, watch } from 'vue'
import { Cloud, Palette, Edit, Info, Grid, RotateCw, Wand2, FileDown } from 'lucide-vue-next'
import SyncPanel from './panels/SyncPanel.vue'
import UIPanel from './panels/UIPanel.vue'
import EditorPanel from './panels/EditorPanel.vue'
import WorkspaceInfoPanel from './panels/WorkspaceInfoPanel.vue'
import SeatConfigPanel from './panels/SeatConfigPanel.vue'
import RotationPanel from './panels/RotationPanel.vue'
import AssignmentPanel from './panels/AssignmentPanel.vue'
import ExportPanel from './panels/ExportPanel.vue'
import AboutPanel from './panels/AboutPanel.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useLogger } from '@/composables/useLogger'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const props = defineProps({})

const emit = defineEmits(['save'])

const { visible, initialTab, initialCategory, closeSettings } = useSettingsDialog()
const { settings, saveToLocalStorage, resetSettings, applyThemeColor, applyColorScheme } = useGlobalSettings()
const { success, warning } = useLogger()

const activeTab = ref('global')
const activeCategory = ref('sync')

const globalCategories = [
  { id: 'sync', label: '云端同步', icon: Cloud, component: SyncPanel },
  { id: 'ui', label: '界面偏好', icon: Palette, component: UIPanel },
  { id: 'editor', label: '编辑器行为', icon: Edit, component: EditorPanel }
]

const workspaceCategories = [
  { id: 'info', label: '工作区信息', icon: Info, component: WorkspaceInfoPanel },
  { id: 'seat', label: '座位表配置', icon: Grid, component: SeatConfigPanel },
  { id: 'rotation', label: '自动轮换', icon: RotateCw, component: RotationPanel },
  { id: 'assignment', label: '智能排位', icon: Wand2, component: AssignmentPanel },
  { id: 'export', label: '导出配置', icon: FileDown, component: ExportPanel }
]

const aboutCategories = [
  { id: 'about', label: '关于', icon: Info, component: AboutPanel }
]

const currentCategories = computed(() => {
  if (activeTab.value === 'global') {
    return globalCategories
  } else if (activeTab.value === 'workspace') {
    return workspaceCategories
  }
  return aboutCategories
})

const currentCategoryLabel = computed(() => {
  const category = currentCategories.value.find(c => c.id === activeCategory.value)
  return category ? category.label : ''
})

const currentComponent = computed(() => {
  const category = currentCategories.value.find(c => c.id === activeCategory.value)
  return category?.component || null
})

const currentSettings = computed(() => {
  if (activeTab.value === 'global') {
    const categoryMap = {
      sync: settings.value.sync,
      ui: settings.value.ui,
      editor: settings.value.editor
    }
    return categoryMap[activeCategory.value] || {}
  }
  return {}
})

// Reset activeCategory when switching tabs
watch(activeTab, (newTab) => {
  if (newTab === 'global') {
    activeCategory.value = globalCategories[0].id
  } else if (newTab === 'workspace') {
    activeCategory.value = workspaceCategories[0].id
  } else {
    activeCategory.value = aboutCategories[0].id
  }
})

// Handle Escape key to close dialog
const handleKeydown = (e) => {
  if (e.key === 'Escape') handleCancel()
}

watch(visible, (newVal) => {
  if (newVal) {
    activeTab.value = initialTab.value
    activeCategory.value = initialCategory.value
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

const handleSave = () => {
  if (activeTab.value === 'global') {
    const saved = saveToLocalStorage()
    if (saved) {
      // 应用颜色方案和主题色
      applyColorScheme()
      applyThemeColor()
      success('全局设置已保存')
    } else {
      warning('设置保存失败')
    }
  } else {
    // 工作区设置保存（座位配置等会自动保存到工作区数据中）
    success('工作区设置已保存')
  }
  emit('save')
  closeSettings()
}

const handleCancel = () => {
  closeSettings()
}

const handleReset = () => {
  if (activeTab.value === 'global') {
    const categoryMap = {
      sync: 'sync',
      ui: 'ui',
      editor: 'editor'
    }
    const category = categoryMap[activeCategory.value]
    if (category) {
      resetSettings(category)
      success(`已重置 ${currentCategoryLabel.value}`)
    }
  } else {
    // 工作区设置不支持重置（因为是工作区特定数据）
    warning('工作区设置无法重置，请在各功能面板中单独操作')
  }
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.settings-dialog {
  background: var(--color-surface);
  border-radius: 8px;
  width: 90vw;
  height: 85vh;
  max-width: 1400px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  padding: 0 20px;
  background: var(--color-bg-hover);
  border-radius: 8px 8px 0 0;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.tab-button:hover {
  color: var(--color-text-primary);
}

.tab-button.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}

.settings-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  width: 160px;
  border-right: 1px solid var(--color-border);
  padding: 12px 0;
  overflow-y: auto;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary);
  transition: all 0.2s;
  text-align: left;
}

.nav-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-bg-selected);
  color: var(--color-text-primary);
  font-weight: 500;
  border-right: 3px solid var(--color-primary);
}

.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.content-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
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
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-hover);
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
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.settings-sub-tabs {
  display: none;
}

@media (max-width: 768px) {
  .settings-nav {
    display: none;
  }

  .settings-sub-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    background: var(--color-bg-hover);
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    scrollbar-gutter: stable;
  }

  .sub-tab-btn {
    flex-shrink: 0;
    padding: 6px 12px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--color-text-muted);
    border-radius: 6px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .sub-tab-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .sub-tab-btn.active {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    font-weight: 500;
  }

  .content-header {
    padding: 16px;
  }

  .content-header h2 {
    font-size: 16px;
    display: none;
  }

  .content-body {
    padding: 16px;
  }
}
</style>
