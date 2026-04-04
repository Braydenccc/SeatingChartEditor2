<template>
  <header class="app-header">
    <div class="header-left">
      <div v-if="isLoggedIn" class="user-menu-container" ref="menuContainer">
        <div class="user-info" @click="toggleDropdown">
          <span class="user-avatar" :title="authType === 'webdav' ? 'WebDAV 模式' : '普通账号'">{{ authType === 'webdav' ? '☁️' : '👤' }}</span>
          <span class="welcome-text">{{ currentUser?.username }}</span>
          <span class="dropdown-icon">▼</span>
        </div>
        <Transition name="fade-slide">
          <div v-if="showDropdown" class="user-dropdown">
            <!-- Sync Service Settings entry -->
            <button v-if="hasRetiehe" class="dropdown-item" @click="openSyncSettings">
              <span class="item-icon">⚙️</span> 同步设置
            </button>
            <div class="dropdown-divider" v-if="hasRetiehe"></div>
            
            <button class="dropdown-item" @click="openWorkspaceManagement">
              <span class="item-icon">☁️</span> 工作区管理
            </button>

            <button v-if="!hasRetiehe" class="dropdown-item" @click="emit('open-login', 'login'); showDropdown = false">
              <span class="item-icon">➕</span> 登录 SCE 账号
            </button>
            
            <div class="dropdown-divider"></div>
            
            <button class="dropdown-item text-danger" @click="handleLogout('all')">
              {{ hasRetiehe ? '退出 SCE 账号' : '退出 WebDAV' }}
            </button>
          </div>
        </Transition>
      </div>
      <button v-else class="auth-btn login-btn" @click="emit('open-login')">
        <span class="btn-icon">☁️</span>登录
      </button>

      <h1 class="header-text">BraydenSCE V2</h1>
    </div>
    <div class="header-right">
      <p class="header-subtitle">座位表编辑器 开发版本 <a href="https://afdian.com/a/brayden" target="_blank">byccc</a> 由<a href="https://host.retiehe.com/" target="_blank">热铁盒网页托管</a>提供服务</p>
      <a href="https://github.com/Braydenccc/SeatingCrartEditor2" target="_blank" class="github-link" title="Source Code">
        <svg height="28" viewBox="0 0 16 16" version="1.1" width="28" fill="currentColor">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
        </svg>
      </a>
    </div>
    
    <CloudWorkspaceDialog 
      :visible="showWorkspaceManagement" 
      mode="load" 
      @update:visible="showWorkspaceManagement = $event" 
    />
    <SyncSettingsDialog 
      :visible="showSyncSettings" 
      @update:visible="showSyncSettings = $event" 
    />
  </header>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed, defineAsyncComponent } from 'vue'
import { useAuth } from '@/composables/useAuth'

const CloudWorkspaceDialog = defineAsyncComponent(() => import('../workspace/CloudWorkspaceDialog.vue'))
const SyncSettingsDialog = defineAsyncComponent(() => import('../auth/SyncSettingsDialog.vue'))

const emit = defineEmits(['open-login'])

const { currentUser, webdavConfig, isLoggedIn, logout, authType, initAuth } = useAuth()

const showDropdown = ref(false)
const showWorkspaceManagement = ref(false)
const showSyncSettings = ref(false)
const menuContainer = ref(null)

const hasRetiehe = computed(() => !!currentUser.value)
const hasWebdav = computed(() => !!webdavConfig.value)

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const openWorkspaceManagement = () => {
  showWorkspaceManagement.value = true
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
  background: #23587b;
  height: 100px;
  color: aliceblue;
  padding: 0 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
  color: #333;
  cursor: pointer;
  transition: background 0.2s;
  gap: 8px;
}

.dropdown-item:hover {
  background: #f5f5f5;
}

.dropdown-item.text-danger {
  color: #e53935;
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
  font-size: 14px;
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

.btn-icon {
  font-size: 14px;
}

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
  color: #f0f0f0;
  text-decoration: underline;
}

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0f0f0;
  transition: opacity 0.2s, transform 0.2s;
}

.github-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

@media (max-width: 1366px) and (min-width: 1025px), (max-height: 820px) and (min-width: 1025px) {
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
    z-index: 10;
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
