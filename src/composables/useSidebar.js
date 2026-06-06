import { ref, computed } from 'vue'

const activeTab = ref(1)
const mobileMenuOpen = ref(false)
const validTabs = new Set([1, 2])

export function useSidebar() {
  const setActiveTab = (tabNumber) => {
    if (!validTabs.has(tabNumber)) return

    if (activeTab.value === tabNumber && mobileMenuOpen.value) {
      // 再次点击同一 tab → 收起面板
      mobileMenuOpen.value = false
    } else {
      activeTab.value = tabNumber
      mobileMenuOpen.value = true
    }
  }

  const closeMobileMenu = () => {
    mobileMenuOpen.value = false
  }

  return {
    activeTab,
    mobileMenuOpen,
    setActiveTab,
    closeMobileMenu
  }
}
