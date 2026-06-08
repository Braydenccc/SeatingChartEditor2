<script setup>
import { defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import LoadingSpinner from './components/ui/LoadingSpinner.vue'
import GlobalDropZone from './components/ui/GlobalDropZone.vue'

const LoginDialog = defineAsyncComponent({
  loader: () => import('./components/auth/LoginDialog.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200
})
const CloudWorkspaceDialog = defineAsyncComponent(() => import('./components/workspace/CloudWorkspaceDialog.vue'))

import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useUndo } from '@/composables/useUndo'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useAutoSave } from '@/composables/useAutoSave'
import { useRouteLoading } from '@/composables/useRouteLoading'
import { initializeTags } from '@/composables/useTagData'

const { isLoginDialogVisible, initAuth, isLoggedIn } = useAuth()
const { loadWorkspaceFromCloud } = useCloudWorkspace()
const { applyWorkspaceData, getLastWorkspace } = useWorkspace()
const { success, warning } = useLogger()
const { undo, redo, canUndo, canRedo, setMaxHistory } = useUndo()
const { showCloudDialog, cloudDialogMode, handleCloudSuccess } = useCloudWorkspaceDialog()
const { settings, applyThemeColor, applyColorScheme } = useGlobalSettings()
const { startAutoSave } = useAutoSave()
const { isRouteLoading } = useRouteLoading()

const loginDialogInitialTab = ref('login')
const handleOpenLogin = (tab = 'login') => {
  loginDialogInitialTab.value = tab
  isLoginDialogVisible.value = true
}

onMounted(async () => {
  await initAuth()

  initializeTags()
  applyColorScheme()
  applyThemeColor()

  if (settings.value.editor.undoHistorySize) {
    setMaxHistory(settings.value.editor.undoHistorySize)
  }

  if (settings.value.ui.enableAnimations !== undefined) {
    document.documentElement.classList.toggle('disable-animations', !settings.value.ui.enableAnimations)
  }

  startAutoSave()

  const lastWs = getLastWorkspace()

  const handleKeyDown = (e) => {
    const isCtrl = e.ctrlKey || e.metaKey

    if (isCtrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (canUndo.value) undo()
    }

    if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      if (canRedo.value) redo()
    }
  }

  document.addEventListener('keydown', handleKeyDown)

  if (lastWs && lastWs.type === 'cloud' && lastWs.fileId) {
    const unwatch = watch(() => isLoggedIn.value, async (loggedIn) => {
      if (loggedIn) {
        try {
          const result = await loadWorkspaceFromCloud(lastWs.fileId, lastWs.source)
          if (result.success && result.data && result.data.content) {
            const workspaceData = typeof result.data.content === 'string'
              ? JSON.parse(result.data.content)
              : result.data.content

            await applyWorkspaceData(workspaceData)
            success(`已自动恢复上次任务：${lastWs.name}`)
          }
        } catch (e) {
          console.error('Auto restore failed:', e)
          warning(`自动恢复云端任务失败：${e.message || '网络错误，请检查连接后手动重试'}`)
        } finally {
          unwatch()
        }
      }
    }, { immediate: true })

    setTimeout(() => {
      if (!isLoggedIn.value) {
        warning(`未登录，无法自动恢复上次云端任务：${lastWs.name}`)
        unwatch()
      }
    }, 2000)
  } else if (lastWs && lastWs.type === 'local') {
    success(`欢迎回来！上次任务：${lastWs.name} (本地文件需手动再次加载)`)
  }

  const prefetchAsyncComponents = () => {
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000))
    idleCallback(() => {
      import('./components/auth/LoginDialog.vue')
      import('./components/relation/SeatRuleEditor.vue')
      import('./components/layout/ExportPreview.vue')
      import('./components/workspace/CloudWorkspaceDialog.vue')
      import('./components/student/StudentRosterDialog.vue')
      import('xlsx-js-style')
    })
  }

  prefetchAsyncComponents()
})
</script>

<template>
  <div class="app-root">
    <RouterView @open-login="handleOpenLogin" />

    <LoadingSpinner v-if="isRouteLoading" text="正在切换页面..." />

    <GlobalDropZone />

    <LoginDialog
      v-if="isLoginDialogVisible"
      v-model:visible="isLoginDialogVisible"
      :initial-tab="loginDialogInitialTab"
    />

    <CloudWorkspaceDialog
      v-if="showCloudDialog"
      :visible="showCloudDialog"
      :mode="cloudDialogMode"
      @update:visible="showCloudDialog = $event"
      @success="handleCloudSuccess"
    />
  </div>
</template>

<style scoped>
.app-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
