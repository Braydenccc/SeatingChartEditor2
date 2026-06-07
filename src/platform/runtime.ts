declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export const isTauriRuntime = () => {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

export const isWebRuntime = () => !isTauriRuntime()
