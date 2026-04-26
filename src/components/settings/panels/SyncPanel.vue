<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">云端同步</h3>
      <p class="section-desc">配置 WebDAV 网盘后可开启自动备份，实现工作区双重归档</p>

      <div class="info-box">
        <Info :size="16" />
        <span>当前同步状态：{{ syncStatusText }}</span>
      </div>

      <div class="setting-item">
        <label class="setting-label">服务器地址 (URL)</label>
        <input
          v-model="webdavUrl"
          type="url"
          class="setting-input"
          placeholder="例如: https://pan.example.com/dav"
          autocomplete="off"
        />
      </div>

      <div class="setting-item">
        <label class="setting-label">用户名</label>
        <input
          v-model="webdavUser"
          type="text"
          class="setting-input"
          placeholder="请输入WebDAV用户名"
          autocomplete="off"
        />
      </div>

      <div class="setting-item">
        <label class="setting-label">密码/授权码</label>
        <input
          v-model="webdavPass"
          type="password"
          class="setting-input"
          placeholder="请输入WebDAV密码/Token"
          autocomplete="new-password"
        />
      </div>

      <div class="backup-mode-group">
        <label class="switch-label">
          <input
            v-model="enableBackup"
            type="checkbox"
            class="setting-checkbox"
          />
          <span class="switch-text" :class="{ active: enableBackup }">开启自动备份模式</span>
        </label>
        <p v-if="enableBackup" class="hint-text hint-green">
          备份模式开启：工作区列表将以 SCE 云为主视角，保存/删除同时将静默同步至 WebDAV。
        </p>
        <p v-else class="hint-text">
          关闭时可单独使用 WebDAV 或 SCE 云，或将两者同时指定为可切换的独立写入目标。
        </p>
      </div>

      <div
        v-if="!enableBackup && (hasWebdavConfigured || hasAnyWebdavInput)"
        class="sync-preference-group"
      >
        <label class="section-label">云工作区默认读写目标</label>
        <div class="radio-selection">
          <label v-if="hasRetiehe" class="radio-label">
            <input v-model="preferredSync" type="radio" value="retiehe" />
            <span>SCE 云服务</span>
          </label>
          <label class="radio-label">
            <input v-model="preferredSync" type="radio" value="webdav" />
            <span>WebDAV 网盘</span>
          </label>
        </div>
        <p class="hint-text">将在打开云工作区窗口时默认选中此目标。</p>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <div class="action-buttons">
        <button
          v-if="hasWebdavConfigured"
          type="button"
          class="btn-danger"
          @click="clearConfig"
          :disabled="loading"
        >
          断开/清空WebDAV
        </button>
        <button
          type="button"
          class="btn-primary"
          @click="handleSave"
          :disabled="loading"
        >
          {{ loading ? '验证并保存中...' : '验证并保存至账号数据库' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Info } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'
import { useLogger } from '@/composables/useLogger'

const { webdavConfig, backupMode, updateSyncSettings, authType, setAuthType, currentUser } = useAuth()
const { mkcol } = useWebDav()
const { success: showSuccess, error: showError } = useLogger()

const webdavUrl = ref('')
const webdavUser = ref('')
const webdavPass = ref('')
const enableBackup = ref(false)
const preferredSync = ref('retiehe')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const hasRetiehe = computed(() => !!currentUser.value)
const hasWebdavConfigured = computed(() => !!webdavConfig.value)
const hasAnyWebdavInput = computed(() => !!(webdavUrl.value.trim() || webdavUser.value.trim() || webdavPass.value.trim()))

const syncStatusText = computed(() => {
  if (backupMode.value) {
    return 'SCE 云 + WebDAV 双重备份'
  }
  if (authType.value === 'webdav') {
    return 'WebDAV 网盘'
  }
  if (hasRetiehe.value) {
    return 'SCE 云服务'
  }
  return '未配置'
})

// 初始化数据
const initData = () => {
  enableBackup.value = backupMode.value
  preferredSync.value = (authType.value === 'webdav' && !backupMode.value) ? 'webdav' : 'retiehe'

  if (webdavConfig.value) {
    webdavUrl.value = webdavConfig.value.url || ''
    webdavUser.value = webdavConfig.value.username || ''
    webdavPass.value = webdavConfig.value.password || ''
  } else {
    webdavUrl.value = ''
    webdavUser.value = ''
    webdavPass.value = ''
  }
}

// 组件挂载时初始化
initData()

// 监听配置变化
watch([webdavConfig, backupMode, authType], () => {
  initData()
})

const clearConfig = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await updateSyncSettings(null, false)
    if (result.success) {
      setAuthType('retiehe')
      successMessage.value = 'WebDAV 配置已清空'
      showSuccess('WebDAV 配置已清空')
      initData()
    } else {
      errorMessage.value = '清空失败: ' + result.message
      showError('清空失败: ' + result.message)
    }
  } catch (e) {
    errorMessage.value = '网络请求失败'
    showError('网络请求失败')
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  const hasInput = webdavUrl.value.trim() || webdavUser.value.trim() || webdavPass.value.trim()
  const isComplete = webdavUrl.value.trim() && webdavUser.value.trim() && webdavPass.value.trim()

  if (hasInput && !isComplete) {
    errorMessage.value = '请填写完整的 WebDAV 信息或者清空输入框'
    return
  }

  loading.value = true

  try {
    let finalConfig = null

    if (isComplete) {
      finalConfig = {
        url: webdavUrl.value.trim(),
        username: webdavUser.value.trim(),
        password: webdavPass.value.trim()
      }

      try {
        await mkcol(finalConfig, 'sce_data')
      } catch (err) {
        throw new Error(err.message || 'WebDAV 连接失败，请检查账号密码')
      }
    }

    const result = await updateSyncSettings(finalConfig, enableBackup.value)
    if (result.success) {
      if (enableBackup.value || !isComplete) {
        setAuthType('retiehe')
      } else {
        setAuthType(preferredSync.value)
      }

      successMessage.value = '设置保存成功并已同步至数据库！'
      showSuccess('同步设置已保存')
    } else {
      errorMessage.value = '数据库保存失败: ' + result.message
      showError('数据库保存失败: ' + result.message)
    }
  } catch (err) {
    errorMessage.value = err.message || '异常错误'
    showError(err.message || '保存失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.settings-panel {
  padding: 0;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-info-bg);
  border: 1px solid var(--color-info);
  border-radius: 6px;
  color: var(--color-info);
  font-size: 13px;
  margin-bottom: 20px;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.setting-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.setting-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-shadow);
}

.setting-checkbox {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  cursor: pointer;
}

.backup-mode-group,
.sync-preference-group {
  background: var(--color-bg-subtle);
  border: 1px dashed var(--color-border-strong);
  padding: 14px;
  border-radius: 6px;
  margin-top: 16px;
  margin-bottom: 16px;
}

.switch-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0;
}

.switch-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.switch-text.active {
  color: var(--color-info);
}

.sync-preference-group .section-label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.radio-selection {
  display: flex;
  gap: 20px;
  margin-bottom: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary);
}

.radio-label input[type='radio'] {
  width: auto;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

.hint-text {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 8px 0 0;
  line-height: 1.5;
}

.hint-green {
  color: var(--color-success);
}

.error-message {
  color: var(--color-danger);
  font-size: 13px;
  margin-top: 16px;
  background: var(--color-danger-bg);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--color-danger);
}

.success-message {
  color: var(--color-success);
  font-size: 13px;
  margin-top: 16px;
  background: var(--color-success-bg);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--color-success);
}

.action-buttons {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.btn-primary,
.btn-danger {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  flex: 1;
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--color-primary-shadow);
}

.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-danger {
  background: var(--color-surface);
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-bg);
}
</style>
