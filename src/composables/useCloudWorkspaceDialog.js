import { ref } from 'vue'
import { useAuth } from './useAuth'

const showCloudDialog = ref(false)
const cloudDialogMode = ref('load')

export function useCloudWorkspaceDialog() {
  const { isLoggedIn, isLoginDialogVisible } = useAuth()

  const openCloudLoad = () => {
    if (!isLoggedIn.value) {
      isLoginDialogVisible.value = true
      return
    }
    cloudDialogMode.value = 'load'
    showCloudDialog.value = true
  }

  const openCloudSave = () => {
    if (!isLoggedIn.value) {
      isLoginDialogVisible.value = true
      return
    }
    cloudDialogMode.value = 'save'
    showCloudDialog.value = true
  }

  const openCloudDialog = (mode = 'load') => {
    if (!isLoggedIn.value) {
      isLoginDialogVisible.value = true
      return
    }
    cloudDialogMode.value = mode
    showCloudDialog.value = true
  }

  const closeCloudDialog = () => {
    showCloudDialog.value = false
  }

  const handleCloudSuccess = () => {
  }

  return {
    showCloudDialog,
    cloudDialogMode,
    openCloudLoad,
    openCloudSave,
    openCloudDialog,
    closeCloudDialog,
    handleCloudSuccess
  }
}
