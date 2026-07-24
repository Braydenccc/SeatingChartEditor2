export const ACCOUNT_USERNAME_MAX_LENGTH = 32
export const ACCOUNT_USERNAME_PATTERN_SOURCE = '[A-Za-z0-9_-]{1,32}'
export const ACCOUNT_USERNAME_FORMAT_MESSAGE =
  '用户名只能包含字母、数字、下划线和连字符，长度为 1-32 个字符'

const accountUsernamePattern = /^[A-Za-z0-9_-]{1,32}$/

export const isValidAccountUsername = (value: string) => accountUsernamePattern.test(value)
