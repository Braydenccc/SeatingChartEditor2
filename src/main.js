import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.mount('#app')

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
