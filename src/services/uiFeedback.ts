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

export interface AlertRequest {
  title: string
  content: string
  positiveText?: string
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

const getDialogCreator = (type: ConfirmRequest['type']) => {
  if (!uiApis) return null
  return type === 'error'
    ? uiApis.dialog.error
    : type === 'info'
      ? uiApis.dialog.info
      : uiApis.dialog.warning
}

export const requestUiConfirm = (request: ConfirmRequest): Promise<boolean> => {
  const create = getDialogCreator(request.type)
  if (!create) return Promise.resolve(false)
  return new Promise(resolve => {
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

export const requestUiAlert = (request: AlertRequest): Promise<void> => {
  const create = getDialogCreator(request.type)
  if (!create) return Promise.resolve()
  return new Promise(resolve => {
    create({
      title: request.title,
      content: request.content,
      positiveText: request.positiveText || '知道了',
      closable: false,
      maskClosable: false,
      closeOnEsc: false,
      style: {
        maxHeight: 'calc(100dvh - 32px)',
        display: 'flex',
        flexDirection: 'column'
      },
      contentStyle: {
        maxHeight: 'min(60dvh, 480px)',
        minHeight: 0,
        overflowY: 'auto',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap'
      },
      onPositiveClick: () => resolve()
    })
  })
}
