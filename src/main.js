const hideLoading = () => {
  if (typeof window.__SCE_HIDE_INITIAL_LOADING__ === 'function') {
    window.__SCE_HIDE_INITIAL_LOADING__()
    return
  }

  const loading = document.getElementById('initial-loading')
  if (loading) {
    loading.style.display = 'none'
  }
}

const renderFatalError = (error) => {
  const appRoot = document.getElementById('app')
  if (!appRoot) return

  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)

  // 使用 DOM API 创建元素，避免 innerHTML XSS 风险；保留关键布局样式，确保 CSS 加载失败时也可见。
  const errorScreen = document.createElement('div')
  errorScreen.className = 'fatal-error-screen'
  errorScreen.style.minHeight = '100vh'
  errorScreen.style.display = 'flex'
  errorScreen.style.alignItems = 'center'
  errorScreen.style.justifyContent = 'center'
  errorScreen.style.padding = '24px'
  errorScreen.style.boxSizing = 'border-box'

  const errorCard = document.createElement('div')
  errorCard.className = 'fatal-error-card'
  errorCard.style.width = 'min(720px, 100%)'
  errorCard.style.padding = '20px'
  errorCard.style.borderRadius = '12px'

  const title = document.createElement('h1')
  title.textContent = '应用启动失败'
  title.style.margin = '0 0 12px'
  title.style.fontSize = '20px'

  const description = document.createElement('p')
  description.textContent = '请截图这段信息反馈给开发者：'
  description.style.margin = '0 0 12px'

  const pre = document.createElement('pre')
  pre.textContent = message
  pre.style.margin = '0'
  pre.style.padding = '12px'
  pre.style.borderRadius = '8px'
  pre.style.whiteSpace = 'pre-wrap'
  pre.style.wordBreak = 'break-word'

  errorCard.appendChild(title)
  errorCard.appendChild(description)
  errorCard.appendChild(pre)
  errorScreen.appendChild(errorCard)

  appRoot.textContent = ''
  appRoot.appendChild(errorScreen)
  hideLoading()
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

const bootstrap = async () => {
  await import('./assets/main.css')
  await import('./styles/touch-optimization.css')
  await import('./styles/disable-animations.css')

  const [{ createApp }, { default: App }, { default: router }] = await Promise.all([
    import('vue'),
    import('./App.vue'),
    import('./router')
  ])

  const app = createApp(App)
  app.use(router)

  app.config.errorHandler = (error) => {
    console.error('Vue runtime error:', error)
  }

  await router.isReady()
  app.mount('#app')
  const appRoot = document.getElementById('app')
  if (appRoot) {
    appRoot.dataset.ready = 'true'
  }
  await new Promise((resolve) => requestAnimationFrame(resolve))
  hideLoading()
}

bootstrap().catch((error) => {
  console.error('App bootstrap failed:', error)
  renderFatalError(error)
})
