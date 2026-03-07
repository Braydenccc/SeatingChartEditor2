<template>
  <div v-if="visible" class="login-overlay" @click.self="close">
    <div class="login-dialog">
      <div class="dialog-header">
        <h3>{{ isLoginMode ? '账号登录' : '注册账号' }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="dialog-body">
        <div class="tabs">
          <button :class="{ active: isLoginMode }" @click="isLoginMode = true">登录</button>
          <button :class="{ active: !isLoginMode }" @click="isLoginMode = false">注册</button>
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>用户名</label>
            <input 
              type="text" 
              v-model="username" 
              placeholder="请输入字母或数字" 
              required 
              maxlength="32"
              pattern="[A-Za-z0-9_-]+"
              title="只能包含字母、数字、下划线和连字符"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label>密码</label>
            <input 
              type="password" 
              v-model="password" 
              placeholder="请输入密码" 
              required 
              minlength="6"
              autocomplete="current-password"
            />
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-message">
            {{ successMessage }}
          </div>

          <div class="dialog-actions">
            <button type="submit" class="btn-primary" :disabled="loading">
              {{ loading ? '处理中...' : (isLoginMode ? '登录' : '注册并登录') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible', 'success'])

const { login, register } = useAuth()

const isLoginMode = ref(true)
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Reset form when opened
    username.value = ''
    password.value = ''
    errorMessage.value = ''
    successMessage.value = ''
    isLoginMode.value = true
  }
})

const close = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  
  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = '用户名和密码不能为空'
    return
  }

  loading.value = true
  
  try {
    const action = isLoginMode.value ? login : register
    const result = await action(username.value.trim(), password.value)

    if (result.success) {
      successMessage.value = result.message
      setTimeout(() => {
        close()
        emit('success')
      }, 500)
    } else {
      errorMessage.value = result.message
    }
  } catch (error) {
    errorMessage.value = '网络请求发送失败'
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.login-dialog {
  background: white;
  width: 90%;
  max-width: 360px;
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
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h3 {
  margin: 0;
  color: #23587b;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: #f44336;
}

.dialog-body {
  padding: 20px;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  border-radius: 8px;
  background: #f1f5f9;
  padding: 4px;
}

.tabs button {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tabs button.active {
  background: white;
  color: #23587b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #475569;
  font-size: 14px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #23587b;
  box-shadow: 0 0 0 3px rgba(35, 88, 123, 0.1);
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 16px;
  background: #fef2f2;
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid #ef4444;
}

.success-message {
  color: #10b981;
  font-size: 13px;
  margin-bottom: 16px;
  background: #ecfdf5;
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid #10b981;
}

.dialog-actions {
  margin-top: 24px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #23587b 0%, #2d6a94 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 88, 123, 0.2);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
