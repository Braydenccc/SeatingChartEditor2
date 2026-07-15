<template>
  <AppPageShell title="设置" eyebrow="全局与工作区">
    <template #actions>
      <NPopconfirm
        :disabled="activeTab !== 'global'"
        positive-text="重置"
        negative-text="取消"
        @positive-click="handleReset"
      >
        <template #trigger>
          <NButton size="small" secondary :disabled="activeTab !== 'global'">重置当前项</NButton>
        </template>
        确认将当前分类恢复为默认设置？修改会立即保存。
      </NPopconfirm>
    </template>

    <div class="settings-page">
      <NTabs v-model:value="activeTab" class="settings-tabs" type="segment" size="small">
        <NTabPane name="global" tab="全局设置" />
        <NTabPane name="workspace" tab="工作区设置" />
        <NTabPane name="about" tab="关于" />
      </NTabs>

      <div class="settings-layout">
        <nav class="settings-nav">
          <NMenu
            :value="activeCategory"
            :mode="isMobile ? 'horizontal' : 'vertical'"
            :options="menuOptions"
            :collapsed-width="0"
            @update:value="value => activeCategory = String(value)"
          />
        </nav>

        <section class="settings-content">
          <h2>{{ currentCategoryLabel }}</h2>
          <component
            :is="currentComponent"
            v-if="currentComponent"
            :settings="activeTab === 'global' && activeCategory !== 'sync' ? currentSettings : undefined"
          />
        </section>
      </div>
    </div>
  </AppPageShell>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { NButton, NIcon, NMenu, NPopconfirm, NTabPane, NTabs, type MenuOption } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { BookOpen, Cloud, Edit, FileDown, Grid, Info, Palette, RotateCw, Wand2 } from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import AboutPanel from '@/components/settings/panels/AboutPanel.vue'
import AssignmentPanel from '@/components/settings/panels/AssignmentPanel.vue'
import EditorPanel from '@/components/settings/panels/EditorPanel.vue'
import ExportPanel from '@/components/settings/panels/ExportPanel.vue'
import HelpPanel from '@/components/settings/panels/HelpPanel.vue'
import RotationPanel from '@/components/settings/panels/RotationPanel.vue'
import SeatConfigPanel from '@/components/settings/panels/SeatConfigPanel.vue'
import SyncPanel from '@/components/settings/panels/SyncPanel.vue'
import UIPanel from '@/components/settings/panels/UIPanel.vue'
import WorkspaceInfoPanel from '@/components/settings/panels/WorkspaceInfoPanel.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useLogger } from '@/composables/useLogger'
import type { SettingsCategory } from '@/types/settings'

const route = useRoute()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 820px)')
const {
  settings,
  resetCategory,
  applyThemeColor,
  applyColorScheme,
  flushPendingSave
} = useGlobalSettings()
const { success } = useLogger()

type SettingsTab = 'global' | 'workspace' | 'about'
interface SettingsCategoryItem {
  id: string
  label: string
  icon: Component
  component: Component
}

const validTabs = new Set<SettingsTab>(['global', 'workspace', 'about'])
const initialTab = typeof route.query.tab === 'string' && validTabs.has(route.query.tab as SettingsTab)
  ? route.query.tab as SettingsTab
  : 'global'
const activeTab = ref<SettingsTab>(initialTab)
const activeCategory = ref(typeof route.query.category === 'string' ? route.query.category : 'sync')

const globalCategories: SettingsCategoryItem[] = [
  { id: 'sync', label: '云端同步', icon: Cloud, component: SyncPanel },
  { id: 'ui', label: '界面偏好', icon: Palette, component: UIPanel },
  { id: 'editor', label: '编辑器行为', icon: Edit, component: EditorPanel }
]

const workspaceCategories: SettingsCategoryItem[] = [
  { id: 'info', label: '工作区信息', icon: Info, component: WorkspaceInfoPanel },
  { id: 'seat', label: '座位表配置', icon: Grid, component: SeatConfigPanel },
  { id: 'rotation', label: '自动轮换', icon: RotateCw, component: RotationPanel },
  { id: 'assignment', label: '智能排位', icon: Wand2, component: AssignmentPanel },
  { id: 'export', label: '导出配置', icon: FileDown, component: ExportPanel }
]

const aboutCategories: SettingsCategoryItem[] = [
  { id: 'about', label: '关于', icon: Info, component: AboutPanel },
  { id: 'help', label: '帮助', icon: BookOpen, component: HelpPanel }
]

const currentCategories = computed(() => {
  if (activeTab.value === 'workspace') return workspaceCategories
  if (activeTab.value === 'about') return aboutCategories
  return globalCategories
})

const currentCategoryLabel = computed(() => currentCategories.value.find(c => c.id === activeCategory.value)?.label || '')
const currentComponent = computed(() => currentCategories.value.find(c => c.id === activeCategory.value)?.component || null)
const menuOptions = computed<MenuOption[]>(() => currentCategories.value.map(category => ({
  key: category.id,
  label: category.label,
  icon: () => h(NIcon, null, { default: () => h(category.icon, { size: 17 }) })
})))

const currentSettings = computed(() => {
  if (activeTab.value !== 'global') return {}
  if (activeCategory.value === 'sync') return settings.value.sync
  if (activeCategory.value === 'ui') return settings.value.ui
  if (activeCategory.value === 'editor') return settings.value.editor
  return {}
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

watch([activeTab, activeCategory], ([tab, category]) => {
  if (route.query.tab === tab && route.query.category === category) return
  void router.replace({ query: { ...route.query, tab, category } })
})

watch(() => route.query, (query) => {
  const requestedTab = typeof query.tab === 'string' && validTabs.has(query.tab as SettingsTab)
    ? query.tab as SettingsTab
    : activeTab.value
  activeTab.value = requestedTab
  const categories = requestedTab === 'workspace'
    ? workspaceCategories
    : requestedTab === 'about'
      ? aboutCategories
      : globalCategories
  if (typeof query.category === 'string' && categories.some(category => category.id === query.category)) {
    activeCategory.value = query.category
  } else if (!categories.some(category => category.id === activeCategory.value)) {
    activeCategory.value = categories[0].id
  }
}, { immediate: true })

const handleReset = () => {
  if (activeTab.value !== 'global') return
  if (!['sync', 'ui', 'editor'].includes(activeCategory.value)) return
  resetCategory(activeCategory.value as SettingsCategory)
  applyColorScheme()
  applyThemeColor()
  success('当前设置分类已恢复默认值')
}

onBeforeUnmount(flushPendingSave)
</script>

<style scoped>
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
  padding: 10px 12px;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
}

.settings-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.settings-nav {
  padding: 10px;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
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
  .settings-tabs {
    padding: 8px 10px;
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

  .settings-content {
    padding: 14px 12px calc(18px + env(safe-area-inset-bottom, 0px));
  }

  .settings-content h2 {
    margin-bottom: 12px;
    font-size: 18px;
  }
}
</style>
