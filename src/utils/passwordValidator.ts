export const PASSWORD_MIN_LENGTH = 8

export const HAS_UPPERCASE = /[A-Z]/
export const HAS_LOWERCASE = /[a-z]/
export const HAS_NUMBER = /[0-9]/

/**
 * Validate password strength
 * @param {string} password
 * @returns {{ length: boolean, uppercase: boolean, lowercase: boolean, number: boolean, isValid: boolean }}
 */
export function validatePasswordStrength(password: string) {
  const result = {
    length: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: HAS_UPPERCASE.test(password),
    lowercase: HAS_LOWERCASE.test(password),
    number: HAS_NUMBER.test(password),
    isValid: false
  }
  result.isValid = result.length && result.uppercase && result.lowercase && result.number
  return result
}
