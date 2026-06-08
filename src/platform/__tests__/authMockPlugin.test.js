import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptMockTransportPassword, readMockPasswordField } from '../../../vite.mock.plugin.js'

const encryptTransportPassword = (password, username) => {
  const iv = randomBytes(12)
  const key = pbkdf2Sync(`sce-auth-${username}`, 'sce-transport-salt-v1', 100000, 32, 'sha256')
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, ciphertext, tag]).toString('base64')
}

describe('authMockPlugin password transport', () => {
  it('decrypts encryptedPassword sent by the frontend login flow', () => {
    const encryptedPassword = encryptTransportPassword('Pass1234', 'teacher')

    expect(decryptMockTransportPassword(encryptedPassword, 'teacher')).toBe('Pass1234')
    expect(readMockPasswordField({ encryptedPassword }, 'teacher')).toEqual({
      password: 'Pass1234',
      error: ''
    })
  })

  it('keeps plaintext password fallback for older clients', () => {
    expect(readMockPasswordField({ password: 'Pass1234' }, 'teacher')).toEqual({
      password: 'Pass1234',
      error: ''
    })
  })

  it('reports encrypted password decode failures', () => {
    expect(readMockPasswordField({ encryptedPassword: 'bad-value' }, 'teacher')).toEqual({
      password: '',
      error: '密码解密失败'
    })
  })
})
