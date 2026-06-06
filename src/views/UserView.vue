<template>
  <AppPageShell title="账号中心" eyebrow="用户与云端工作区">
    <div class="user-layout">
      <section class="user-section account-section">
        <div class="section-header">
          <User :size="20" stroke-width="2" />
          <div>
            <h2>账号信息</h2>
            <p>{{ accountStatusText }}</p>
          </div>
        </div>

        <div class="account-grid">
          <div class="info-item">
            <span class="info-label">当前用户</span>
            <strong>{{ currentUser?.username || '未登录' }}</strong>
          </div>
          <div class="info-item">
            <span class="info-label">账号类型</span>
            <strong>{{ accountTypeText }}</strong>
          </div>
          <div class="info-item">
            <span class="info-label">同步状态</span>
            <strong>{{ token ? 'SCE 云端可用' : '未连接 SCE 云端' }}</strong>
          </div>
        </div>

        <div v-if="!token" class="notice-row">
          <Cloud :size="18" stroke-width="2" />
          <span>登录 SCE 账号后可查看账号云端工作区统计并修改密码。</span>
          <button class="inline-button" type="button" @click="openLoginDialog">
            <LogIn :size="16" stroke-width="2" />
            <span>登录 SCE</span>
          </button>
        </div>
      </section>

      <section class="user-section workspace-section">
        <div class="section-header">
          <Cloud :size="20" stroke-width="2" />
          <div>
            <h2>SCE 云端工作区</h2>
            <p>账号名下工作区的数量、容量和最近更新。</p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">工作区</span>
            <strong>{{ workspaceCount }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">总大小</span>
            <strong>{{ totalSizeText }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">最近更新</span>
            <strong>{{ recentWorkspaceTimeText }}</strong>
          </div>
          <div class="stat-card wide">
            <span class="stat-label">最近工作区</span>
            <strong>{{ recentWorkspaceName }}</strong>
          </div>
        </div>

        <p v-if="errorMessage" class="status-text danger">{{ errorMessage }}</p>

        <div class="action-row">
          <button class="action-button" type="button" :disabled="!token || isRefreshing" @click="refresh">
            <RefreshCw :size="18" stroke-width="2" />
            <span>{{ isRefreshing ? '刷新中' : '刷新统计' }}</span>
          </button>
          <button class="action-button" type="button" @click="openCloudLoad">
            <CloudDownload :size="18" stroke-width="2" />
            <span>从云端加载</span>
          </button>
          <button class="action-button" type="button" @click="openCloudSave">
            <CloudUpload :size="18" stroke-width="2" />
            <span>保存至云端</span>
          </button>
          <button class="action-button" type="button" @click="router.push('/files')">
            <FolderOpen :size="18" stroke-width="2" />
            <span>前往文件页</span>
          </button>
        </div>
      </section>

      <section class="user-section password-section">
        <div class="section-header">
          <KeyRound :size="20" stroke-width="2" />
          <div>
            <h2>修改 SCE 密码</h2>
            <p>{{ token ? '更新当前 SCE 账号的登录密码。' : '此操作需要先登录 SCE 账号。' }}</p>
          </div>
        </div>

        <form v-if="token" class="password-form" @submit.prevent="handleChangePassword">
          <label class="form-field">
            <span>当前密码</span>
            <input v-model="currentPassword" type="password" autocomplete="current-password" />
          </label>
          <label class="form-field">
            <span>新密码</span>
            <input v-model="newPassword" type="password" autocomplete="new-password" />
          </label>
          <label class="form-field">
            <span>确认新密码</span>
            <input v-model="confirmPassword" type="password" autocomplete="new-password" />
          </label>

          <div v-if="passwordValidation" class="requirements">
            <span :class="{ met: passwordValidation.length }">至少 8 个字符</span>
            <span :class="{ met: passwordValidation.uppercase }">包含大写字母</span>
            <span :class="{ met: passwordValidation.lowercase }">包含小写字母</span>
            <span :class="{ met: passwordValidation.number }">包含数字</span>
          </div>

          <p v-if="passwordMessage" class="status-text" :class="{ danger: passwordMessageType === 'error', success: passwordMessageType === 'success' }">
            {{ passwordMessage }}
          </p>

          <div class="form-actions">
            <button class="primary-button" type="submit" :disabled="isChangingPassword">
              <KeyRound :size="18" stroke-width="2" />
              <span>{{ isChangingPassword ? '提交中' : '修改密码' }}</span>
            </button>
          </div>
        </form>

        <div v-else class="empty-panel">
          <Cloud :size="22" stroke-width="2" />
          <span>仅 SCE 账号支持在此修改登录密码。</span>
        </div>
      </section>
    </div>
  </AppPageShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  FolderOpen,
  KeyRound,
  LogIn,
  RefreshCw,
  User
} from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useCloudWorkspaceStats } from '@/composables/useCloudWorkspaceStats'
import { useLogger } from '@/composables/useLogger'
import { validatePasswordStrength } from '@/utils/passwordValidator'

const router = useRouter()
const { currentUser, token, authType, isLoginDialogVisible, changePassword } = useAuth()
const { openCloudLoad, openCloudSave } = useCloudWorkspaceDialog()
const { success, error } = useLogger()
const {
  workspaceCount,
  totalSizeText,
  recentWorkspaceName,
  recentWorkspaceTimeText,
  isRefreshing,
  errorMessage,
  refresh
} = useCloudWorkspaceStats({ source: 'retiehe' })

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isChangingPassword = ref(false)
const passwordMessage = ref('')
const passwordMessageType = ref('')

const accountTypeText = computed(() => {
  if (token.value) return 'SCE 账号'
  if (authType.value === 'webdav') return 'WebDAV'
  return '未登录'
})

const accountStatusText = computed(() => {
  if (token.value) return '已连接 SCE 账号，可管理云端工作区与密码。'
  if (currentUser.value) return '当前为 WebDAV 连接，SCE 账号功能不可用。'
  return '登录后可查看账号信息。'
})

const passwordValidation = computed(() => {
  if (!newPassword.value) return null
  return validatePasswordStrength(newPassword.value)
})

const isNewPasswordValid = computed(() =>
  !!passwordValidation.value && Object.values(passwordValidation.value).every(Boolean)
)

const openLoginDialog = () => {
  isLoginDialogVisible.value = true
}

const handleChangePassword = async () => {
  passwordMessage.value = ''
  passwordMessageType.value = ''

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordMessage.value = '请完整填写密码信息'
    passwordMessageType.value = 'error'
    return
  }
  if (!isNewPasswordValid.value) {
    passwordMessage.value = '新密码必须至少 8 个字符，且包含大小写字母和数字'
    passwordMessageType.value = 'error'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordMessage.value = '两次输入的新密码不一致'
    passwordMessageType.value = 'error'
    return
  }

  isChangingPassword.value = true
  try {
    const result = await changePassword(currentPassword.value, newPassword.value)
    if (result.success) {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      passwordMessage.value = result.message || '密码已修改'
      passwordMessageType.value = 'success'
      success('SCE 密码已修改')
    } else {
      passwordMessage.value = result.message || '密码修改失败'
      passwordMessageType.value = 'error'
      error(passwordMessage.value)
    }
  } finally {
    isChangingPassword.value = false
  }
}

watch(token, (value) => {
  if (value) refresh()
}, { immediate: true })
</script>

<style scoped>
.user-layout {
  min-height: 100%;
  display: grid;
  grid-template-columns: minmax(240px, 0.78fr) minmax(340px, 1.22fr);
  align-content: start;
  gap: 0;
  background: var(--color-surface);
}

.user-section {
  padding: 16px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  min-width: 0;
}

.workspace-section {
  grid-column: 2;
  grid-row: span 2;
  border-right: none;
}

.password-section {
  grid-column: 1;
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--color-primary);
  margin-bottom: 12px;
}

.section-header h2 {
  margin: 0 0 2px;
  font-size: 16px;
  color: var(--color-text-primary);
}

.section-header p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.account-grid,
.stats-grid {
  display: grid;
  gap: 8px;
}

.account-grid {
  grid-template-columns: 1fr;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.info-item,
.stat-card {
  min-height: 58px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  min-width: 0;
}

.stat-card.wide {
  grid-column: span 1;
}

.info-label,
.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.info-item strong,
.stat-card strong {
  font-size: 16px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-row,
.empty-panel {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.action-row,
.form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.workspace-section .action-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.action-button,
.inline-button,
.primary-button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.workspace-section .action-button {
  width: 100%;
}

.inline-button {
  margin-left: auto;
}

.primary-button {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.action-button:hover,
.inline-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface);
}

.primary-button:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.action-button:disabled,
.primary-button:disabled {
  cursor: not-allowed;
  color: var(--color-text-disabled);
  border-color: var(--color-border);
  background: var(--color-bg-soft);
}

.password-form {
  display: grid;
  gap: 10px;
}

.form-field {
  display: grid;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.form-field input {
  height: 40px;
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  background: var(--color-input-bg);
  color: var(--color-text-primary);
  padding: 0 12px;
  font-size: 14px;
}

.form-field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.requirements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.requirements span {
  padding: 4px 7px;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  font-size: 12px;
}

.requirements span.met {
  background: var(--color-success-bg-light);
  color: var(--color-success);
  border-color: var(--color-success);
}

.status-text {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.status-text.danger {
  color: var(--color-danger);
}

.status-text.success {
  color: var(--color-success);
}

@media (max-width: 720px) {
  .user-layout {
    grid-template-columns: 1fr;
  }

  .user-section,
  .workspace-section {
    grid-column: auto;
    grid-row: auto;
    border-right: none;
  }

  .account-grid,
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .user-section {
    padding: 14px 12px;
  }

  .account-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .notice-row,
  .empty-panel,
  .action-row {
    align-items: stretch;
    flex-direction: column;
  }

  .inline-button {
    margin-left: 0;
  }

  .action-button,
  .inline-button,
  .primary-button {
    width: 100%;
  }
}
</style>
