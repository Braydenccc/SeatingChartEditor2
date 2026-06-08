declare const __APP_BUILD_TIME__: string
declare const __APP_RELEASE_VERSION__: string

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

const formatTimezoneOffset = (value: string) => {
  const date = new Date(value)
  const offset = Number.isNaN(date.getTime()) ? new Date().getTimezoneOffset() : date.getTimezoneOffset()
  const totalMinutes = -offset
  const sign = totalMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(totalMinutes)
  const hours = Math.floor(absoluteMinutes / 60)
  const minutes = absoluteMinutes % 60

  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`
}

export const appBuildInfo = {
  buildTime: __APP_BUILD_TIME__,
  buildTimeText: formatBuildTime(__APP_BUILD_TIME__),
  buildTimeZoneText: formatTimezoneOffset(__APP_BUILD_TIME__),
  releaseVersion: __APP_RELEASE_VERSION__
} as const
