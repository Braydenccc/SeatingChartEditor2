import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebar } from '../useSidebar'

describe('useSidebar', () => {
  let sidebar

  beforeEach(() => {
    sidebar = useSidebar()
    sidebar.closeMobileMenu()
  })

  describe('initial state', () => {
    it('should have default activeTab as 1', () => {
      const { activeTab } = useSidebar()

      expect(activeTab.value).toBe(1)
    })

    it('should have mobileMenuOpen as false by default', () => {
      const { mobileMenuOpen } = sidebar

      expect(mobileMenuOpen.value).toBe(false)
    })
  })

  describe('setActiveTab', () => {
    it('should change activeTab', () => {
      const { activeTab, setActiveTab } = sidebar

      setActiveTab(2)

      expect(activeTab.value).toBe(2)
    })

    it('should open mobile menu when tab changes', () => {
      const { mobileMenuOpen, setActiveTab } = sidebar

      setActiveTab(2)

      expect(mobileMenuOpen.value).toBe(true)
    })

    it('should close mobile menu when clicking same tab while open', () => {
      const { activeTab, mobileMenuOpen, setActiveTab } = sidebar

      setActiveTab(2)
      expect(mobileMenuOpen.value).toBe(true)

      setActiveTab(2)
      expect(mobileMenuOpen.value).toBe(false)
    })

    it('should open menu when clicking different tab', () => {
      const { activeTab, mobileMenuOpen, setActiveTab } = sidebar

      setActiveTab(1)
      setActiveTab(2)

      expect(activeTab.value).toBe(2)
      expect(mobileMenuOpen.value).toBe(true)
    })
  })

  describe('closeMobileMenu', () => {
    it('should close mobile menu', () => {
      const { mobileMenuOpen, setActiveTab, closeMobileMenu } = sidebar

      setActiveTab(2)
      expect(mobileMenuOpen.value).toBe(true)

      closeMobileMenu()
      expect(mobileMenuOpen.value).toBe(false)
    })

    it('should not change activeTab when closing', () => {
      const { activeTab, setActiveTab, closeMobileMenu } = sidebar

      setActiveTab(3)
      closeMobileMenu()

      expect(activeTab.value).toBe(3)
    })
  })
})
