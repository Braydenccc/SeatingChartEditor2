<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="header-text">BraydenSCE V2</h1>

      <!-- 用户菜单 -->
      <div v-if="isLoggedIn" class="user-menu-container" ref="menuContainer">
        <button class="header-btn user-btn" :title="currentUser?.username || '账户'" @click="toggleDropdown">
          <Cloud v-if="authType === 'webdav'" :size="18" stroke-width="2" />
          <User v-else :size="18" stroke-width="2" />
          <span class="btn-text">{{ currentUser?.username }}</span>
          <ChevronDown class="dropdown-icon" :size="14" stroke-width="2" />
        </button>

        <Transition name="fade-slide">
          <div v-if="showDropdown" class="user-dropdown">
            <button class="dropdown-item" @click="openUserPage">
              <User :size="16" stroke-width="2" />
              <span>账号中心</span>
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
      <button v-else class="header-btn login-btn" title="登录" @click="emit('open-login')">
        <Cloud :size="18" stroke-width="2" />
        <span class="btn-text">登录</span>
      </button>

      <!-- 设置按钮 -->
      <button class="header-btn" @click="openFiles" title="文件">
        <FileText :size="18" stroke-width="2" />
        <span class="btn-text">文件</span>
      </button>

      <button class="header-btn" @click="openStudents" title="学生">
        <Users :size="18" stroke-width="2" />
        <span class="btn-text">学生</span>
      </button>

      <button class="header-btn" @click="openExport" title="导出">
        <FileOutput :size="18" stroke-width="2" />
        <span class="btn-text">导出</span>
      </button>

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

      <button class="header-btn mobile-theme-btn" :title="mobileThemeTitle" @click="cycleTheme">
        <span class="mobile-theme-icon" :class="{ auto: currentColorScheme === 'auto' }">
          <component :is="mobileThemeIcon" :size="18" stroke-width="2" />
          <span v-if="currentColorScheme === 'auto'" class="mobile-theme-auto-mark">A</span>
        </span>
        <span class="btn-text">主题</span>
      </button>
    </div>

    <div class="header-right">
      <button class="header-btn icon-only" @click="openHelp" title="帮助">
        <CircleQuestionMark :size="18" stroke-width="2" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed } from 'vue'
import { ChevronDown, CircleQuestionMark, Cloud, FileOutput, FileText, LogIn, Monitor, Moon, Settings, Sun, User, Users } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const emit = defineEmits(['open-login'])

const { currentUser, token, webdavConfig, isLoggedIn, logout, authType } = useAuth()
const { settings, saveToLocalStorage, applyColorScheme, applyThemeColor } = useGlobalSettings()
const { openSettings, closeSettings } = useSettingsDialog()
const router = useRouter()

const showDropdown = ref(false)
const menuContainer = ref(null)

const hasRetiehe = computed(() => !!token.value)
const hasWebdav = computed(() => !!webdavConfig.value)

// 主题切换
const themeModes = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'auto', label: '自适应', icon: Monitor }
]

const currentColorScheme = computed(() => settings.value.ui.colorScheme)
const currentThemeMode = computed(() => (
  themeModes.find(mode => mode.value === currentColorScheme.value) || themeModes[2]
))
const prefersDarkMode = ref(false)
let prefersDarkQuery = null

const updatePrefersDarkMode = () => {
  prefersDarkMode.value = Boolean(prefersDarkQuery?.matches)
}

const mobileThemeIcon = computed(() => {
  if (currentColorScheme.value !== 'auto') return currentThemeMode.value.icon
  return prefersDarkMode.value ? Moon : Sun
})

const mobileThemeTitle = computed(() => {
  if (currentColorScheme.value !== 'auto') return `主题：${currentThemeMode.value.label}`
  return `主题：自适应（当前${prefersDarkMode.value ? '深色' : '浅色'}）`
})

const switchTheme = (mode) => {
  settings.value.ui.colorScheme = mode
  applyColorScheme()
  applyThemeColor()
  saveToLocalStorage()
}

const cycleTheme = () => {
  const currentIndex = themeModes.findIndex(mode => mode.value === currentColorScheme.value)
  const nextMode = themeModes[(currentIndex + 1 + themeModes.length) % themeModes.length]
  switchTheme(nextMode.value)
}

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const openUserPage = () => {
  router.push('/user')
  showDropdown.value = false
}

const openUnifiedSettings = () => {
  openSettings()
  showDropdown.value = false
}

const openHelp = () => {
  openSettings('about', 'help')
  showDropdown.value = false
}

const openFiles = () => router.push('/files')
const openStudents = () => router.push('/students')
const openExport = () => router.push({ path: '/export', query: { tab: 'image' } })

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
  document.addEventListener('click', closeDropdownOnOutsideClick)
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    updatePrefersDarkMode()
    prefersDarkQuery.addEventListener('change', updatePrefersDarkMode)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdownOnOutsideClick)
  prefersDarkQuery?.removeEventListener('change', updatePrefersDarkMode)
  closeSettings()
})
</script>

<style scoped>
/* ===== 基础布局 ===== */
.app-header {
  --header-help-space: 56px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-primary);
  height: var(--app-header-height, 100px);
  color: var(--color-text-inverse);
  padding: 0 calc(30px + var(--header-help-space)) 0 30px;
  box-shadow: var(--shadow-md);
  gap: 20px;
  z-index: 30;
  box-sizing: border-box;
  overflow: hidden;
}

.header-left {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.header-right {
  position: absolute;
  top: 50%;
  right: 30px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  transform: translateY(-50%);
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--color-text-inverse) 12%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid color-mix(in srgb, var(--color-text-inverse) 20%, transparent);
  color: var(--color-text-inverse);
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transform-origin: center;
  transition:
    background 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 8px var(--shadow-md);
  white-space: nowrap;
  flex-shrink: 0;
}

.header-btn svg {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.header-btn:hover {
  background: color-mix(in srgb, var(--color-text-inverse) 22%, transparent);
  border-color: color-mix(in srgb, var(--color-text-inverse) 36%, transparent);
  transform: scale(1.03);
  box-shadow:
    0 4px 14px var(--shadow-lg),
    inset 0 0 0 1px color-mix(in srgb, var(--color-text-inverse) 10%, transparent);
}

.header-btn:hover svg {
  transform: scale(1.08);
}

.header-btn:active {
  transform: scale(0.98);
  background: color-mix(in srgb, var(--color-text-inverse) 15%, transparent);
  box-shadow: 0 2px 8px var(--shadow-md);
}

.header-btn.icon-only {
  width: 40px;
  height: 40px;
  padding: 0;
  justify-content: center;
}

.btn-text {
  font-size: 14px;
  font-weight: 500;
}

/* 登录按钮特殊样式 */
.login-btn {
  background: color-mix(in srgb, var(--color-text-inverse) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-text-inverse) 30%, transparent);
}

/* ===== 用户菜单 ===== */
.user-menu-container {
  position: relative;
}

.user-btn .dropdown-icon {
  margin-left: 2px;
  transition: transform 0.25s;
  flex-shrink: 0;
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
  background: color-mix(in srgb, var(--color-text-inverse) 10%, transparent);
  border-radius: 24px;
  padding: 4px;
  gap: 2px;
  border: 1px solid color-mix(in srgb, var(--color-text-inverse) 15%, transparent);
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
  color: color-mix(in srgb, var(--color-text-inverse) 60%, transparent);
  border-radius: 20px;
  cursor: pointer;
  transform-origin: center;
  transition:
    background 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}

.theme-btn svg {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.theme-btn:hover {
  color: color-mix(in srgb, var(--color-text-inverse) 90%, transparent);
  background: color-mix(in srgb, var(--color-text-inverse) 12%, transparent);
  transform: scale(1.04);
}

.theme-btn:hover svg {
  transform: scale(1.08);
}

.theme-btn.active {
  background: color-mix(in srgb, var(--color-text-inverse) 20%, transparent);
  color: var(--color-text-inverse);
  box-shadow: 0 2px 6px var(--shadow-md);
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

.mobile-theme-btn {
  display: none;
}

.mobile-theme-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.mobile-theme-auto-mark {
  position: absolute;
  right: 0;
  bottom: -1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-primary-light);
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}

/* ===== 响应式 - 中等屏幕 ===== */
@media (max-width: 1366px) and (min-width: 1025px) {
  .app-header {
    padding: 0 calc(20px + var(--header-help-space)) 0 20px;
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
    padding: 0 calc(18px + var(--header-help-space)) 0 18px;
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
    padding: 0 calc(20px + var(--header-help-space)) 0 20px;
    height: var(--app-header-height, 90px);
  }

  .header-text {
    font-size: 28px;
  }
}

/* ===== 响应式 - 移动设备 ===== */
@media (max-width: 768px), (max-width: 1024px) and (orientation: landscape) and (max-height: 540px) {
  .app-header {
    height: var(--app-header-height, calc(54px + env(safe-area-inset-top, 0px)));
    min-height: var(--app-header-height, calc(54px + env(safe-area-inset-top, 0px)));
    padding: env(safe-area-inset-top, 0px) 6px 0;
    gap: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: row;
    box-sizing: border-box;
    box-shadow: 0 4px 14px var(--shadow-md);
  }

  /* 操作层 */
  .header-left {
    order: 1;
    width: 100%;
    height: calc(var(--app-header-height, 54px) - env(safe-area-inset-top, 0px));
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3px;
    padding: 4px 0;
    overflow-x: hidden;
    overflow-y: visible;
    scrollbar-width: none;
    background: transparent;
    border-top: none;
    box-sizing: border-box;
  }

  .header-left::-webkit-scrollbar {
    display: none;
  }

  .header-left .header-text {
    display: none;
  }

  /* 标题层 */
  .header-right {
    display: none;
  }

  /* 分层工具按钮 */
  .user-menu-container,
  .login-btn,
  .header-btn {
    height: 42px;
    min-width: 0;
    flex: 1 1 0;
  }

  .user-menu-container {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .header-btn {
    width: 100%;
    min-height: 42px;
    height: 42px;
    border-radius: 6px;
    background: transparent;
    border: none;
    padding: 0;
    gap: 0;
    box-shadow: none;
    justify-content: center;
  }

  .header-btn:hover {
    transform: none;
    background: color-mix(in srgb, var(--color-text-inverse) 10%, transparent);
  }

  .header-btn:hover svg {
    transform: none;
  }

  .header-btn:active {
    transform: none;
    background: color-mix(in srgb, var(--color-text-inverse) 16%, transparent);
  }

  .btn-text {
    display: none;
  }

  .user-btn .btn-text {
    display: none;
  }

  .user-btn .dropdown-icon {
    display: none;
  }

  .user-dropdown {
    position: fixed;
    top: calc(var(--app-header-height, calc(78px + env(safe-area-inset-top, 0px))) + 4px);
    left: 8px;
    border-radius: 10px;
    max-width: calc(100vw - 16px);
    z-index: 2000;
  }

  .theme-switcher {
    display: none;
  }

  .mobile-theme-btn {
    display: flex;
  }
}
</style>
