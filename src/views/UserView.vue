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
            <span class="info-label">当前登录</span>
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

        <div v-if="token" class="binding-panel">
          <div class="binding-header">
            <ShieldCheck :size="18" stroke-width="2" />
            <strong>登录绑定</strong>
            <button class="icon-inline-button" type="button" :disabled="isRefreshingBindings" @click="handleRefreshBindings">
              <RefreshCw :size="15" stroke-width="2" :class="{ spinning: isRefreshingBindings }" />
            </button>
          </div>

          <div class="binding-list">
            <div class="binding-item">
              <div>
                <strong>账号密码登录</strong>
                <span>{{ currentUser?.passwordUsername || '未添加' }}</span>
              </div>
              <span class="mini-status" :class="{ active: !!currentUser?.hasPassword }">
                {{ currentUser?.hasPassword ? '已添加' : '未添加' }}
              </span>
              <button
                v-if="currentUser?.hasPassword"
                class="icon-inline-button danger"
                type="button"
                title="解除账号密码登录"
                :disabled="isUnbindingPassword"
                @click="handleUnbindPasswordLogin"
              >
                <Unlink :size="15" stroke-width="2" />
              </button>
            </div>
            <div v-for="identity in oauthIdentities" :key="identity.key" class="binding-item">
              <div>
                <strong>{{ identity.providerName || identity.providerId }}</strong>
                <span>{{ identity.displayName || identity.email || '已绑定' }}</span>
              </div>
              <button
                class="icon-inline-button danger"
                type="button"
                title="解除绑定"
                :disabled="isUnbindingIdentity === identity.key"
                @click="handleUnbindOAuth(identity)"
              >
                <Unlink :size="15" stroke-width="2" />
              </button>
            </div>
          </div>

          <form v-if="!currentUser?.hasPassword" class="bind-form" @submit.prevent="handleBindPasswordLogin">
            <label class="form-field">
              <span>登录用户名</span>
              <input v-model="bindLoginUsername" type="text" autocomplete="username" />
            </label>
            <label class="form-field">
              <span>登录密码</span>
              <input v-model="bindLoginPassword" type="password" autocomplete="current-password" />
            </label>
            <button class="primary-button" type="submit" :disabled="isBindingPassword">
              <Link2 :size="18" stroke-width="2" />
              <span>{{ isBindingPassword ? '添加中' : '添加账号密码登录' }}</span>
            </button>
          </form>

          <div v-if="availableOAuthProviders.length" class="oauth-bind-actions">
            <button
              v-for="provider in availableOAuthProviders"
              :key="provider.id"
              class="action-button"
              type="button"
              @click="handleBindOAuth(provider.id)"
            >
              <Link2 :size="18" stroke-width="2" />
              <span>绑定 {{ provider.name }}</span>
            </button>
          </div>

          <p v-if="bindMessage" class="status-text" :class="{ danger: bindMessageType === 'error', success: bindMessageType === 'success' }">
            {{ bindMessage }}
          </p>
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
          <button class="action-button" type="button" :title="cloudLoadTitle" @click="openCloudLoad">
            <CloudDownload :size="18" stroke-width="2" />
            <span>{{ cloudLoadLabel }}</span>
          </button>
          <button class="action-button" type="button" :title="cloudSaveTitle" @click="openCloudSave">
            <CloudUpload :size="18" stroke-width="2" />
            <span>{{ cloudSaveLabel }}</span>
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
            <h2>修改登录密码</h2>
            <p>{{ token && currentUser?.hasPassword ? '更新账号密码登录的密码。' : '此操作需要先添加账号密码登录。' }}</p>
          </div>
        </div>

        <form v-if="token && currentUser?.hasPassword" class="password-form" @submit.prevent="handleChangePassword">
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
          <span>当前账号未添加账号密码登录。</span>
        </div>
      </section>
    </div>
  </AppPageShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  FolderOpen,
  KeyRound,
  Link2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Unlink,
  User
} from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import { useAuth } from '@/composables/useAuth'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useCloudWorkspaceStats } from '@/composables/useCloudWorkspaceStats'
import { useLogger } from '@/composables/useLogger'
import { validatePasswordStrength } from '@/utils/passwordValidator'

const router = useRouter()
const route = useRoute()
const {
  currentUser,
  token,
  authType,
  isLoginDialogVisible,
  changePassword,
  oauthProviders,
  loadOAuthProviders,
  startOAuthLogin,
  refreshAuthBindings,
  bindPasswordLogin,
  unbindPasswordLogin,
  unbindOAuthIdentity
} = useAuth()
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
const bindLoginUsername = ref('')
const bindLoginPassword = ref('')
const bindMessage = ref('')
const bindMessageType = ref('')
const isBindingPassword = ref(false)
const isRefreshingBindings = ref(false)
const isUnbindingPassword = ref(false)
const isUnbindingIdentity = ref('')
const handledOAuthQuery = ref('')

const accountTypeText = computed(() => {
  if (token.value) return 'SCE'
  if (authType.value === 'webdav') return 'WebDAV'
  return '未登录'
})

const accountStatusText = computed(() => {
  if (token.value && currentUser.value?.hasPassword && oauthIdentities.value.length) return '已连接 SCE，可使用账号密码或统一登录进入。'
  if (token.value && currentUser.value?.hasPassword) return '已连接 SCE，可管理云端工作区与登录密码。'
  if (token.value) return '已连接 SCE，当前仅绑定统一登录，可添加账号密码登录。'
  if (currentUser.value) return '当前为 WebDAV 连接，SCE 账号功能不可用。'
  return '登录后可查看账号信息。'
})

const cloudLoadLabel = computed(() => token.value ? '从云端加载' : '登录后从云端加载')
const cloudSaveLabel = computed(() => token.value ? '保存至云端' : '登录后保存至云端')
const cloudLoadTitle = computed(() => token.value ? '从 SCE 云端加载工作区' : '需要先登录 SCE 账号')
const cloudSaveTitle = computed(() => token.value ? '保存当前工作区至 SCE 云端' : '需要先登录 SCE 账号')

const passwordValidation = computed(() => {
  if (!newPassword.value) return null
  return validatePasswordStrength(newPassword.value)
})

const isNewPasswordValid = computed(() =>
  !!passwordValidation.value && Object.values(passwordValidation.value).every(Boolean)
)

const oauthIdentities = computed(() => currentUser.value?.oauthIdentities || [])
const boundOAuthProviderIds = computed(() => new Set(oauthIdentities.value.map(identity => identity.providerId)))
const availableOAuthProviders = computed(() =>
  oauthProviders.value.filter(provider => !boundOAuthProviderIds.value.has(provider.id))
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
      success('登录密码已修改')
    } else {
      passwordMessage.value = result.message || '密码修改失败'
      passwordMessageType.value = 'error'
      error(passwordMessage.value)
    }
  } finally {
    isChangingPassword.value = false
  }
}

const handleRefreshBindings = async () => {
  isRefreshingBindings.value = true
  try {
    await Promise.all([loadOAuthProviders(), refreshAuthBindings()])
  } finally {
    isRefreshingBindings.value = false
  }
}

const handleBindOAuth = (providerId, confirmMerge = false) => {
  startOAuthLogin(providerId, 'bind', { confirmMerge })
}

const submitBindPasswordLogin = async (confirmMerge = false) => {
  const result = await bindPasswordLogin(bindLoginUsername.value.trim(), bindLoginPassword.value, confirmMerge)
  if (!result.success && result.code === 'merge_required') {
    const confirmed = window.confirm(result.message || '该登录方式已属于另一个账号，确认合并到当前账号？')
    if (confirmed) {
      return submitBindPasswordLogin(true)
    }
  }
  return result
}

const handleBindPasswordLogin = async () => {
  bindMessage.value = ''
  bindMessageType.value = ''
  if (!bindLoginUsername.value.trim() || !bindLoginPassword.value) {
    bindMessage.value = '请填写登录用户名和密码'
    bindMessageType.value = 'error'
    return
  }

  isBindingPassword.value = true
  try {
    const result = await submitBindPasswordLogin()
    if (result.success) {
      bindLoginPassword.value = ''
      bindMessage.value = result.message || '账号密码登录已添加'
      bindMessageType.value = 'success'
      success(bindMessage.value)
      await handleRefreshBindings()
    } else {
      bindMessage.value = result.message || '绑定失败'
      bindMessageType.value = 'error'
      error(bindMessage.value)
    }
  } finally {
    isBindingPassword.value = false
  }
}

const handleUnbindPasswordLogin = async () => {
  if (!window.confirm('确认解除账号密码登录？解除后仍需至少保留一种登录方式。')) return
  isUnbindingPassword.value = true
  try {
    const result = await unbindPasswordLogin(currentUser.value?.passwordUsername)
    if (result.success) {
      success(result.message || '账号密码登录已解除')
      await handleRefreshBindings()
    } else {
      error(result.message || '解除失败')
    }
  } finally {
    isUnbindingPassword.value = false
  }
}

const handleUnbindOAuth = async (identity) => {
  if (!window.confirm(`确认解除 ${identity.providerName || identity.providerId} 绑定？`)) return
  isUnbindingIdentity.value = identity.key
  try {
    const result = await unbindOAuthIdentity(identity.key)
    if (result.success) {
      success(result.message || 'OAuth 绑定已解除')
      await handleRefreshBindings()
    } else {
      error(result.message || '解绑失败')
    }
  } finally {
    isUnbindingIdentity.value = ''
  }
}

const readQueryString = (value) => {
  if (Array.isArray(value)) return value[0] || ''
  return typeof value === 'string' ? value : ''
}

const clearOAuthQueryParams = () => {
  const query = { ...route.query }
  let changed = false
  for (const key of ['oauth_merge_required', 'provider', 'oauth_message', 'oauth_error', 'oauth_bind', 'oauth_login']) {
    if (key in query) {
      delete query[key]
      changed = true
    }
  }
  if (changed) {
    void router.replace({ path: route.path, query })
  }
}

const handleOAuthRouteQuery = () => {
  const providerId = readQueryString(route.query.provider)
  const oauthMessage = readQueryString(route.query.oauth_message)
  const oauthError = readQueryString(route.query.oauth_error)
  const oauthBind = readQueryString(route.query.oauth_bind)
  const oauthLogin = readQueryString(route.query.oauth_login)
  const mergeRequired = readQueryString(route.query.oauth_merge_required)
  const signature = JSON.stringify({ providerId, oauthMessage, oauthError, oauthBind, oauthLogin, mergeRequired })

  if (signature === handledOAuthQuery.value) return
  handledOAuthQuery.value = signature

  if ((mergeRequired === '1' || mergeRequired === 'true') && providerId) {
    const message = oauthMessage || '该统一登录已属于另一个 SCE 账号，确认后会把两个账号的数据合并到当前账号。'
    clearOAuthQueryParams()
    if (window.confirm(message)) {
      handleBindOAuth(providerId, true)
      return
    }
    bindMessage.value = '已取消 OAuth 合并绑定'
    bindMessageType.value = 'error'
    return
  }

  if (oauthError) {
    bindMessage.value = oauthError
    bindMessageType.value = 'error'
    error(oauthError)
    clearOAuthQueryParams()
    return
  }

  if (oauthBind === 'success') {
    bindMessage.value = 'OAuth 登录方式已绑定'
    bindMessageType.value = 'success'
    void handleRefreshBindings()
    clearOAuthQueryParams()
    return
  }

  if (oauthLogin === 'success') {
    void handleRefreshBindings()
    clearOAuthQueryParams()
  }
}

watch(token, (value) => {
  if (value) {
    refresh()
    handleRefreshBindings()
  }
}, { immediate: true })

watch(() => route.query, handleOAuthRouteQuery, { immediate: true })
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

.binding-panel {
  margin-top: 10px;
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
}

.binding-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
}

.binding-header strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.binding-list {
  display: grid;
  gap: 8px;
}

.binding-item {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 9px;
}

.binding-item div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.binding-item strong,
.binding-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-item strong {
  font-size: 13px;
  color: var(--color-text-primary);
}

.binding-item span {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.mini-status {
  flex: 0 0 auto;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  font-size: 12px;
  font-weight: 700;
}

.mini-status.active {
  color: var(--color-success);
  background: var(--color-success-bg-light);
}

.icon-inline-button {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.icon-inline-button:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.icon-inline-button.danger:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.bind-form,
.oauth-bind-actions {
  display: grid;
  gap: 8px;
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
