import { ref } from 'vue'
import { safeStorageGet, safeStorageSet } from '@/utils/storage'

export const welcomeSeenStorageKey = 'sce-welcome-seen'
export const welcomeVersion = 'v1'

const isWelcomeIntroVisible = ref(false)

export const hasSeenWelcome = () => safeStorageGet(welcomeSeenStorageKey) === welcomeVersion

export const markWelcomeSeen = () => safeStorageSet(welcomeSeenStorageKey, welcomeVersion)

export const openWelcomeIntro = () => {
  isWelcomeIntroVisible.value = true
}

export const closeWelcomeIntro = () => {
  isWelcomeIntroVisible.value = false
}

export const showWelcomeIntroIfNeeded = () => {
  if (!hasSeenWelcome()) {
    openWelcomeIntro()
  }
}

export const dismissWelcomeIntro = () => {
  markWelcomeSeen()
  closeWelcomeIntro()
}

export function useWelcomeOnboarding() {
  return {
    isWelcomeIntroVisible,
    hasSeenWelcome,
    markWelcomeSeen,
    openWelcomeIntro,
    closeWelcomeIntro,
    showWelcomeIntroIfNeeded,
    dismissWelcomeIntro
  }
}
