import './assets/main.css'
import './styles/touch-optimization.css'

import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

const renderFatalError = (error) => {
  const appRoot = document.getElementById('app')
  if (!appRoot) return

  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  appRoot.innerHTML = `
    <div class="fatal-error-screen">
      <div class="fatal-error-card">
        <h1>应用启动失败</h1>
        <p>请截图这段信息反馈给开发者：</p>
        <pre>${message}</pre>
      </div>
    </div>
  `
}

app.config.errorHandler = (error) => {
  console.error('Vue runtime error:', error)
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

try {
  app.mount('#app')
} catch (error) {
  console.error('App mount failed:', error)
  renderFatalError(error)
}

// 隐藏初始 loading 占位符
function hideLoading() {
  const loading = document.getElementById('initial-loading')
  if (loading) {
    loading.style.display = 'none'
  }
}

// 确保 DOM 挂载完成后隐藏 loading
if (document.readyState === 'complete') {
  setTimeout(hideLoading, 100)
} else {
  window.addEventListener('load', () => {
    setTimeout(hideLoading, 100)
  })
}
