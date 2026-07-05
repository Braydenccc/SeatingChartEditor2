<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import { History, RotateCcw, X } from 'lucide-vue-next'
import LoadingSpinner from './components/ui/LoadingSpinner.vue'
import GlobalDropZone from './components/ui/GlobalDropZone.vue'

const LoginDialog = defineAsyncComponent({
  loader: () => import('./components/auth/LoginDialog.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200
})
const CloudWorkspaceDialog = defineAsyncComponent(() => import('./components/workspace/CloudWorkspaceDialog.vue'))
const WelcomeIntroDialog = defineAsyncComponent(() => import('./components/onboarding/WelcomeIntroDialog.vue'))
const RosterExcelImportDialog = defineAsyncComponent(() => import('./components/student/RosterExcelImportDialog.vue'))

import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useUndo } from '@/composables/useUndo'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useAutoSave } from '@/composables/useAutoSave'
import { useRouteLoading } from '@/composables/useRouteLoading'
import { useWelcomeOnboarding } from '@/composables/useWelcomeOnboarding'
import { initializeTags } from '@/composables/useTagData'

const { isLoginDialogVisible, initAuth, isLoggedIn } = useAuth()
const { loadWorkspaceFromCloud } = useCloudWorkspace()
const { applyWorkspaceData, getLastWorkspace } = useWorkspace()
const { success, warning, error } = useLogger()
const { undo, redo, canUndo, canRedo, setMaxHistory } = useUndo()
const { showCloudDialog, cloudDialogMode, handleCloudSuccess } = useCloudWorkspaceDialog()
const { settings, applyThemeColor, applyColorScheme } = useGlobalSettings()
const {
  startAutoSave,
  autoSaveBackup,
  getAutoSaveBackup,
  isAutoSavePromptDue,
  markAutoSaveBackupHandled,
  restoreAutoSaveBackup
} = useAutoSave()
const { isRouteLoading } = useRouteLoading()
const { isWelcomeIntroVisible, showWelcomeIntroIfNeeded } = useWelcomeOnboarding()

const loginDialogInitialTab = ref('login')
const showAutoSavePrompt = ref(false)
const isRestoringAutoSave = ref(false)
let lastWorkspaceRestoreStarted = false

const handleOpenLogin = (tab = 'login') => {
  loginDialogInitialTab.value = tab
  isLoginDialogVisible.value = true
}

const formatAutoSaveTime = (value) => {
  if (!value) return '未知时间'
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return '未知时间'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const autoSavePromptMeta = computed(() => {
  const backup = autoSaveBackup.value
  if (!backup) return ''

  const studentCount = Array.isArray(backup.data?.students) ? backup.data.students.length : 0
  const assignedCount = Array.isArray(backup.data?.layout?.seats)
    ? backup.data.layout.seats.filter(seat => seat.studentId != null).length
    : 0

  return `${formatAutoSaveTime(backup.time || backup.timeIso)} · ${studentCount} 名学生 · ${assignedCount} 个已排座位`
})

const restoreLastWorkspaceIfNeeded = () => {
  if (lastWorkspaceRestoreStarted) return
  lastWorkspaceRestoreStarted = true

  const lastWs = getLastWorkspace()

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
}

const continueStartup = () => {
  showWelcomeIntroIfNeeded()
  restoreLastWorkspaceIfNeeded()
}

const handleRestoreAutoSavePrompt = async () => {
  if (isRestoringAutoSave.value) return

  isRestoringAutoSave.value = true
  try {
    const isSuccess = await restoreAutoSaveBackup(autoSaveBackup.value)
    if (!isSuccess) {
      error('自动保存恢复失败，请到文件页重试或手动加载工作区')
      return
    }

    showAutoSavePrompt.value = false
    success('已恢复自动保存的工作区')
    showWelcomeIntroIfNeeded()
  } finally {
    isRestoringAutoSave.value = false
  }
}

const handleDismissAutoSavePrompt = async () => {
  await markAutoSaveBackupHandled(autoSaveBackup.value)
  showAutoSavePrompt.value = false
  warning('已暂不恢复自动保存，可在文件页的自动保存卡片中恢复')
  continueStartup()
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
  const backup = await getAutoSaveBackup()
  if (backup && await isAutoSavePromptDue(backup)) {
    showAutoSavePrompt.value = true
  } else {
    continueStartup()
  }

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

    <RosterExcelImportDialog />

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

    <Transition name="autosave-prompt">
      <div v-if="showAutoSavePrompt" class="autosave-overlay" @mousedown.self="handleDismissAutoSavePrompt">
        <section class="autosave-dialog" role="dialog" aria-modal="true" aria-labelledby="autosave-prompt-title">
          <header class="autosave-header">
            <div class="autosave-icon">
              <History :size="22" stroke-width="2" />
            </div>
            <div>
              <h2 id="autosave-prompt-title">发现自动保存</h2>
              <p>{{ autoSavePromptMeta }}</p>
            </div>
            <button class="autosave-close" type="button" aria-label="稍后处理" @click="handleDismissAutoSavePrompt">
              <X :size="18" stroke-width="2" />
            </button>
          </header>

          <p class="autosave-message">可以先恢复这份自动保存，也可以稍后在文件页顶部的自动保存卡片中打开。</p>

          <footer class="autosave-actions">
            <button class="autosave-secondary" type="button" :disabled="isRestoringAutoSave" @click="handleDismissAutoSavePrompt">
              稍后处理
            </button>
            <button class="autosave-primary" type="button" :disabled="isRestoringAutoSave" @click="handleRestoreAutoSavePrompt">
              <RotateCcw :size="16" stroke-width="2" />
              <span>{{ isRestoringAutoSave ? '恢复中' : '恢复自动保存' }}</span>
            </button>
          </footer>
        </section>
      </div>
    </Transition>

    <WelcomeIntroDialog v-if="isWelcomeIntroVisible" />
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

.autosave-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--color-bg-overlay);
}

.autosave-dialog {
  width: min(440px, 100%);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-dialog-bg);
  box-shadow: 0 18px 48px color-mix(in srgb, var(--color-text-primary) 18%, transparent);
  color: var(--color-text-primary);
}

.autosave-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 18px 18px 12px;
  border-bottom: 1px solid var(--color-border);
}

.autosave-icon {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--color-bg-selected);
  color: var(--color-primary);
}

.autosave-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
  line-height: 1.3;
}

.autosave-header p,
.autosave-message {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.autosave-close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.autosave-close:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.autosave-message {
  padding: 14px 18px 4px;
}

.autosave-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px 18px;
}

.autosave-secondary,
.autosave-primary {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.autosave-secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.autosave-primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.autosave-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.autosave-primary:hover {
  background: var(--color-primary-hover);
}

.autosave-secondary:disabled,
.autosave-primary:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.autosave-prompt-enter-active,
.autosave-prompt-leave-active {
  transition: opacity 0.18s ease;
}

.autosave-prompt-enter-active .autosave-dialog,
.autosave-prompt-leave-active .autosave-dialog {
  transition: transform 0.18s ease;
}

.autosave-prompt-enter-from,
.autosave-prompt-leave-to {
  opacity: 0;
}

.autosave-prompt-enter-from .autosave-dialog,
.autosave-prompt-leave-to .autosave-dialog {
  transform: translateY(10px);
}

@media (max-width: 560px) {
  .autosave-overlay {
    align-items: flex-end;
    padding: 12px;
  }

  .autosave-dialog {
    border-radius: 12px;
  }

  .autosave-actions {
    flex-direction: column-reverse;
  }

  .autosave-secondary,
  .autosave-primary {
    width: 100%;
  }
}
</style>
