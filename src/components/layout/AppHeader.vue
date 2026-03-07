<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="header-text">BraydenSCE V2</h1>
      <div v-if="isLoggedIn" class="user-info">
        <span class="welcome-text">欢迎, {{ currentUser.username }}</span>
        <button class="auth-btn logout-btn" @click="logout">登出</button>
      </div>
      <button v-else class="auth-btn login-btn" @click="emit('open-login')">登录 / 注册</button>
    </div>
    <div class="header-right">
      <p class="header-subtitle">座位表编辑器 开发版本 <a href="https://afdian.com/a/brayden" target="_blank">byccc</a> 由<a href="https://host.retiehe.com/" target="_blank">热铁盒网页托管</a>提供服务</p>
      <a href="https://github.com/Braydenccc/SeatingCrartEditor2" target="_blank" class="github-link" title="Source Code">
        <svg height="28" viewBox="0 0 16 16" version="1.1" width="28" fill="currentColor">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
        </svg>
      </a>
    </div>
  </header>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits(['open-login'])

const { currentUser, isLoggedIn, logout, initAuth } = useAuth()

onMounted(() => {
  initAuth()
})
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: linear-gradient(135deg, #23587b 0%, #2d6a94 100%);
  height: 100px;
  color: aliceblue;
  padding: 0 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-text {
  margin: 0;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 1px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 16px;
  border-radius: 20px;
}

.welcome-text {
  font-size: 15px;
  font-weight: 500;
}

.auth-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
}

.login-btn {
  background: rgba(255, 255, 255, 0.15);
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-subtitle {
  margin: 0;
  font-size: 20px;
  opacity: 0.9;
  font-weight: 300;
}

.header-subtitle a {
  color: #f0f0f0;
  text-decoration: underline;
}

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0f0f0;
  transition: opacity 0.2s, transform 0.2s;
}

.github-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* 响应式设计 - 平板 */
@media (max-width: 1024px) {
  .app-header {
    padding: 0 20px;
    height: 90px;
  }

  .header-text {
    font-size: 28px;
  }

  .header-subtitle {
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .app-header {
    flex-direction: row;
    position: relative;
    justify-content: center; /* Center the h1 */
    align-items: center;
    gap: 0;
    height: 48px;
    padding: 0 16px;
  }

  .header-left {
    gap: 12px;
  }

  .header-text {
    font-size: 18px;
    letter-spacing: 0.5px;
  }

  .user-info {
    padding: 4px 10px;
    gap: 8px;
  }
  
  .welcome-text {
    font-size: 13px;
    max-width: 80px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .auth-btn {
    padding: 4px 8px;
    font-size: 12px;
  }

  .header-right {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
  }

  .header-subtitle {
    display: none;
  }
}
</style>
