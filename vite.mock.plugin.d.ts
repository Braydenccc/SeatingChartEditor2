import type { Plugin } from 'vite'

export function authMockPlugin(): Plugin

export function decryptMockTransportPassword(
  encryptedPassword: unknown,
  username: unknown
): string | null

export function readMockPasswordField(
  input: { encryptedPassword?: unknown; password?: unknown } | null | undefined,
  username: unknown
): { password: string; error: string }
