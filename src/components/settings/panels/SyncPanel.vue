<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">云端同步</h3>
      <p class="section-desc">配置 WebDAV 网盘后可开启自动备份，实现工作区双重归档</p>

      <div class="info-box">
        <Info :size="16" />
        <span>当前同步状态：{{ syncStatusText }}</span>
      </div>

      <div v-if="isDesktopRuntime" class="setting-item">
        <label class="setting-label">SCE 云服务地址</label>
        <NInput
          v-model:value="retieheApiBase"
          type="text"
          class="setting-input"
          placeholder="例如: https://your-site.example.com"
          autocomplete="off"
        />
        <p class="hint-text">桌面版会通过此地址访问 /api/auth.php 与 /api/workspace.php。</p>
      </div>

      <div class="setting-item">
        <label class="setting-label">服务器地址 (URL)</label>
        <NInput
          v-model:value="webdavUrl"
          type="text"
          class="setting-input"
          placeholder="例如: https://pan.example.com/dav"
          autocomplete="off"
        />
      </div>

      <div class="setting-item">
        <label class="setting-label">用户名</label>
        <NInput
          v-model:value="webdavUser"
          type="text"
          class="setting-input"
          placeholder="请输入WebDAV用户名"
          autocomplete="off"
        />
      </div>

      <div class="setting-item">
        <label class="setting-label">密码/授权码</label>
        <NInput
          v-model:value="webdavPass"
          type="password"
          show-password-on="click"
          class="setting-input"
          placeholder="请输入WebDAV密码/Token"
          autocomplete="new-password"
        />
      </div>

      <div class="setting-item">
        <label class="setting-label">启用备份模式</label>
        <n-flex vertical align="start">
          <NSwitch v-model:value="enableBackup"></NSwitch>
          <div class="info-box">
            <Info :size="16" />
            <span>备份模式开启，工作区列表将以 SCE 云为主视角，保存/删除同时将静默同步至 WebDAV。关闭时可单独使用 WebDAV 或 SCE 云，或将两者同时指定为可切换的独立写入目标。</span>
          </div>
        </n-flex>
      </div>

      <div
        v-if="!enableBackup && (hasWebdavConfigured || hasAnyWebdavInput)"
        class="sync-preference-group"
      >
        <label class="section-label">云工作区默认读写目标</label>
        <NRadioGroup v-model:value="preferredSync" class="radio-selection" size="small">
          <NRadioButton v-if="hasRetiehe" value="retiehe">SCE 云服务</NRadioButton>
          <NRadioButton value="webdav">WebDAV 网盘</NRadioButton>
        </NRadioGroup>
        <p class="hint-text">将在打开云工作区窗口时默认选中此目标。</p>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <div class="action-buttons">
        <NButton
          v-if="hasWebdavConfigured"
          attr-type="button"
          type="error"
          secondary
          @click="clearConfig"
          :disabled="loading"
        >
          断开/清空WebDAV
        </NButton>
        <NButton
          attr-type="button"
          class="submit-button"
          type="primary"
          @click="handleSave"
          :loading="loading"
        >
          {{ loading ? '验证并保存中...' : '验证并保存至账号数据库' }}
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NRadioButton, NRadioGroup, NSwitch, NAlert, NFlex } from 'naive-ui'
import { ref, computed, watch } from 'vue'
import { Info } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'
import { useLogger } from '@/composables/useLogger'
import { getRetieheApiBase, setRetieheApiBase } from '@/platform/apiClient'
import { isTauriRuntime } from '@/platform/runtime'
import type { AuthType, WebDavConfig } from '@/types/models'

const { webdavConfig, backupMode, updateSyncSettings, authType, setAuthType, token } = useAuth()
const { mkcol } = useWebDav()
const { success: showSuccess, error: showError } = useLogger()

const webdavUrl = ref('')
const webdavUser = ref('')
const webdavPass = ref('')
const retieheApiBase = ref(getRetieheApiBase())
const enableBackup = ref(false)
const preferredSync = ref<AuthType>('retiehe')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isDesktopRuntime = isTauriRuntime()

const hasRetiehe = computed(() => !!token.value)
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
    if (isDesktopRuntime) {
      setRetieheApiBase(retieheApiBase.value)
    }

    let finalConfig: WebDavConfig | null = null

    if (isComplete) {
      finalConfig = {
        url: webdavUrl.value.trim(),
        username: webdavUser.value.trim(),
        password: webdavPass.value.trim()
      }

      try {
        await mkcol(finalConfig, 'sce_data')
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'WebDAV 连接失败，请检查账号密码')
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
    const message = err instanceof Error ? err.message : '保存失败'
    errorMessage.value = message
    showError(message)
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

.submit-button {
  flex: 1;
}
</style>
