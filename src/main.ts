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

const preloadReloadStorageKey = 'sce:preload-error-reloaded'
const preloadReloadQueryParam = 'sce-preload-reloaded'
export const preloadRecoveryEventName = 'sce:preload-recovery-needed'
const preloadRecoveryNoticeId = 'preload-recovery-notice'

export interface PreloadRecoveryEventDetail {
  phase: 'runtime'
  payload: unknown
}

const getCurrentUrl = () => {
  try {
    return new URL(window.location.href)
  } catch {
    return null
  }
}

const hasReloadedForPreloadError = () => {
  const currentUrl = getCurrentUrl()
  if (currentUrl?.searchParams.get(preloadReloadQueryParam) === '1') {
    return true
  }

  try {
    return sessionStorage.getItem(preloadReloadStorageKey) === '1'
  } catch {
    return false
  }
}

const reloadAfterPreloadError = () => {
  try {
    sessionStorage.setItem(preloadReloadStorageKey, '1')
  } catch {
    // sessionStorage 不可用时使用 URL 标记兜底。
  }

  const currentUrl = getCurrentUrl()
  if (currentUrl) {
    currentUrl.searchParams.set(preloadReloadQueryParam, '1')
    window.location.replace(currentUrl.toString())
    return
  }

  window.location.reload()
}

const clearPreloadErrorReloadMark = () => {
  try {
    sessionStorage.removeItem(preloadReloadStorageKey)
  } catch {
    // 忽略存储异常，避免影响正常启动。
  }

  const currentUrl = getCurrentUrl()
  if (currentUrl?.searchParams.has(preloadReloadQueryParam)) {
    currentUrl.searchParams.delete(preloadReloadQueryParam)
    window.history.replaceState(window.history.state, '', currentUrl.toString())
  }
}

const renderFatalError = (error: unknown) => {
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

const isAppReady = () => document.getElementById('app')?.dataset.ready === 'true'

const renderPreloadRecoveryNotice = () => {
  if (document.getElementById(preloadRecoveryNoticeId)) return

  const notice = document.createElement('section')
  notice.id = preloadRecoveryNoticeId
  notice.dataset.scePreloadRecovery = 'required'
  notice.setAttribute('role', 'alert')
  notice.setAttribute('aria-live', 'assertive')
  notice.style.position = 'fixed'
  notice.style.right = '16px'
  notice.style.bottom = '16px'
  notice.style.zIndex = '10000'
  notice.style.width = 'min(420px, calc(100vw - 32px))'
  notice.style.padding = '16px'
  notice.style.boxSizing = 'border-box'
  notice.style.border = '1px solid var(--color-border-strong, currentColor)'
  notice.style.borderRadius = '12px'
  notice.style.background = 'var(--color-surface, Canvas)'
  notice.style.color = 'var(--color-text-primary, CanvasText)'
  notice.style.boxShadow = '0 8px 24px color-mix(in srgb, var(--color-text-primary, CanvasText) 18%, transparent)'

  const title = document.createElement('strong')
  title.textContent = '部分功能资源加载失败'
  title.style.display = 'block'
  title.style.marginBottom = '6px'

  const description = document.createElement('p')
  description.textContent = '当前编辑内容仍保留在页面中。可以继续使用已加载的功能，或手动刷新后重试。'
  description.style.margin = '0 0 12px'
  description.style.color = 'var(--color-text-secondary, currentColor)'
  description.style.fontSize = '13px'
  description.style.lineHeight = '1.6'

  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.justifyContent = 'flex-end'
  actions.style.gap = '8px'

  const dismissButton = document.createElement('button')
  dismissButton.type = 'button'
  dismissButton.textContent = '稍后处理'
  dismissButton.style.minHeight = '36px'
  dismissButton.style.padding = '0 14px'
  dismissButton.style.border = '1px solid var(--color-border, currentColor)'
  dismissButton.style.borderRadius = '8px'
  dismissButton.style.background = 'var(--color-surface, Canvas)'
  dismissButton.style.color = 'inherit'
  dismissButton.addEventListener('click', () => notice.remove())

  const reloadButton = document.createElement('button')
  reloadButton.type = 'button'
  reloadButton.textContent = '刷新重试'
  reloadButton.style.minHeight = '36px'
  reloadButton.style.padding = '0 14px'
  reloadButton.style.border = '1px solid var(--color-primary, currentColor)'
  reloadButton.style.borderRadius = '8px'
  reloadButton.style.background = 'var(--color-primary, CanvasText)'
  reloadButton.style.color = 'var(--color-text-inverse, Canvas)'
  reloadButton.addEventListener('click', reloadAfterPreloadError)

  actions.append(dismissButton, reloadButton)
  notice.append(title, description, actions)
  document.body.appendChild(notice)
}

const reportRecoverablePreloadError = (payload: unknown) => {
  const appRoot = document.getElementById('app')
  if (appRoot) appRoot.dataset.preloadRecovery = 'required'

  window.dispatchEvent(new CustomEvent<PreloadRecoveryEventDetail>(preloadRecoveryEventName, {
    detail: { phase: 'runtime', payload }
  }))
  renderPreloadRecoveryNotice()
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  console.error('Vite preload error:', event.payload)

  if (isAppReady()) {
    reportRecoverablePreloadError(event.payload)
    return
  }

  if (!hasReloadedForPreloadError()) {
    reloadAfterPreloadError()
    return
  }

  renderFatalError(new Error('应用资源加载失败。请手动刷新页面，或清理浏览器缓存后重试。'))
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
  clearPreloadErrorReloadMark()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  hideLoading()
}

bootstrap().catch((error) => {
  console.error('App bootstrap failed:', error)
  renderFatalError(error)
})
