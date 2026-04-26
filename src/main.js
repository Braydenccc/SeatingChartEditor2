import './assets/main.css'
import './styles/touch-optimization.css'
import './styles/disable-animations.css'

import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

const renderFatalError = (error) => {
  const appRoot = document.getElementById('app')
  if (!appRoot) return

  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)

  // 使用 DOM API 创建元素，避免 innerHTML XSS 风险
  const errorScreen = document.createElement('div')
  errorScreen.className = 'fatal-error-screen'

  const errorCard = document.createElement('div')
  errorCard.className = 'fatal-error-card'

  const title = document.createElement('h1')
  title.textContent = '应用启动失败'

  const description = document.createElement('p')
  description.textContent = '请截图这段信息反馈给开发者：'

  const pre = document.createElement('pre')
  pre.textContent = message

  errorCard.appendChild(title)
  errorCard.appendChild(description)
  errorCard.appendChild(pre)
  errorScreen.appendChild(errorCard)

  appRoot.textContent = ''
  appRoot.appendChild(errorScreen)
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
