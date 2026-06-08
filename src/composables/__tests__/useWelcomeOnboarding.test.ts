import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeWelcomeIntro,
  dismissWelcomeIntro,
  hasSeenWelcome,
  markWelcomeSeen,
  openWelcomeIntro,
  showWelcomeIntroIfNeeded,
  useWelcomeOnboarding,
  welcomeSeenStorageKey,
  welcomeVersion
} from '../useWelcomeOnboarding'

describe('useWelcomeOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
    closeWelcomeIntro()
  })

  it('treats missing storage as unseen', () => {
    expect(hasSeenWelcome()).toBe(false)
  })

  it('marks the intro dialog as seen', () => {
    expect(markWelcomeSeen()).toBe(true)

    expect(localStorage.getItem(welcomeSeenStorageKey)).toBe(welcomeVersion)
    expect(hasSeenWelcome()).toBe(true)
  })

  it('opens the intro dialog only when unseen', () => {
    const { isWelcomeIntroVisible } = useWelcomeOnboarding()

    showWelcomeIntroIfNeeded()
    expect(isWelcomeIntroVisible.value).toBe(true)

    dismissWelcomeIntro()
    expect(isWelcomeIntroVisible.value).toBe(false)

    showWelcomeIntroIfNeeded()
    expect(isWelcomeIntroVisible.value).toBe(false)
  })

  it('can reopen the intro dialog manually after it has been seen', () => {
    const { isWelcomeIntroVisible } = useWelcomeOnboarding()
    markWelcomeSeen()

    openWelcomeIntro()

    expect(isWelcomeIntroVisible.value).toBe(true)
  })

  it('does not throw when storage read fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(() => hasSeenWelcome()).not.toThrow()
    expect(hasSeenWelcome()).toBe(false)
  })
})
