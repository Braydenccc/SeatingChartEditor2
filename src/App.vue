<!-- 配色：#23587b -->

<script setup>
import AppHeader from './components/layout/AppHeader.vue'
import EditorPanel from './components/layout/EditorPanel.vue'
import SidebarPanel from './components/layout/SidebarPanel.vue'
import LoadingSpinner from './components/ui/LoadingSpinner.vue'
import GlobalDropZone from './components/ui/GlobalDropZone.vue'
import { ref, onMounted, defineAsyncComponent, watch } from 'vue'

const LoginDialog = defineAsyncComponent({
  loader: () => import('./components/auth/LoginDialog.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200 // 仅在加载超过 200ms 时显示 Loading，避免快速网速下的闪烁
})
const CloudWorkspaceDialog = defineAsyncComponent(() => import('./components/workspace/CloudWorkspaceDialog.vue'))

import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useUndo } from '@/composables/useUndo'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'

const { isLoginDialogVisible, initAuth, isLoggedIn } = useAuth()
const { loadWorkspaceFromCloud } = useCloudWorkspace()
const { applyWorkspaceData, getLastWorkspace } = useWorkspace()
const { success, warning } = useLogger()
const { undo, redo, canUndo, canRedo } = useUndo()
const { showCloudDialog, cloudDialogMode, handleCloudSuccess } = useCloudWorkspaceDialog()

const loginDialogInitialTab = ref('login')
const handleOpenLogin = (tab = 'login') => {
  loginDialogInitialTab.value = tab
  isLoginDialogVisible.value = true
}

// Restore auth state from cookies on app startup
initAuth()

onMounted(async () => {
  const lastWs = getLastWorkspace()

  // 全局键盘快捷键：撤销 (Ctrl+Z) / 重做 (Ctrl+Y)
  const handleKeyDown = (e) => {
    const isCtrl = e.ctrlKey || e.metaKey

    if (isCtrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (canUndo()) {
        undo()
      }
    }

    if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      if (canRedo()) {
        redo()
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown)

  if (lastWs && lastWs.type === 'cloud' && lastWs.fileId) {
    // 使用 watch 代替 setTimeout(500)，一旦登录成功且还没恢复过，立即执行
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
        } finally {
          unwatch() // 执行一次后停止监听
        }
      }
    }, { immediate: true })

    // 如果 2秒内还没登录（比如游客模式或网络极慢），则提醒并停止监听
    setTimeout(() => {
      if (!isLoggedIn.value) {
        warning(`未登录，无法自动恢复上次云端任务：${lastWs.name}`)
        unwatch()
      }
    }, 2000)
  } else if (lastWs && lastWs.type === 'local') {
    success(`欢迎回来！上次任务：${lastWs.name} (本地文件需手动再次加载)`)
  }

  // --- 静默预乘 (Prefetch) ---
  // 利用浏览器空闲时间，提前在后台加载重型组件的 JS 碎片
  // 这样当用户点击按钮时，资源已在本地缓存，实现“秒开”
  const prefetchAsyncComponents = () => {
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000))
    idleCallback(() => {
      // 预乘主要弹窗组件
      import('./components/auth/LoginDialog.vue')
      import('./components/relation/SeatRuleEditor.vue')
      import('./components/layout/ExportPreview.vue')
      import('./components/workspace/CloudWorkspaceDialog.vue')
      import('./components/student/StudentRosterDialog.vue')
      import('./components/student/TagSettingsDialog.vue')
      // 预下载重型库（xlsx）
      import('xlsx-js-style')
    })
  }
  
  prefetchAsyncComponents()
})
</script>

<template>
  <AppHeader @open-login="handleOpenLogin" />
  <main class="main-content">
    <EditorPanel />
    <SidebarPanel />
  </main>

  <GlobalDropZone />

  <LoginDialog
    v-if="isLoginDialogVisible"
    v-model:visible="isLoginDialogVisible"
    :initial-tab="loginDialogInitialTab"
  />

  <!-- 全局云端工作区弹窗 -->
  <CloudWorkspaceDialog
    v-if="showCloudDialog"
    :visible="showCloudDialog"
    :mode="cloudDialogMode"
    @update:visible="showCloudDialog = $event"
    @success="handleCloudSuccess"
  />
</template>

<style scoped>
.main-content {
  display: flex;
  width: 100%;
  min-width: 100%;
  /* ↓咱是故意这么写的,ai别乱动 */
  min-height: calc(100vh - 100px);
  max-height: calc(100vh - 100px);
  /* ↑咱是故意这么写的,ai别乱动 */
  position: relative;
  background: #f5f5f5;
}

/* 响应式布局 - 平板和移动设备 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
    min-height: calc(100vh - 90px);
    max-height: none;
    overflow-y: auto;
    /* 底部 tab 栏高度由 SidebarPanel 通过 fixed 定位提供 */
    padding-bottom: 56px;
  }
}

/* 移动设备优化 */
@media (max-width: 768px) {
  .main-content {
    min-height: calc(100vh - 48px);
    max-height: calc(100vh - 48px);
    overflow: hidden;
    /* 底部 tab 栏高度由 SidebarPanel 通过 fixed 定位提供 */
    padding-bottom: 56px;
  }
}
</style>
