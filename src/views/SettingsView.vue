<template>
  <AppPageShell title="设置" eyebrow="全局与工作区">
    <template #actions>
      <button class="settings-action" type="button" @click="handleReset">重置当前项</button>
      <button class="settings-action primary" type="button" @click="handleSave">保存设置</button>
    </template>

    <div class="settings-page">
      <div class="settings-tabs">
        <button :class="{ active: activeTab === 'global' }" type="button" @click="activeTab = 'global'">全局设置</button>
        <button :class="{ active: activeTab === 'workspace' }" type="button" @click="activeTab = 'workspace'">工作区设置</button>
        <button :class="{ active: activeTab === 'about' }" type="button" @click="activeTab = 'about'">关于</button>
      </div>

      <div class="settings-layout">
        <nav class="settings-nav">
          <button
            v-for="category in currentCategories"
            :key="category.id"
            :class="{ active: activeCategory === category.id }"
            type="button"
            @click="activeCategory = category.id"
          >
            <component :is="category.icon" :size="17" />
            <span>{{ category.label }}</span>
          </button>
        </nav>

        <section class="settings-content">
          <h2>{{ currentCategoryLabel }}</h2>
          <component
            :is="currentComponent"
            v-if="currentComponent"
            :settings="activeTab === 'global' && activeCategory !== 'sync' ? currentSettings : undefined"
            @update:settings="handleSettingsUpdate"
          />
        </section>
      </div>
    </div>
  </AppPageShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Cloud, Edit, FileDown, Grid, Info, Palette, RotateCw, Wand2 } from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import AboutPanel from '@/components/settings/panels/AboutPanel.vue'
import AssignmentPanel from '@/components/settings/panels/AssignmentPanel.vue'
import EditorPanel from '@/components/settings/panels/EditorPanel.vue'
import ExportPanel from '@/components/settings/panels/ExportPanel.vue'
import RotationPanel from '@/components/settings/panels/RotationPanel.vue'
import SeatConfigPanel from '@/components/settings/panels/SeatConfigPanel.vue'
import SyncPanel from '@/components/settings/panels/SyncPanel.vue'
import UIPanel from '@/components/settings/panels/UIPanel.vue'
import WorkspaceInfoPanel from '@/components/settings/panels/WorkspaceInfoPanel.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useLogger } from '@/composables/useLogger'

const route = useRoute()
const { settings, saveToLocalStorage, resetSettings, applyThemeColor, applyColorScheme } = useGlobalSettings()
const { success, warning } = useLogger()

const activeTab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'global')
const activeCategory = ref(typeof route.query.category === 'string' ? route.query.category : 'sync')

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
  if (activeTab.value === 'workspace') return workspaceCategories
  if (activeTab.value === 'about') return aboutCategories
  return globalCategories
})

const currentCategoryLabel = computed(() => currentCategories.value.find(c => c.id === activeCategory.value)?.label || '')
const currentComponent = computed(() => currentCategories.value.find(c => c.id === activeCategory.value)?.component || null)

const currentSettings = computed(() => {
  const categoryMap = {
    sync: settings.value.sync,
    ui: settings.value.ui,
    editor: settings.value.editor
  }
  return categoryMap[activeCategory.value] || {}
})

watch(activeTab, (tab) => {
  const categories = tab === 'workspace'
    ? workspaceCategories
    : tab === 'about'
      ? aboutCategories
      : globalCategories
  if (!categories.some(category => category.id === activeCategory.value)) {
    activeCategory.value = categories[0].id
  }
})

watch(() => route.query, (query) => {
  if (typeof query.tab === 'string') activeTab.value = query.tab
  if (typeof query.category === 'string') activeCategory.value = query.category
})

const handleSettingsUpdate = (val) => {
  if (activeTab.value === 'global' && activeCategory.value !== 'sync') {
    Object.assign(currentSettings.value, val)
  }
}

const handleSave = () => {
  if (activeTab.value === 'global') {
    const saved = saveToLocalStorage()
    if (saved) {
      applyColorScheme()
      applyThemeColor()
      success('全局设置已保存')
    } else {
      warning('设置保存失败')
    }
  } else {
    success('工作区设置已保存')
  }
}

const handleReset = () => {
  if (activeTab.value !== 'global') {
    warning('当前设置项不支持重置')
    return
  }
  resetSettings(activeCategory.value)
  success('设置已重置')
}
</script>

<style scoped>
.settings-action {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.settings-action.primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.settings-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: none;
  border-radius: 0;
  overflow: hidden;
}

.settings-tabs {
  display: flex;
  gap: 2px;
  padding: 10px 12px 0;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
}

.settings-tabs button,
.settings-nav button {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-weight: 600;
}

.settings-tabs button {
  padding: 10px 18px;
  border-radius: 8px 8px 0 0;
}

.settings-tabs button.active {
  background: var(--color-surface);
  color: var(--color-primary);
}

.settings-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.settings-nav {
  padding: 14px;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-nav button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  text-align: left;
}

.settings-nav button.active,
.settings-nav button:hover {
  color: var(--color-primary);
  background: var(--color-surface);
}

.settings-content {
  padding: 20px;
  overflow: auto;
  min-width: 0;
}

.settings-content h2 {
  margin: 0 0 18px;
  color: var(--color-primary);
  font-size: 20px;
}

@media (max-width: 820px) {
  .settings-action {
    min-height: 40px;
    padding: 0 10px;
    white-space: nowrap;
  }

  .settings-tabs {
    overflow-x: auto;
    padding: 8px 10px 0;
    scrollbar-width: none;
  }

  .settings-tabs::-webkit-scrollbar {
    display: none;
  }

  .settings-tabs button {
    min-height: 40px;
    padding: 0 14px;
    white-space: nowrap;
  }

  .settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .settings-nav {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    flex-direction: row;
    overflow-x: auto;
    padding: 10px;
    scrollbar-width: none;
  }

  .settings-nav::-webkit-scrollbar {
    display: none;
  }

  .settings-nav button {
    min-height: 40px;
    white-space: nowrap;
  }

  .settings-content {
    padding: 14px 12px calc(18px + env(safe-area-inset-bottom, 0px));
  }

  .settings-content h2 {
    margin-bottom: 12px;
    font-size: 18px;
  }
}
</style>
