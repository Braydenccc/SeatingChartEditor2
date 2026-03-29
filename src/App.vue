<!-- 配色：#23587b -->

<script setup>
import AppHeader from './components/layout/AppHeader.vue'
import EditorPanel from './components/layout/EditorPanel.vue'
import SidebarPanel from './components/layout/SidebarPanel.vue'
import { ref, onMounted, defineAsyncComponent } from 'vue'

const LoginDialog = defineAsyncComponent(() => import('./components/auth/LoginDialog.vue'))
import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'

const { isLoginDialogVisible, initAuth, isLoggedIn } = useAuth()
const { loadWorkspaceFromCloud } = useCloudWorkspace()
const { applyWorkspaceData, getLastWorkspace } = useWorkspace()
const { success, warning } = useLogger()

const loginDialogInitialTab = ref('login')
const handleOpenLogin = (tab = 'login') => {
  loginDialogInitialTab.value = tab
  isLoginDialogVisible.value = true
}

// Restore auth state from cookies on app startup
initAuth()

onMounted(async () => {
  const lastWs = getLastWorkspace()
  if (lastWs && lastWs.type === 'cloud' && lastWs.fileId) {
    // 延迟一丢丢等待 auth 彻底就绪（防止 race condition）
    setTimeout(async () => {
      if (isLoggedIn.value) {
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
        }
      } else {
        warning(`未登录，无法自动恢复上次云端任务：${lastWs.name}`)
      }
    }, 500)
  } else if (lastWs && lastWs.type === 'local') {
    success(`欢迎回来！上次任务：${lastWs.name} (本地文件需手动再次加载)`)
  }
})
</script>

<template>
  <AppHeader @open-login="handleOpenLogin" />
  <main class="main-content">
    <EditorPanel />
    <SidebarPanel />
  </main>
  
  <LoginDialog v-model:visible="isLoginDialogVisible" :initial-tab="loginDialogInitialTab" />
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

/* 响应式布局 - 平板 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
    min-height: calc(100vh - 90px);
    max-height: none;
    overflow-y: auto;
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
