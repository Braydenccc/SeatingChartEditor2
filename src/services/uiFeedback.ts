import type { DialogApi, LoadingBarApi, MessageApi, NotificationApi } from 'naive-ui'

export interface UiApiSet {
  message: MessageApi
  dialog: DialogApi
  notification: NotificationApi
  loadingBar: LoadingBarApi
}

export interface ConfirmRequest {
  title: string
  content: string
  positiveText?: string
  negativeText?: string
  type?: 'warning' | 'error' | 'info'
}

let uiApis: UiApiSet | null = null

export const registerUiApis = (apis: UiApiSet) => {
  uiApis = apis
}

export const clearUiApis = () => {
  uiApis = null
}

export const getUiApis = () => uiApis

export const requestUiConfirm = (request: ConfirmRequest): Promise<boolean> => {
  if (!uiApis) return Promise.resolve(false)
  return new Promise(resolve => {
    const create = request.type === 'error'
      ? uiApis!.dialog.error
      : request.type === 'info'
        ? uiApis!.dialog.info
        : uiApis!.dialog.warning
    create({
      title: request.title,
      content: request.content,
      positiveText: request.positiveText || '确认',
      negativeText: request.negativeText || '取消',
      closable: false,
      maskClosable: false,
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false),
      onEsc: () => resolve(false)
    })
  })
}

