<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="header-text">BraydenSCE V2</h1>

      <!-- 用户菜单 -->
      <div v-if="isLoggedIn" class="user-menu-container" ref="menuContainer">
        <button class="header-btn user-btn" @click="toggleDropdown">
          <Cloud v-if="authType === 'webdav'" :size="18" stroke-width="2" />
          <User v-else :size="18" stroke-width="2" />
          <span class="btn-text">{{ currentUser?.username }}</span>
          <span class="dropdown-icon">▼</span>
        </button>

        <Transition name="fade-slide">
          <div v-if="showDropdown" class="user-dropdown">
            <button class="dropdown-item" @click="openWorkspaceManagement">
              <FolderOpen :size="16" stroke-width="2" />
              <span>工作区管理</span>
            </button>

            <button v-if="!hasRetiehe" class="dropdown-item" @click="emit('open-login', 'login'); showDropdown = false">
              <LogIn :size="16" stroke-width="2" />
              <span>登录 SCE 账号</span>
            </button>

            <div class="dropdown-divider"></div>

            <button class="dropdown-item danger" @click="handleLogout('all')">
              <span>{{ hasRetiehe ? '退出 SCE 账号' : '退出 WebDAV' }}</span>
            </button>
          </div>
        </Transition>
      </div>

      <!-- 登录按钮 -->
      <button v-else class="header-btn login-btn" @click="emit('open-login')">
        <Cloud :size="18" stroke-width="2" />
        <span class="btn-text">登录</span>
      </button>

      <!-- 设置按钮 -->
      <button class="header-btn" @click="openUnifiedSettings" title="统一设置">
        <Settings :size="18" stroke-width="2" />
        <span class="btn-text">设置</span>
      </button>

      <!-- 主题切换 -->
      <div class="theme-switcher">
        <button
          v-for="mode in themeModes"
          :key="mode.value"
          class="theme-btn"
          :class="{ active: currentColorScheme === mode.value }"
          @click="switchTheme(mode.value)"
          :title="mode.label"
        >
          <component :is="mode.icon" :size="16" stroke-width="2" />
          <Transition name="theme-label">
            <span v-if="currentColorScheme === mode.value" class="theme-label">{{ mode.label }}</span>
          </Transition>
        </button>
      </div>
    </div>

    <div class="header-right"></div>

    <UnifiedSettingsDialog
      v-if="showUnifiedSettings"
      @save="handleSaveSettings"
    />
  </header>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed, defineAsyncComponent } from 'vue'
import { Cloud, FolderOpen, Github, LogIn, Monitor, Moon, Settings, Sun, User } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const UnifiedSettingsDialog = defineAsyncComponent(() => import('../settings/UnifiedSettingsDialog.vue'))

const emit = defineEmits(['open-login'])

const { currentUser, webdavConfig, isLoggedIn, logout, authType, initAuth } = useAuth()
const { openCloudDialog } = useCloudWorkspaceDialog()
const { settings, saveToLocalStorage, applyColorScheme, applyThemeColor } = useGlobalSettings()
const { visible: showUnifiedSettings, openSettings, closeSettings } = useSettingsDialog()

const showDropdown = ref(false)
const menuContainer = ref(null)

const hasRetiehe = computed(() => !!currentUser.value)
const hasWebdav = computed(() => !!webdavConfig.value)

// 主题切换
const themeModes = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'auto', label: '自适应', icon: Monitor }
]

const currentColorScheme = computed(() => settings.value.ui.colorScheme)

const switchTheme = (mode) => {
  settings.value.ui.colorScheme = mode
  applyColorScheme()
  applyThemeColor()
  saveToLocalStorage()
}

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const openWorkspaceManagement = () => {
  openCloudDialog('load')
  showDropdown.value = false
}

const openUnifiedSettings = () => {
  openSettings()
  showDropdown.value = false
}

const handleSaveSettings = () => {
  saveToLocalStorage()
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
  closeSettings()
})
</script>

<style scoped>
/* ===== 基础布局 ===== */
.app-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-primary);
  height: 100px;
  color: var(--color-text-inverse);
  padding: 0 30px;
  box-shadow: var(--shadow-md);
  gap: 20px;
}

.header-left {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.header-right {
  flex-shrink: 0;
}

.header-text {
  margin: 0;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 1px;
  flex-shrink: 0;
}

/* ===== 统一按钮样式 ===== */
.header-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--color-text-inverse);
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  white-space: nowrap;
  flex-shrink: 0;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.header-btn:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.15);
}

.btn-text {
  font-size: 14px;
  font-weight: 500;
}

/* 登录按钮特殊样式 */
.login-btn {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
}

/* ===== 用户菜单 ===== */
.user-menu-container {
  position: relative;
}

.user-btn .dropdown-icon {
  font-size: 10px;
  margin-left: 2px;
  transition: transform 0.25s;
}

.user-btn:hover .dropdown-icon {
  transform: translateY(2px);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  z-index: 100;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--color-bg-subtle);
}

.dropdown-item.danger {
  color: var(--color-danger);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ===== 主题切换器 ===== */
.theme-switcher {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 4px;
  gap: 2px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}

.theme-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
}

.theme-btn.active {
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-text-inverse);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.theme-label {
  display: inline-block;
  overflow: hidden;
}

.theme-label-enter-active,
.theme-label-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-label-enter-from,
.theme-label-leave-to {
  opacity: 0;
  max-width: 0;
}

.theme-label-enter-to,
.theme-label-leave-from {
  opacity: 1;
  max-width: 60px;
}

/* ===== 响应式 - 中等屏幕 ===== */
@media (max-width: 1366px) and (min-width: 1025px) {
  .app-header {
    padding: 0 20px;
  }

  .header-left {
    gap: 12px;
  }

  .header-text {
    font-size: 26px;
  }

  .header-btn {
    padding: 6px 14px;
    font-size: 13px;
  }
}

/* ===== 响应式 - 小高度屏幕 ===== */
@media (max-height: 820px) and (min-width: 1025px) {
  .app-header {
    padding: 0 18px;
  }

  .header-left {
    gap: 10px;
  }

  .header-text {
    font-size: 24px;
  }

  .header-btn {
    padding: 6px 12px;
  }
}

/* ===== 响应式 - 平板 ===== */
@media (max-width: 1024px) {
  .app-header {
    padding: 0 20px;
    height: 90px;
  }

  .header-text {
    font-size: 28px;
  }
}

/* ===== 响应式 - 移动设备 ===== */
@media (max-width: 768px) {
  .app-header {
    height: 52px;
    padding: 0;
    gap: 0;
    display: flex;
    align-items: center;
  }

  /* 左侧按钮区 */
  .header-left {
    height: 100%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0;
  }

  .header-left .header-text {
    display: none;
  }

  /* 右侧标题区 - 移动端保留 */
  .header-right {
    flex: 1;
    max-width: none;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 12px;
    min-width: 0;
  }

  .header-right::before {
    content: 'BraydenSCE V2';
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  /* 按钮方块样式 */
  .user-menu-container,
  .login-btn,
  .header-btn {
    height: 100%;
    flex-shrink: 0;
  }

  .header-btn {
    height: 100%;
    border-radius: 0;
    background: transparent;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0 14px;
    box-shadow: none;
  }

  .header-btn:hover {
    transform: none;
    background: rgba(255, 255, 255, 0.1);
  }

  .header-btn:active {
    transform: none;
  }

  .btn-text {
    font-size: 13px;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-btn .dropdown-icon {
    display: none;
  }

  .user-dropdown {
    top: 100%;
    left: 0;
    border-radius: 0 0 12px 12px;
    z-index: 1000;
  }

  .theme-switcher {
    display: none;
  }
}
</style>
