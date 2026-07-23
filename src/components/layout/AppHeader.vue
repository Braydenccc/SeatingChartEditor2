<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="header-text" data-route-heading tabindex="-1">BraydenSCE V2</h1>

      <!-- 用户菜单 -->
      <NDropdown v-if="isLoggedIn" trigger="click" :options="accountOptions" @select="handleAccountSelect">
        <NButton class="header-btn user-btn" quaternary :title="currentUser?.username || '账户'">
          <template #icon><NIcon><Cloud v-if="authType === 'webdav'" :size="18" /><User v-else :size="18" /></NIcon></template>
          <span class="btn-text">{{ currentUser?.username }}</span>
          <ChevronDown class="dropdown-icon" :size="14" />
        </NButton>
      </NDropdown>

      <!-- 登录按钮 -->
      <NButton v-else class="header-btn login-btn" quaternary title="登录" @click="emit('open-login')">
        <template #icon><NIcon><Cloud :size="18" /></NIcon></template>
        <span class="btn-text">登录</span>
      </NButton>

      <!-- 设置按钮 -->
      <NButton class="header-btn" quaternary @click="openFiles" title="文件">
        <template #icon><NIcon><FileText :size="18" /></NIcon></template>
        <span class="btn-text">文件</span>
      </NButton>

      <NButton class="header-btn" quaternary @click="openStudents" title="学生">
        <template #icon><NIcon><Users :size="18" /></NIcon></template>
        <span class="btn-text">学生</span>
      </NButton>

      <NButton class="header-btn" quaternary @click="openExport" title="导出">
        <template #icon><NIcon><FileOutput :size="18" /></NIcon></template>
        <span class="btn-text">导出</span>
      </NButton>

      <NButton class="header-btn" quaternary @click="openUnifiedSettings" title="统一设置">
        <template #icon><NIcon><Settings :size="18" /></NIcon></template>
        <span class="btn-text">设置</span>
      </NButton>

      <!-- 主题切换 -->
      <NButtonGroup class="theme-switcher">
        <NButton
          v-for="mode in themeModes"
          :key="mode.value"
          class="theme-btn"
          :class="{ active: currentColorScheme === mode.value }"
          size="small"
          quaternary
          :aria-pressed="currentColorScheme === mode.value"
          @click="switchTheme(mode.value)"
          :title="themeTitleFor(mode)"
        >
          <span class="theme-btn-content">
            <span class="theme-icon" :class="{ auto: mode.value === 'auto' }">
              <component :is="themeIconFor(mode)" :size="16" stroke-width="2" />
              <span v-if="mode.value === 'auto'" class="theme-auto-mark">A</span>
            </span>
            <Transition name="theme-label">
              <span v-if="currentColorScheme === mode.value" class="theme-label">{{ mode.label }}</span>
            </Transition>
          </span>
        </NButton>
      </NButtonGroup>

      <NButton class="header-btn mobile-theme-btn" quaternary :title="mobileThemeTitle" @click="cycleTheme">
        <span class="mobile-theme-icon" :class="{ auto: currentColorScheme === 'auto' }">
          <component :is="mobileThemeIcon" :size="18" stroke-width="2" />
          <span v-if="currentColorScheme === 'auto'" class="mobile-theme-auto-mark">A</span>
        </span>
        <span class="btn-text">主题</span>
      </NButton>
    </div>

    <div class="header-right">
      <NButton class="header-btn icon-only" quaternary circle @click="openHelp" title="帮助">
        <template #icon><NIcon><CircleQuestionMark :size="18" /></NIcon></template>
      </NButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { NButton, NButtonGroup, NDropdown, NIcon, type DropdownOption } from 'naive-ui'
import { ChevronDown, CircleQuestionMark, Cloud, FileOutput, FileText, LogIn, LogOut, Moon, Settings, Sun, User, Users } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const emit = defineEmits<{ 'open-login': [tab?: string] }>()

const { currentUser, token, webdavConfig, isLoggedIn, logout, authType } = useAuth()
const { settings, saveToLocalStorage, applyColorScheme, applyThemeColor } = useGlobalSettings()
const { openSettings, closeSettings } = useSettingsDialog()
const router = useRouter()

const hasRetiehe = computed(() => !!token.value)

// 主题切换
const themeModes: Array<{ value: 'light' | 'dark' | 'auto'; label: string; icon?: Component }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'auto', label: '自适应' }
]

const currentColorScheme = computed(() => settings.value.ui.colorScheme)
const currentThemeMode = computed(() => (
  themeModes.find(mode => mode.value === currentColorScheme.value) || themeModes[2]
))
const prefersDarkMode = ref(false)
let prefersDarkQuery: MediaQueryList | null = null

const updatePrefersDarkMode = () => {
  prefersDarkMode.value = Boolean(prefersDarkQuery?.matches)
}

const autoThemeIcon = computed(() => prefersDarkMode.value ? Moon : Sun)

const themeIconFor = (mode: typeof themeModes[number]) => {
  if (mode.value === 'auto') return autoThemeIcon.value
  return mode.icon
}

const themeTitleFor = (mode: typeof themeModes[number]) => {
  if (mode.value !== 'auto') return mode.label
  return `自适应（当前${prefersDarkMode.value ? '深色' : '浅色'}）`
}

const mobileThemeIcon = computed(() => {
  return themeIconFor(currentThemeMode.value)
})

const mobileThemeTitle = computed(() => {
  return `主题：${themeTitleFor(currentThemeMode.value)}`
})

const switchTheme = (mode: 'light' | 'dark' | 'auto') => {
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

const renderDropdownIcon = (icon: Component, color?: string) => () => h(NIcon, { color }, { default: () => h(icon, { size: 16 }) })
const renderDangerLabel = (label: string) => () => h('span', { style: { color: 'var(--color-danger)' } }, label)
const accountOptions = computed<DropdownOption[]>(() => [
  { label: '账号中心', key: 'user', icon: renderDropdownIcon(User) },
  ...(!hasRetiehe.value ? [{ label: '登录 SCE 账号', key: 'login', icon: renderDropdownIcon(LogIn) }] : []),
  { type: 'divider', key: 'divider' },
  {
    label: renderDangerLabel(hasRetiehe.value ? '退出 SCE 账号' : '退出 WebDAV'),
    key: 'logout',
    icon: renderDropdownIcon(LogOut, 'var(--color-danger)')
  }
])

const handleAccountSelect = (key: string | number) => {
  if (key === 'user') void router.push('/user')
  if (key === 'login') emit('open-login', 'login')
  if (key === 'logout') logout('all')
}

const openUnifiedSettings = () => {
  openSettings()
}

const openHelp = () => {
  openSettings('about', 'help')
}

const openFiles = () => router.push('/files')
const openStudents = () => router.push('/students')
const openExport = () => router.push({ path: '/export', query: { tab: 'image' } })

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    updatePrefersDarkMode()
    prefersDarkQuery.addEventListener('change', updatePrefersDarkMode)
  }
})

onBeforeUnmount(() => {
  prefersDarkQuery?.removeEventListener('change', updatePrefersDarkMode)
  closeSettings()
})
</script>

<style scoped>
/* ===== 基础布局 ===== */
.app-header {
  --header-help-space: 56px;
  --header-control-height: clamp(34px, calc(1.5vw + 18px), 38px);
  --theme-control-height: var(--header-control-height);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-header-accent-bg, var(--color-primary));
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

.header-text:focus-visible {
  outline: 2px solid var(--color-text-inverse);
  outline-offset: 4px;
  border-radius: 2px;
}

/* ===== 统一按钮样式 ===== */
.header-btn {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--header-control-height);
  min-height: var(--header-control-height);
  box-sizing: border-box;
  gap: 8px;
  background: color-mix(in srgb, var(--color-text-inverse) 12%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid color-mix(in srgb, var(--color-text-inverse) 20%, transparent);
  color: var(--color-text-inverse);
  padding: 0 16px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transform-origin: center;
  transition:
    background 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.header-btn svg {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.header-btn:hover {
  background: color-mix(in srgb, var(--color-text-inverse) 22%, transparent);
  border-color: color-mix(in srgb, var(--color-text-inverse) 36%, transparent);
  color: var(--color-text-inverse);
  box-shadow: none;
}

.header-btn:hover svg {
  transform: scale(1.08);
}

.header-btn:active {
  background: color-mix(in srgb, var(--color-text-inverse) 15%, transparent);
  color: var(--color-text-inverse);
  box-shadow: none;
}

.header-btn.icon-only {
  width: var(--header-control-height);
  height: var(--header-control-height);
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

.user-btn .dropdown-icon {
  margin-left: 2px;
  transition: transform 0.25s;
  flex-shrink: 0;
}

.user-btn:hover .dropdown-icon {
  transform: translateY(2px);
}

/* ===== 主题切换器 ===== */
.theme-switcher {
  display: flex;
  align-items: center;
  height: var(--theme-control-height);
  min-height: var(--theme-control-height);
  box-sizing: border-box;
  background: color-mix(in srgb, var(--color-text-inverse) 10%, transparent);
  border-radius: 24px;
  padding: 0;
  gap: 2px;
  border: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text-inverse) 15%, transparent);
  flex-shrink: 0;
  overflow: hidden;
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: color-mix(in srgb, var(--color-text-inverse) 60%, transparent);
  border-radius: 20px !important;
  cursor: pointer;
  transform-origin: center;
  transition:
    background 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}

.theme-switcher .theme-btn {
  margin: 0 !important;
}

.theme-btn-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.theme-btn svg {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.theme-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.theme-auto-mark {
  position: absolute;
  right: 0;
  bottom: -1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-primary-light);
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
}

.theme-btn:hover {
  color: color-mix(in srgb, var(--color-text-inverse) 90%, transparent);
  background: color-mix(in srgb, var(--color-text-inverse) 12%, transparent);
}

.theme-btn:hover svg {
  transform: scale(1.08);
}

.theme-btn.active {
  background: color-mix(in srgb, var(--color-text-inverse) 20%, transparent);
  color: var(--color-text-inverse);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text-inverse) 10%, transparent);
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
    padding: 0 14px;
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
    padding: 0 12px;
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
@media (max-width: 1024px) {
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
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* 标题层 */
  .header-right {
    display: none;
  }

  /* 分层工具按钮 */
  .login-btn,
  .header-btn {
    height: 44px;
    min-width: 0;
    flex: 1 1 0;
  }

  .header-btn {
    width: 100%;
    min-height: 44px;
    height: 44px;
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

  .theme-switcher {
    display: none;
  }

  .mobile-theme-btn {
    display: flex;
  }
}
</style>
