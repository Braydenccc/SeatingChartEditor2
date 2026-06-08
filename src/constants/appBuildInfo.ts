declare const __APP_BUILD_TIME__: string

const formatBuildTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value || '未知'
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export const appBuildInfo = {
  buildTime: __APP_BUILD_TIME__,
  buildTimeText: formatBuildTime(__APP_BUILD_TIME__)
} as const
