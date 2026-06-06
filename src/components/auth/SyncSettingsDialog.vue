<template>
  <div v-if="visible" class="login-overlay" @mousedown.self="close">
    <div class="login-dialog">
      <div class="dialog-header">
        <h3>同步设置</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="dialog-body">
        <div class="info-text">
          配置 WebDAV 网盘后可开启自动备份，实现工作区双重归档。
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>服务器地址(URL)</label>
            <input 
              type="url" 
              v-model="webdavUrl" 
              placeholder="例如: https://pan.example.com/dav" 
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label>用户名</label>
            <input 
              type="text" 
              v-model="webdavUser" 
              placeholder="请输入WebDAV用户名" 
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label>密码/授权码</label>
            <input 
              type="password" 
              v-model="webdavPass" 
              placeholder="请输入WebDAV密码/Token" 
              autocomplete="new-password"
            />
          </div>
          
          <div class="form-group backup-mode-group">
            <label class="switch-label">
              <input type="checkbox" v-model="enableBackup">
              <span class="switch-text" :class="{active: enableBackup}">开启自动备份模式</span>
            </label>
            <p v-if="enableBackup" class="hint-text hint-green">备份模式开启：工作区列表将以 SCE 云为主视角，保存/删除同时将静默同步至 WebDAV。</p>
            <p v-else class="hint-text">关闭时可单独使用 WebDAV 或 SCE 云，或将两者同时指定为可切换的独立写入目标。</p>
          </div>

          <!-- 首选同步项：只有在非备份模式且有 WebDAV 配置时才显示 -->
          <div class="form-group sync-preference-group" v-if="!enableBackup && (hasWebdavConfigured || hasAnyWebdavInput)">
            <label class="section-label">云工作区默认读写目标</label>
            <div class="radio-selection">
              <label class="radio-label" v-if="hasRetiehe">
                 <input type="radio" value="retiehe" v-model="preferredSync">
                 <span>SCE 云服务</span>
              </label>
              <label class="radio-label">
                 <input type="radio" value="webdav" v-model="preferredSync">
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

          <div class="dialog-actions">
             <button type="button" v-if="hasWebdavConfigured" class="btn-secondary" @click="clearConfig" :disabled="loading">
              断开/清空WebDAV
            </button>
            <button type="submit" class="btn-primary" :disabled="loading">
              {{ loading ? '验证并保存中...' : '验证并保存至账号数据库' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

const { webdavConfig, backupMode, updateSyncSettings, authType, setAuthType, token } = useAuth()
const { mkcol } = useWebDav()

const webdavUrl = ref('')
const webdavUser = ref('')
const webdavPass = ref('')
const enableBackup = ref(false)
const preferredSync = ref('retiehe')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const hasRetiehe = computed(() => !!token.value)

const hasWebdavConfigured = computed(() => !!webdavConfig.value)
const hasAnyWebdavInput = computed(() => !!(webdavUrl.value.trim() || webdavUser.value.trim() || webdavPass.value.trim()))

watch(() => props.visible, (newVal) => {
  if (newVal) {
    errorMessage.value = ''
    successMessage.value = ''
    // 先设置 enableBackup
    enableBackup.value = backupMode.value
    // 在 enableBackup 设置完后再初始化 preferredSync
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
})

const close = () => {
  emit('update:visible', false)
}

const clearConfig = async () => {
    loading.value = true
    try {
        const result = await updateSyncSettings(null, false)
        if (result.success) {
            setAuthType('retiehe')
            successMessage.value = 'WebDAV 配置已清空'
        } else {
            errorMessage.value = '清空失败: ' + result.message
        }
    } catch(e) {
        errorMessage.value = '网络请求失败'
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
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
    
    // 如果用户填了完整的 WebDAV 信息，测试连通性
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
    
    // 把设置更新到服务器
    const result = await updateSyncSettings(finalConfig, enableBackup.value)
    if (result.success) {
      if (enableBackup.value || !isComplete) {
        setAuthType('retiehe')
      } else {
        setAuthType(preferredSync.value)
      }
      
      successMessage.value = '设置保存成功并已同步至数据库！'
    } else {
      errorMessage.value = '数据库保存失败: ' + result.message
    }
  } catch (err) {
    errorMessage.value = err.message || '异常错误'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.login-dialog {
  background: var(--color-surface);
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-text-secondary);
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: var(--color-danger);
}

.dialog-body {
  padding: 20px;
}

.info-text {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-bottom: 20px;
  line-height: 1.5;
  background: var(--color-bg-subtle);
  padding: 12px;
  border-radius: 6px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="url"],
.form-group input[type="password"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.backup-mode-group, .sync-preference-group {
    background: var(--color-bg-subtle);
    border: 1px dashed var(--color-border-strong);
    padding: 14px;
    border-radius: 6px;
    margin-top: 16px;
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

.sync-preference-group .radio-selection {
    display: flex;
    gap: 20px;
}

.sync-preference-group .radio-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text-primary);
}

.sync-preference-group .radio-label input[type="radio"] {
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

.switch-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    margin-bottom: 0 !important;
}

.switch-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin-right: 8px;
    cursor: pointer;
}

.switch-text {
    font-size: 14px;
    color: var(--color-text-secondary);
    font-weight: 600;
}

.switch-text.active {
    color: var(--color-info);
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

.dialog-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.btn-primary {
  flex: 1;
  padding: 12px;
  background: var(--color-primary);
  color: var(--color-surface);
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.btn-primary:disabled, .btn-secondary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-secondary {
   padding: 12px 18px;
   background: var(--color-surface);
   color: var(--color-danger);
   border: 1px solid var(--color-danger);
   border-radius: 6px;
   font-size: 14px;
   cursor: pointer;
   transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
    background: var(--color-danger-bg);
}
</style>
