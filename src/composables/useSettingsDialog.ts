import { ref } from 'vue'
import router from '@/router'

const visible = ref(false)
const initialTab = ref('global')
const initialCategory = ref('ui')

export function useSettingsDialog() {
  const openSettings = (tab?: string, category?: string) => {
    if (tab) initialTab.value = tab
    else initialTab.value = 'global'
    if (category) initialCategory.value = category
    else initialCategory.value = 'sync'
    visible.value = false
    return router.push({
      path: '/settings',
      query: {
        tab: initialTab.value,
        category: initialCategory.value
      }
    })
  }

  const closeSettings = () => {
    visible.value = false
  }

  return {
    visible,
    initialTab,
    initialCategory,
    openSettings,
    closeSettings
  }
}
