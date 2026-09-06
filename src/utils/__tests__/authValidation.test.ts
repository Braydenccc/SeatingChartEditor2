import { describe, expect, it } from 'vitest'
import { isValidAccountUsername } from '../authValidation'

describe('authValidation', () => {
  it.each(['a', 'A_1-test', 'a'.repeat(32)])('accepts valid username %s', username => {
    expect(isValidAccountUsername(username)).toBe(true)
  })

  it.each(['', 'a'.repeat(33), '非法 用户', '中文'])('rejects invalid username %s', username => {
    expect(isValidAccountUsername(username)).toBe(false)
  })
})
