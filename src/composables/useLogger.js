import { ref } from 'vue'

// 日志类型
export const LogType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
}

// 日志存储
const logs = ref([])
let nextLogId = 1

// 最大日志数量
const MAX_LOGS = 100

export function useLogger() {
  // 添加日志
  const addLog = (message, type = LogType.INFO, context = {}) => {
    const log = {
      id: nextLogId++,
      message,
      type,
      timestamp: new Date(),
      context: context || {}
    }

    logs.value.unshift(log)

    // 限制日志数量
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(0, MAX_LOGS)
    }

    return log.id
  }

  // 便捷方法
  const info = (message) => addLog(message, LogType.INFO)
  const success = (message) => addLog(message, LogType.SUCCESS)
  const warning = (message) => addLog(message, LogType.WARNING)
  const error = (message, context = {}) => {
    // 支持传入 Error 对象
    if (message instanceof Error) {
      return addLog(message.message, LogType.ERROR, {
        ...context,
        stack: message.stack,
        name: message.name
      })
    }
    return addLog(message, LogType.ERROR, context)
  }

  // 清空日志
  const clearLogs = () => {
    logs.value = []
  }

  // 删除指定日志
  const removeLog = (logId) => {
    logs.value = logs.value.filter(log => log.id !== logId)
  }

  return {
    logs,
    addLog,
    info,
    success,
    warning,
    error,
    clearLogs,
    removeLog
  }
}
