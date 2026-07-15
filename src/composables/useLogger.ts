import { ref } from 'vue'
import { getUiApis, requestUiConfirm, type ConfirmRequest } from '@/services/uiFeedback'

export const LogType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
} as const

export type LogTypeValue = typeof LogType[keyof typeof LogType]

export interface ActivityLog {
  id: number
  message: string
  type: LogTypeValue
  timestamp: Date
  context: Record<string, unknown>
}

const logs = ref<ActivityLog[]>([])
let nextLogId = 1
const MAX_LOGS = 100
const recentMessages = new Map<string, number>()

const showImmediateFeedback = (message: string, type: LogTypeValue) => {
  const apis = getUiApis()
  if (!apis) return
  const key = `${type}:${message}`
  const now = Date.now()
  if (now - (recentMessages.get(key) || 0) < 1200) return
  recentMessages.set(key, now)
  apis.message[type](message, { duration: type === LogType.ERROR ? 5000 : 3000 })
}

export function useLogger() {
  const addLog = (
    message: string,
    type: LogTypeValue = LogType.INFO,
    context: Record<string, unknown> = {},
    immediate = true
  ) => {
    const log: ActivityLog = {
      id: nextLogId++,
      message,
      type,
      timestamp: new Date(),
      context
    }
    logs.value.unshift(log)
    if (logs.value.length > MAX_LOGS) logs.value = logs.value.slice(0, MAX_LOGS)
    if (immediate) showImmediateFeedback(message, type)
    return log.id
  }

  const info = (message: string, context: Record<string, unknown> = {}) => addLog(message, LogType.INFO, context)
  const success = (message: string, context: Record<string, unknown> = {}) => addLog(message, LogType.SUCCESS, context)
  const warning = (message: string, context: Record<string, unknown> = {}) => addLog(message, LogType.WARNING, context)
  const error = (message: string | Error, context: Record<string, unknown> = {}) => {
    if (message instanceof Error) {
      return addLog(message.message, LogType.ERROR, {
        ...context,
        stack: message.stack,
        name: message.name
      }, false)
    }
    return addLog(message, LogType.ERROR, context)
  }

  const clearLogs = () => { logs.value = [] }
  const removeLog = (logId: number) => {
    logs.value = logs.value.filter(log => log.id !== logId)
  }
  const beginTask = (message: string) => {
    const task = getUiApis()?.message.loading(message, { duration: 0 })
    return () => task?.destroy()
  }

  return {
    logs,
    addLog,
    info,
    success,
    warning,
    error,
    confirm: (request: ConfirmRequest) => requestUiConfirm(request),
    beginTask,
    clearLogs,
    removeLog
  }
}

export const useUiFeedback = useLogger
