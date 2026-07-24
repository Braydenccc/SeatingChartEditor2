<template>
  <ResponsiveOverlay :show="visible" :title="dialogTitle" :busy="loading" :desktop-width="480" @update:show="value => !value && close()">
      <div class="dialog-body">
        <NTabs v-model:value="tabMode" class="tabs" type="segment" size="small">
          <NTabPane
            v-for="mode in accountTabModes"
            :key="mode.value"
            :name="mode.value"
            :tab="mode.label"
            :disabled="loading"
          >
            <div class="tab-content">
              <div class="service-warning">本账号服务不保证可用性，请妥善备份您的数据</div>
              <form @submit.prevent="handleSubmit">
                <div class="form-group">
                  <label :for="accountInputId(mode.value, 'username')">用户名</label>
                  <NInput
                    v-model:value="username"
                    type="text"
                    placeholder="请输入字母或数字"
                    required
                    :maxlength="ACCOUNT_USERNAME_MAX_LENGTH"
                    autocomplete="username"
                    :input-props="inputAccessibilityProps(accountInputId(mode.value, 'username'), 'username')"
                    @update:value="clearInvalidField('username')"
                  />
                </div>

                <div class="form-group">
                  <label :for="accountInputId(mode.value, 'password')">密码</label>
                  <NInput
                    v-model:value="password"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入密码"
                    required
                    :minlength="mode.value === 'register' ? PASSWORD_MIN_LENGTH : 6"
                    :autocomplete="mode.value === 'register' ? 'new-password' : 'current-password'"
                    :input-props="inputAccessibilityProps(
                      accountInputId(mode.value, 'password'),
                      'password',
                      mode.value === 'register' ? passwordRequirementsId : undefined
                    )"
                    @update:value="clearInvalidField('password')"
                  />
                  <div
                    v-if="mode.value === 'register' && passwordValidation"
                    :id="passwordRequirementsId"
                    class="password-requirements"
                    role="list"
                    aria-live="polite"
                  >
                    <div role="listitem" :class="['requirement', { met: passwordValidation.length }]">
                      <Check v-if="passwordValidation.length" :size="12" stroke-width="3" aria-hidden="true" />
                      <span>至少 {{ PASSWORD_MIN_LENGTH }} 个字符</span>
                      <span class="sr-only">，{{ passwordValidation.length ? '已满足' : '未满足' }}</span>
                    </div>
                    <div role="listitem" :class="['requirement', { met: passwordValidation.uppercase }]">
                      <Check v-if="passwordValidation.uppercase" :size="12" stroke-width="3" aria-hidden="true" />
                      <span>包含大写字母</span>
                      <span class="sr-only">，{{ passwordValidation.uppercase ? '已满足' : '未满足' }}</span>
                    </div>
                    <div role="listitem" :class="['requirement', { met: passwordValidation.lowercase }]">
                      <Check v-if="passwordValidation.lowercase" :size="12" stroke-width="3" aria-hidden="true" />
                      <span>包含小写字母</span>
                      <span class="sr-only">，{{ passwordValidation.lowercase ? '已满足' : '未满足' }}</span>
                    </div>
                    <div role="listitem" :class="['requirement', { met: passwordValidation.number }]">
                      <Check v-if="passwordValidation.number" :size="12" stroke-width="3" aria-hidden="true" />
                      <span>包含数字</span>
                      <span class="sr-only">，{{ passwordValidation.number ? '已满足' : '未满足' }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="tabMode === mode.value && errorMessage" :id="errorMessageId" class="error-message" role="alert">{{ errorMessage }}</div>
                <div v-if="tabMode === mode.value && successMessage" class="success-message" role="status" aria-live="polite">{{ successMessage }}</div>

                <div class="dialog-actions">
                  <NButton attr-type="submit" class="btn-primary" type="primary" block :loading="loading">
                    {{ loading ? '处理中...' : (mode.value === 'login' ? '登录' : '注册并登录') }}
                  </NButton>
                </div>
              </form>
            </div>
          </NTabPane>

          <NTabPane name="webdav" tab="WebDAV" :disabled="loading">
            <div class="tab-content">
              <div class="service-note">通过 WebDAV 连接网盘以使用云端工作区。连接需要跨域(CORS)支持。</div>
              <form @submit.prevent="handleSubmit">
                <div class="form-group">
                  <label :for="webdavUrlId">服务器地址(URL)</label>
                  <NInput
                    v-model:value="webdavUrl"
                    type="text"
                    placeholder="例如: https://pan.example.com/dav"
                    required
                    autocomplete="off"
                    :input-props="inputAccessibilityProps(webdavUrlId, 'webdavUrl')"
                    @update:value="clearInvalidField('webdavUrl')"
                  />
                </div>
                <div class="form-group">
                  <label :for="webdavUserId">用户名</label>
                  <NInput
                    v-model:value="webdavUser"
                    type="text"
                    placeholder="请输入WebDAV用户名"
                    required
                    autocomplete="off"
                    :input-props="inputAccessibilityProps(webdavUserId, 'webdavUser')"
                    @update:value="clearInvalidField('webdavUser')"
                  />
                </div>
                <div class="form-group">
                  <label :for="webdavPasswordId">密码</label>
                  <NInput
                    v-model:value="webdavPass"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入WebDAV密码/Token"
                    required
                    autocomplete="new-password"
                    :input-props="inputAccessibilityProps(webdavPasswordId, 'webdavPassword')"
                    @update:value="clearInvalidField('webdavPassword')"
                  />
                </div>
                <div class="form-group checkbox-group">
                  <NCheckbox v-model:checked="rememberWebdavPassword">记住密码（加密存储到浏览器）</NCheckbox>
                  <div class="checkbox-hint">密码将使用 AES-GCM 加密后存储在浏览器中。注意：此功能无法防止 XSS 攻击获取密钥。</div>
                </div>

                <div v-if="tabMode === 'webdav' && errorMessage" :id="errorMessageId" class="error-message" role="alert">{{ errorMessage }}</div>
                <div v-if="tabMode === 'webdav' && successMessage" class="success-message" role="status" aria-live="polite">{{ successMessage }}</div>

                <div class="dialog-actions">
                  <NButton attr-type="submit" class="btn-primary" type="primary" block :loading="loading">
                    {{ loading ? '处理中...' : '连接并创建文件夹' }}
                  </NButton>
                </div>
              </form>
            </div>
          </NTabPane>
        </NTabs>
      </div>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { ref, watch, computed, useId } from 'vue'
import { NButton, NCheckbox, NInput, NTabPane, NTabs } from 'naive-ui'
import { Check } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'
import {
  ACCOUNT_USERNAME_FORMAT_MESSAGE,
  ACCOUNT_USERNAME_MAX_LENGTH,
  ACCOUNT_USERNAME_PATTERN_SOURCE,
  isValidAccountUsername
} from '@/utils/authValidation'
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

type LoginTabMode = 'login' | 'register' | 'webdav'
type LoginField = 'username' | 'password' | 'webdavUrl' | 'webdavUser' | 'webdavPassword'

const accountTabModes = [
  { value: 'login', label: '登录' },
  { value: 'register', label: '注册' }
] as const

const normalizeTabMode = (value: unknown): LoginTabMode => (
  value === 'register' || value === 'webdav' ? value : 'login'
)

const tabMode = ref<LoginTabMode>('login')
const username = ref('')
const password = ref('')
const webdavUrl = ref('')
const webdavUser = ref('')
const webdavPass = ref('')
const rememberWebdavPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const invalidFields = ref<Set<LoginField>>(new Set())
const hasClientValidationError = ref(false)
const idPrefix = useId()
const webdavUrlId = `${idPrefix}-webdav-url`
const webdavUserId = `${idPrefix}-webdav-user`
const webdavPasswordId = `${idPrefix}-webdav-password`
const passwordRequirementsId = `${idPrefix}-password-requirements`
const errorMessageId = `${idPrefix}-error`
const accountInputId = (mode: 'login' | 'register', field: 'username' | 'password') => `${idPrefix}-${mode}-${field}`

const inputAccessibilityProps = (id: string, field: LoginField, descriptionId?: string) => {
  const isInvalid = invalidFields.value.has(field)
  const describedBy = [descriptionId, isInvalid && errorMessage.value ? errorMessageId : ''].filter(Boolean).join(' ')
  return {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': isInvalid ? true : undefined,
    ...(field === 'username' ? {
      pattern: ACCOUNT_USERNAME_PATTERN_SOURCE,
      title: ACCOUNT_USERNAME_FORMAT_MESSAGE
    } : {})
  }
}

const clearInvalidField = (field: LoginField) => {
  invalidFields.value.delete(field)
  if (invalidFields.value.size === 0 && hasClientValidationError.value) {
    errorMessage.value = ''
    hasClientValidationError.value = false
  }
}

const clearFeedback = () => {
  errorMessage.value = ''
  successMessage.value = ''
  invalidFields.value = new Set()
  hasClientValidationError.value = false
}

const dialogTitle = computed(() => ({
  login: '账号登录',
  register: '注册账号',
  webdav: '连接 WebDAV'
})[tabMode.value])

const passwordValidation = computed(() => {
  if (tabMode.value !== 'register' || !password.value) return null
  return validatePasswordStrength(password.value)
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Reset form when opened
    username.value = ''
    password.value = ''
    clearFeedback()
    tabMode.value = normalizeTabMode(props.initialTab)
  }
})

watch(tabMode, () => {
  clearFeedback()
})

const close = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  clearFeedback()
  
  if (tabMode.value === 'webdav') {
    const missingFields: LoginField[] = []
    if (!webdavUrl.value.trim()) missingFields.push('webdavUrl')
    if (!webdavUser.value.trim()) missingFields.push('webdavUser')
    if (!webdavPass.value.trim()) missingFields.push('webdavPassword')
    if (missingFields.length > 0) {
      invalidFields.value = new Set(missingFields)
      hasClientValidationError.value = true
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

  const missingFields: LoginField[] = []
  if (!username.value.trim()) missingFields.push('username')
  if (!password.value.trim()) missingFields.push('password')
  if (missingFields.length > 0) {
    invalidFields.value = new Set(missingFields)
    hasClientValidationError.value = true
    errorMessage.value = '用户名和密码不能为空'
    return
  }

  const normalizedUsername = username.value.trim()
  if (!isValidAccountUsername(normalizedUsername)) {
    invalidFields.value = new Set(['username'])
    hasClientValidationError.value = true
    errorMessage.value = ACCOUNT_USERNAME_FORMAT_MESSAGE
    return
  }

  if (tabMode.value === 'register') {
    const validation = validatePasswordStrength(password.value)
    if (!validation.isValid) {
      invalidFields.value = new Set(['password'])
      hasClientValidationError.value = true
      errorMessage.value = '密码必须至少 8 个字符，且包含大小写字母和数字'
      return
    }
  }

  loading.value = true

  const action = tabMode.value === 'login' ? login : register
  const result = await action(normalizedUsername, password.value)

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
  margin-bottom: 0;
}

.tab-content {
  padding-top: 20px;
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

.sr-only {
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
