<!-- 配色：#23587b -->

<script setup>
import AppHeader from './components/layout/AppHeader.vue'
import EditorPanel from './components/layout/EditorPanel.vue'
import SidebarPanel from './components/layout/SidebarPanel.vue'
import LoginDialog from './components/auth/LoginDialog.vue'
import { useAuth } from '@/composables/useAuth'

const { isLoginDialogVisible } = useAuth()
</script>

<template>
  <AppHeader @open-login="isLoginDialogVisible = true" />
  <main class="main-content">
    <EditorPanel />
    <SidebarPanel />
  </main>
  
  <LoginDialog v-model:visible="isLoginDialogVisible" />
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
