import { ref } from 'vue'

const visible = ref(false)
const initialTab = ref('global')
const initialCategory = ref('ui')

export function useSettingsDialog() {
  const openSettings = (tab?: string, category?: string) => {
    if (tab) initialTab.value = tab
    else initialTab.value = 'global'
    if (category) initialCategory.value = category
    else initialCategory.value = 'sync'
    visible.value = true
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
