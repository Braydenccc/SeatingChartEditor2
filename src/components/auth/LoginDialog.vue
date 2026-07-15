<template>
  <ResponsiveOverlay :show="visible" :title="isLoginMode ? '账号登录' : '注册账号'" :busy="loading" :desktop-width="480" @update:show="value => !value && close()">
      <div class="dialog-body">
        <NTabs v-model:value="tabMode" class="tabs" type="segment" size="small">
          <NTabPane name="login" tab="登录" />
          <NTabPane name="register" tab="注册" />
          <NTabPane name="webdav" tab="WebDAV" />
        </NTabs>
        <div v-if="tabMode !== 'webdav'" class="service-warning">
          本账号服务不保证可用性，请妥善备份您的数据
        </div>
        <div v-else class="service-note">
          通过 WebDAV 连接网盘以使用云端工作区。连接需要跨域(CORS)支持。
        </div>

        <form @submit.prevent="handleSubmit">
          <template v-if="tabMode === 'webdav'">
            <div class="form-group">
              <label>服务器地址(URL)</label>
              <NInput
                type="text"
                v-model:value="webdavUrl"
                placeholder="例如: https://pan.example.com/dav"
                required
                autocomplete="off"
              />
            </div>
            <div class="form-group">
              <label>用户名</label>
              <NInput
                type="text"
                v-model:value="webdavUser"
                placeholder="请输入WebDAV用户名"
                required
                autocomplete="off"
              />
            </div>
            <div class="form-group">
              <label>密码</label>
              <NInput
                type="password"
                v-model:value="webdavPass"
                show-password-on="click"
                placeholder="请输入WebDAV密码/Token"
                required
                autocomplete="new-password"
              />
            </div>
            <div class="form-group checkbox-group">
              <NCheckbox v-model:checked="rememberWebdavPassword">记住密码（加密存储到浏览器）</NCheckbox>
              <div class="checkbox-hint">
                密码将使用 AES-GCM 加密后存储在浏览器中。注意：此功能无法防止 XSS 攻击获取密钥。
              </div>
            </div>
          </template>
          
          <template v-else>
            <div class="form-group">
              <label>用户名</label>
              <NInput
                type="text"
                v-model:value="username"
                placeholder="请输入字母或数字"
                required
                maxlength="32"
                pattern="[A-Za-z0-9_\-]{1,32}"
                title="只能包含字母、数字、下划线和连字符"
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label>密码</label>
              <NInput
                type="password"
                v-model:value="password"
                show-password-on="click"
                placeholder="请输入密码"
                required
                :minlength="tabMode === 'register' ? 8 : 6"
                autocomplete="current-password"
              />
              <div v-if="tabMode === 'register' && passwordValidation" class="password-requirements">
                <div :class="['requirement', { met: passwordValidation.length }]">
                  <Check v-if="passwordValidation.length" :size="12" stroke-width="3" />
                  至少 8 个字符
                </div>
                <div :class="['requirement', { met: passwordValidation.uppercase }]">
                  <Check v-if="passwordValidation.uppercase" :size="12" stroke-width="3" />
                  包含大写字母
                </div>
                <div :class="['requirement', { met: passwordValidation.lowercase }]">
                  <Check v-if="passwordValidation.lowercase" :size="12" stroke-width="3" />
                  包含小写字母
                </div>
                <div :class="['requirement', { met: passwordValidation.number }]">
                  <Check v-if="passwordValidation.number" :size="12" stroke-width="3" />
                  包含数字
                </div>
              </div>
            </div>
          </template>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-message">
            {{ successMessage }}
          </div>

          <div class="dialog-actions">
            <NButton attr-type="submit" class="btn-primary" type="primary" block :loading="loading">
              {{ loading ? '处理中...' : (tabMode === 'login' ? '登录' : (tabMode === 'register' ? '注册并登录' : '连接并创建文件夹')) }}
            </NButton>
          </div>
        </form>
      </div>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NButton, NCheckbox, NInput, NTabPane, NTabs } from 'naive-ui'
import { Check } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'
import { validatePasswordStrength, PASSWORD_MIN_LENGTH } from '@/utils/passwordValidator'

const props = defineProps({
  visible: Boolean,
  initialTab: {
    type: String,
    default: 'login'
  }
})

const emit = defineEmits(['update:visible', 'success'])

const { login, register, setWebdavLogin } = useAuth()
const { mkcol } = useWebDav()

const tabMode = ref('login') // 'login', 'register', 'webdav'
const username = ref('')
const password = ref('')
const webdavUrl = ref('')
const webdavUser = ref('')
const webdavPass = ref('')
const rememberWebdavPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isLoginMode = computed(() => tabMode.value === 'login')

const passwordValidation = computed(() => {
  if (tabMode.value !== 'register' || !password.value) return null
  return validatePasswordStrength(password.value)
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Reset form when opened
    username.value = ''
    password.value = ''
    errorMessage.value = ''
    successMessage.value = ''
    tabMode.value = props.initialTab || 'login'
  }
})

const close = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  
  if (tabMode.value === 'webdav') {
    if (!webdavUrl.value.trim() || !webdavUser.value.trim() || !webdavPass.value.trim()) {
      errorMessage.value = '请填写完整的 WebDAV 信息'
      return
    }
    
    loading.value = true
    try {
      const config = {
        url: webdavUrl.value.trim(),
        username: webdavUser.value.trim(),
        password: webdavPass.value.trim()
      }
      // 验证连接并创建 sce_data 文件夹
      await mkcol(config, 'sce_data')

      setWebdavLogin(config, rememberWebdavPassword.value)
      successMessage.value = 'WebDAV 连接并初始化成功'
      setTimeout(() => {
        close()
        emit('success')
      }, 500)
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'WebDAV 连接失败，请检查账号密码或CORS设置'
    } finally {
      loading.value = false
    }
    return
  }

  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = '用户名和密码不能为空'
    return
  }

  if (tabMode.value === 'register') {
    const validation = validatePasswordStrength(password.value)
    if (!validation.isValid) {
      errorMessage.value = '密码必须至少 8 个字符，且包含大小写字母和数字'
      return
    }
  }

  loading.value = true

  const action = tabMode.value === 'login' ? login : register
  const result = await action(username.value.trim(), password.value)

  if (result.success) {
    successMessage.value = result.message ?? '操作成功'
    setTimeout(() => {
      close()
      emit('success')
    }, 500)
  } else {
    errorMessage.value = result.message || '操作失败，请重试'
  }

  loading.value = false
}
</script>

<style scoped>

.dialog-body {
  min-width: 0;
}

.tabs {
  margin-bottom: 20px;
}

.service-warning,
.service-note {
  margin-bottom: 16px;
  font-size: 13px;
  text-align: center;
}

.service-warning {
  color: var(--color-danger-text);
}

.service-note {
  color: var(--color-text-muted);
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

.error-message {
  color: var(--color-danger);
  font-size: 13px;
  margin-bottom: 16px;
  background: var(--color-danger-bg);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--color-danger);
}

.success-message {
  color: var(--color-success);
  font-size: 13px;
  margin-bottom: 16px;
  background: var(--color-success-bg);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--color-success);
}

.dialog-actions {
  margin-top: 24px;
}

.password-requirements {
  margin-top: 8px;
  font-size: 12px;
}

.requirement {
  min-height: 18px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-disabled);
  padding: 2px 0;
}

.requirement.met {
  color: var(--color-success);
}

.checkbox-group {
  margin-bottom: 16px;
}


.checkbox-hint {
  font-size: 12px;
  color: var(--color-warning);
  background: var(--color-warning-bg);
  padding: 6px 10px;
  border-radius: 4px;
  border-left: 3px solid var(--color-warning);
  line-height: 1.4;
}
</style>
