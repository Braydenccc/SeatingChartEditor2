/**
 * 加密工具模块
 * 用于 WebDAV 密码的加密存储
 */

const FALLBACK_KEY = 'sce-webdav-fallback-key-v1'

/**
 * 从密钥材料派生 AES-GCM 密钥
 * @param {string|null} keyMaterial - 密钥材料（用户 Token 或通用密钥）
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(keyMaterial) {
    const material = keyMaterial || FALLBACK_KEY
    const encoder = new TextEncoder()
    const keyData = encoder.encode(material)

    // 导入密钥材料
    const importedKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    )

    // 使用 PBKDF2 派生密钥
    const salt = encoder.encode('sce-webdav-salt-v1') // 固定 salt
    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

/**
 * 加密密码
 * @param {string} password - 明文密码
 * @param {string|null} userKey - 用户密钥（Token）或 null 使用通用密钥
 * @returns {Promise<string>} Base64 编码的加密数据
 */
export async function encrypt(password, userKey = null) {
    try {
        const encoder = new TextEncoder()
        const data = encoder.encode(password)

        // 派生密钥
        const key = await deriveKey(userKey)

        // 生成随机 IV
        const iv = crypto.getRandomValues(new Uint8Array(12))

        // 加密
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        )

        // 组合 IV + 密文
        const combined = new Uint8Array(iv.length + encrypted.byteLength)
        combined.set(iv, 0)
        combined.set(new Uint8Array(encrypted), iv.length)

        // Base64 编码
        return btoa(String.fromCharCode(...combined))
    } catch (error) {
        console.error('Encryption failed:', error)
        return null
    }
}

/**
 * 解密密码
 * @param {string} ciphertext - Base64 编码的加密数据
 * @param {string|null} userKey - 用户密钥（Token）或 null 使用通用密钥
 * @returns {Promise<string|null>} 明文密码或 null（解密失败）
 */
export async function decrypt(ciphertext, userKey = null) {
    try {
        // Base64 解码
        const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

        // 分离 IV 和密文
        const iv = combined.slice(0, 12)
        const data = combined.slice(12)

        // 派生密钥
        const key = await deriveKey(userKey)

        // 解密
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        )

        // 转换为字符串
        const decoder = new TextDecoder()
        return decoder.decode(decrypted)
    } catch (error) {
        console.error('Decryption failed:', error)
        return null
    }
}

async function deriveTransportKey(username) {
    const cryptoApi = globalThis.crypto
    const encoder = new TextEncoder()
    const keyMaterial = encoder.encode(`sce-auth-${username}`)
    const importedKey = await cryptoApi.subtle.importKey(
        'raw',
        keyMaterial,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    )

    return await cryptoApi.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('sce-transport-salt-v1'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    )
}

export async function encryptPasswordForTransport(password, username) {
    const cryptoApi = globalThis.crypto
    if (!password || !username || !cryptoApi?.subtle) {
        return null
    }

    try {
        const encoder = new TextEncoder()
        const iv = cryptoApi.getRandomValues(new Uint8Array(12))
        const key = await deriveTransportKey(username)
        const encrypted = await cryptoApi.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(password)
        )

        const combined = new Uint8Array(iv.length + encrypted.byteLength)
        combined.set(iv, 0)
        combined.set(new Uint8Array(encrypted), iv.length)

        return btoa(String.fromCharCode(...combined))
    } catch (error) {
        console.error('Password transport encryption failed:', error)
        return null
    }
}
