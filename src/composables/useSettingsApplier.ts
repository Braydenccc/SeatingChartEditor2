import { watch, onMounted } from 'vue'
import { useGlobalSettings } from './useGlobalSettings'
import { useZoom } from './useZoom'
import { useUndo } from './useUndo'

/**
 * 应用全局设置到各个功能模块
 * 这个 composable 负责将设置值同步到实际功能中
 */
export function useSettingsApplier() {
  const { settings } = useGlobalSettings()
  const { setScale } = useZoom()

  // 应用 UI 设置
  const applyUISettings = () => {
    const uiSettings = settings.value.ui

    // 应用主题色
    if (uiSettings.themeColor) {
      document.documentElement.style.setProperty('--color-primary', uiSettings.themeColor)
    }

    // 应用默认缩放（仅在初始化时）
    if (uiSettings.defaultZoom && uiSettings.defaultZoom >= 50 && uiSettings.defaultZoom <= 200) {
      setScale(uiSettings.defaultZoom / 100)
    }

    // 应用动画设置
    if (uiSettings.enableAnimations !== undefined) {
      document.documentElement.classList.toggle('disable-animations', !uiSettings.enableAnimations)
    }
  }

  // 应用编辑器设置
  const applyEditorSettings = () => {
    const editorSettings = settings.value.editor

    // 撤销历史大小
    if (editorSettings.undoHistorySize) {
      const { setMaxHistory } = useUndo()
      if (setMaxHistory) {
        setMaxHistory(editorSettings.undoHistorySize)
      }
    }
  }

  // 初始化时应用所有设置
  onMounted(() => {
    applyUISettings()
    applyEditorSettings()
  })

  // 监听设置变化并实时应用
  watch(() => settings.value.ui.themeColor, (newColor) => {
    if (newColor) {
      document.documentElement.style.setProperty('--color-primary', newColor)
    }
  })

  watch(() => settings.value.ui.enableAnimations, (enabled) => {
    document.documentElement.classList.toggle('disable-animations', !enabled)
  })

  return {
    applyUISettings,
    applyEditorSettings
  }
}
