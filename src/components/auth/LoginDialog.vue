<template>
  <div v-if="visible" class="login-overlay" @mousedown.self="close">
    <div class="login-dialog">
      <div class="dialog-header">
        <h3>{{ isLoginMode ? '账号登录' : '注册账号' }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="dialog-body">
        <div class="tabs">
          <button :class="{ active: tabMode === 'login' }" @click="tabMode = 'login'">登录</button>
          <button :class="{ active: tabMode === 'register' }" @click="tabMode = 'register'">注册</button>
          <button :class="{ active: tabMode === 'webdav' }" @click="tabMode = 'webdav'">WebDAV</button>
        </div>
        <div v-if="tabMode !== 'webdav'" style="color: #ef4444; font-size: 13px; margin-bottom: 16px; text-align: center;">
          本账号服务不保证可用性，请妥善备份您的数据
        </div>
        <div v-else style="color: #64748b; font-size: 13px; margin-bottom: 16px; text-align: center;">
          通过 WebDAV 连接网盘以使用云端工作区。连接需要跨域(CORS)支持。
        </div>

        <form @submit.prevent="handleSubmit">
          <template v-if="tabMode === 'webdav'">
            <div class="form-group">
              <label>服务器地址(URL)</label>
              <input 
                type="url" 
                v-model="webdavUrl" 
                placeholder="例如: https://pan.example.com/dav" 
                required 
                autocomplete="off"
              />
            </div>
            <div class="form-group">
              <label>用户名</label>
              <input 
                type="text" 
                v-model="webdavUser" 
                placeholder="请输入WebDAV用户名" 
                required 
                autocomplete="off"
              />
            </div>
            <div class="form-group">
              <label>密码</label>
              <input 
                type="password" 
                v-model="webdavPass" 
                placeholder="请输入WebDAV密码/Token" 
                required 
                autocomplete="new-password"
              />
            </div>
          </template>
          
          <template v-else>
            <div class="form-group">
              <label>用户名</label>
              <input 
                type="text" 
                v-model="username" 
                placeholder="请输入字母或数字" 
                required 
                maxlength="32"
                pattern="[A-Za-z0-9_-]{1,32}"
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
          </template>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-message">
            {{ successMessage }}
          </div>

          <div class="dialog-actions">
            <button type="submit" class="btn-primary" :disabled="loading">
              {{ loading ? '处理中...' : (tabMode === 'login' ? '登录' : (tabMode === 'register' ? '注册并登录' : '连接并创建文件夹')) }}
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
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isLoginMode = computed(() => tabMode.value === 'login')

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
      
      setWebdavLogin(config)
      successMessage.value = 'WebDAV 连接并初始化成功'
      setTimeout(() => {
        close()
        emit('success')
      }, 500)
    } catch (err) {
      errorMessage.value = err.message || 'WebDAV 连接失败，请检查账号密码或CORS设置'
    } finally {
      loading.value = false
    }
    return
  }

  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = '用户名和密码不能为空'
    return
  }

  loading.value = true
  
  try {
    const action = tabMode.value === 'login' ? login : register
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
  background: #23587b;
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
