/// <reference types="vite/client" />

interface VitePreloadErrorEvent extends Event {
  payload: unknown
}

interface WindowEventMap {
  'vite:preloadError': VitePreloadErrorEvent
}

interface Window {
  __SCE_HIDE_INITIAL_LOADING__?: () => void
}
