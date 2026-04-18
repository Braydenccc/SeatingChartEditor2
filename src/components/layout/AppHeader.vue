<template>
  <header class="app-header">
    <div class="header-left">
        <div v-if="isLoggedIn" class="user-menu-container" ref="menuContainer">
          <div class="user-info" @click="toggleDropdown">
          <Cloud v-if="authType === 'webdav'" :size="18" stroke-width="1.8" :title="'WebDAV 模式'" />
          <User v-else :size="18" stroke-width="1.8" :title="'普通账号'" />
          <span class="welcome-text">{{ currentUser?.username }}</span>
          <span class="dropdown-icon">▼</span>
        </div>
        <Transition name="fade-slide">
          <div v-if="showDropdown" class="user-dropdown">
            <!-- Sync Service Settings entry -->
            <button v-if="hasRetiehe" class="dropdown-item" @click="openSyncSettings">
              <RefreshCw :size="15" stroke-width="2" /> 同步设置
            </button>
            <div class="dropdown-divider" v-if="hasRetiehe"></div>
            
            <button class="dropdown-item" @click="openWorkspaceManagement">
              <FolderOpen :size="15" stroke-width="2" /> 工作区管理
            </button>

            <button v-if="!hasRetiehe" class="dropdown-item" @click="emit('open-login', 'login'); showDropdown = false">
              <LogIn :size="15" stroke-width="2" /> 登录 SCE 账号
            </button>
            
            <div class="dropdown-divider"></div>
            
            <button class="dropdown-item text-danger" @click="handleLogout('all')">
              {{ hasRetiehe ? '退出 SCE 账号' : '退出 WebDAV' }}
            </button>
          </div>
        </Transition>
      </div>
      <button v-else class="auth-btn login-btn" @click="emit('open-login')">
        <Cloud :size="15" stroke-width="2" />登录
      </button>

      <h1 class="header-text">BraydenSCE V2</h1>
    </div>
    <div class="header-right">
      <p class="header-subtitle">座位表编辑器 开发版本 <a href="https://afdian.com/a/brayden" target="_blank">byccc</a> 由<a href="https://host.retiehe.com/" target="_blank">热铁盒网页托管</a>提供服务</p>
      <a href="https://github.com/Braydenccc/SeatingCrartEditor2" target="_blank" class="github-link" title="Source Code">
        <Github :size="26" stroke-width="1.8" />
      </a>
    </div>

    <SyncSettingsDialog 
      v-if="showSyncSettings"
      :visible="showSyncSettings" 
      @update:visible="showSyncSettings = $event" 
    />
  </header>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed, defineAsyncComponent } from 'vue'
import { Cloud, FolderOpen, Github, LogIn, RefreshCw, User } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'

const SyncSettingsDialog = defineAsyncComponent(() => import('../auth/SyncSettingsDialog.vue'))

const emit = defineEmits(['open-login'])

const { currentUser, webdavConfig, isLoggedIn, logout, authType, initAuth } = useAuth()
const { openCloudDialog } = useCloudWorkspaceDialog()

const showDropdown = ref(false)
const showSyncSettings = ref(false)
const menuContainer = ref(null)

const hasRetiehe = computed(() => !!currentUser.value)
const hasWebdav = computed(() => !!webdavConfig.value)

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const openWorkspaceManagement = () => {
  openCloudDialog('load')
  showDropdown.value = false
}

const openSyncSettings = () => {
  showSyncSettings.value = true
  showDropdown.value = false
}

const handleLogout = (target) => {
  logout(target)
  showDropdown.value = false
}

const closeDropdownOnOutsideClick = (e) => {
  if (menuContainer.value && !menuContainer.value.contains(e.target)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  initAuth()
  document.addEventListener('click', closeDropdownOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdownOnOutsideClick)
})
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-primary);
  height: 100px;
  color: var(--color-surface);
  padding: 0 30px;
  box-shadow: var(--shadow-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.user-menu-container {
  position: relative;
}

.dropdown-icon {
  font-size: 10px;
  margin-left: 4px;
  transition: transform 0.3s;
}

.user-info:hover .dropdown-icon {
  transform: translateY(2px);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.2s;
  gap: 8px;
}

/* .item-icon: size controlled by :size prop */

.dropdown-item:hover {
  background: var(--color-bg-subtle);
}

.dropdown-item.text-danger {
  color: var(--color-danger);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.dropdown-group {
  padding: 12px 16px;
  background: #f8fafc;
}

.group-title {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  font-weight: 600;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;
  margin-bottom: 6px;
  cursor: pointer;
}

.radio-label:last-child {
  margin-bottom: 0;
}

.disabled-text {
  color: #94a3b8;
}

.dropdown-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 4px 0;
}

.header-text {
  margin: 0;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 1px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  padding: 8px 16px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.25);
}

.user-avatar {
  flex-shrink: 0;
}

.welcome-text {
  font-size: 14px;
  font-weight: 500;
}

.auth-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
}

.login-btn {
  background: rgba(255, 255, 255, 0.2);
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.login-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* .btn-icon: size controlled by :size prop */

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-subtitle {
  margin: 0;
  font-size: 20px;
  opacity: 0.9;
  font-weight: 300;
}

.header-subtitle a {
  color: var(--color-surface);
  text-decoration: underline;
}

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-surface);
  transition: opacity 0.2s, transform 0.2s;
}

/* .github-icon: size controlled by :size prop */

.github-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .app-header {
    padding: 0 18px;
  }

  .header-left {
    gap: 14px;
  }

  .header-text {
    font-size: 24px;
  }

  .header-subtitle {
    font-size: 15px;
  }

  .user-info {
    padding: 6px 12px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .app-header {
    padding: 0 16px;
  }

  .header-left {
    gap: 12px;
  }

  .header-text {
    font-size: 22px;
  }

  .header-subtitle {
    font-size: 14px;
  }

  .user-info {
    padding: 5px 10px;
  }
}

/* 响应式设计 - 平板 */
@media (max-width: 1024px) {
  .app-header {
    padding: 0 20px;
    height: 90px;
  }

  .header-text {
    font-size: 28px;
  }

  .header-subtitle {
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .app-header {
    flex-direction: row;
    position: relative;
    justify-content: center; /* Center the h1 */
    align-items: center;
    gap: 0;
    height: 48px;
    padding: 0 16px 0 0; /* remove left padding so the button can touch the edge */
  }

  .header-left {
    position: static; /* Let absolute children position to app-header */
  }

  .header-text {
    font-size: 18px;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .user-menu-container, .login-btn {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%; /* Fuse with header bar */
    z-index: 100;
  }

  .user-info {
    position: static;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin: 0;
    transform: none; /* remove translateY */
    border-radius: 0; /* drop rounded corners */
    background: #1c4b6b; /* Solid color to fuse with title bar, replacing transparency */
    backdrop-filter: none;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.1); 
    padding: 0 16px;
  }

  .login-btn {
    border-radius: 0;
    margin: 0;
    transform: none;
    background: #1c4b6b;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-info:hover, .login-btn:hover {
    transform: none; 
    background: #18415c;
  }

  .user-dropdown {
    top: 100%; /* attach directly below header */
    left: 0;
    border-radius: 0 0 12px 12px;
    z-index: 1000;
  }

  .user-avatar {
    display: none;
  }
  
  .welcome-text {
    font-size: 13px;
    max-width: 60px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .auth-btn {
    padding: 0 16px;
    font-size: 13px;
  }
  
  .btn-icon {
    display: none;
  }

  .header-right {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
  }

  .header-subtitle {
    display: none;
  }
}
</style>
