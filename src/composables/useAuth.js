import { ref, computed } from 'vue'
import { safeStorageGet as storageGet, safeStorageSet as storageSet, safeStorageRemove as storageRemove } from '@/utils/storage'
import { encrypt, decrypt, encryptPasswordForTransport } from '@/utils/crypto'
import { apiFetch, clearRetieheSessionCookies } from '@/platform/apiClient'
import { isTauriRuntime } from '@/platform/runtime'

const currentUser = ref(null)
const token = ref(null)
const isLoginDialogVisible = ref(false)

// 鉴权方式: 'retiehe' 或 'webdav'
const authType = ref('retiehe')
const webdavConfig = ref(null)
const backupMode = ref(false)

const COOKIE_EXPIRY_DAYS = 7
const cookieSessionToken = 'cookie-session'
let syncSettingsTimer = null

// 包装存储函数以支持认证相关数据的 sessionStorage 优先策略
const safeStorageGet = (key) => {
    const isAuthKey = key.includes('auth') || key.includes('token')
    return storageGet(key, isAuthKey)
}

const safeStorageSet = (key, value) => {
    const isAuthKey = key.includes('auth') || key.includes('token')
    return storageSet(key, value, isAuthKey)
}

const safeStorageRemove = (key) => {
    return storageRemove(key, true)
}

const generateFallbackToken = (byteLength = 24) => {
    return Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

export const setCookie = (name, value, days = COOKIE_EXPIRY_DAYS) => {
    let expires = ""
    if (days) {
        const date = new Date()
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
        expires = "; expires=" + date.toUTCString()
    }
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax" + secure
}

export const getCookie = (name) => {
    const nameEQ = name + "="
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') c = c.substring(1, c.length)
        if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length))
    }
    return null
}

export const eraseCookie = (name) => {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax' + secure
}

// Double-Submit Cookie CSRF protection:
// A random token is stored in a readable cookie AND sent as a request header.
// A cross-origin attacker cannot read the cookie (same-origin policy), so they
// cannot replicate the matching header. The server must verify that both values
// are identical to reject forged cross-site requests.
const getOrCreateCsrfToken = () => {
    let csrfToken = getCookie('sce_csrf')
    if (!csrfToken) {
        const cryptoApi = globalThis.crypto
        if (cryptoApi?.getRandomValues) {
            csrfToken = Array.from(cryptoApi.getRandomValues(new Uint8Array(24)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        } else {
            csrfToken = generateFallbackToken()
        }
    }
    setCookie('sce_csrf', csrfToken, 1)
    return csrfToken
}

export { getOrCreateCsrfToken }

const sanitizeWebdavSettings = (webdav) => {
    if (!webdav) return null
    const { password, encryptedPassword, authorization, ...safeWebdav } = webdav
    return safeWebdav
}

const decryptWebdavPassword = async (encryptedPassword, legacyKey = null) => {
    if (!encryptedPassword) return null

    const keys = legacyKey ? [null, legacyKey] : [null]
    for (const key of keys) {
        const decryptedPassword = await decrypt(encryptedPassword, key)
        if (decryptedPassword) return decryptedPassword
    }

    return null
}

const preparePersistedWebdavConfig = async (webdav) => {
    if (!webdav) return null

    const safeWebdav = sanitizeWebdavSettings(webdav)
    if (webdav.password) {
        const encryptedPassword = await encrypt(webdav.password, null)
        if (encryptedPassword) {
            safeWebdav.encryptedPassword = encryptedPassword
        }
    } else if (webdav.encryptedPassword) {
        safeWebdav.encryptedPassword = webdav.encryptedPassword
    }

    return safeWebdav
}

const persistLocalWebdavConfig = (config) => {
    if (!config) {
        eraseCookie('sce_webdav_config')
        return
    }

    const configJson = JSON.stringify(config)
    if (getCookie('sce_webdav_config') !== configJson) {
        setCookie('sce_webdav_config', configJson)
    }
}

const verifyRetieheSession = async () => {
    try {
        const csrfToken = getOrCreateCsrfToken()
        const response = await apiFetch('/api/auth.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ action: 'verify', _csrf: csrfToken })
        }, 0)
        const result = await response.json().catch(() => null)
        if (response.ok && result?.success && result.data?.username) {
            currentUser.value = { username: result.data.username }
            token.value = cookieSessionToken
            authType.value = 'retiehe'
            return true
        }
    } catch (e) {
        console.error('Failed to verify session:', e)
    }

    token.value = null
    return false
}

// Initialize from cookies
const initAuth = async () => {
    const legacyToken = getCookie('sce_token')
    await verifyRetieheSession()
    eraseCookie('sce_user')

    // 初始化 WebDAV 访客配置
    const savedWebdav = getCookie('sce_webdav_config')
    if (savedWebdav) {
        try {
            const config = JSON.parse(savedWebdav)

            // 如果有加密的密码，尝试解密
            if (config.encryptedPassword) {
                const decryptedPassword = await decryptWebdavPassword(config.encryptedPassword, legacyToken)
                if (decryptedPassword) {
                    config.password = decryptedPassword
                    delete config.encryptedPassword
                }
            }

            webdavConfig.value = config
            if (!currentUser.value) {
                currentUser.value = { username: config.username }
                authType.value = 'webdav'
            }
        } catch(e) {
            eraseCookie('sce_webdav_config')
        }
    }

    // 初始化备份模式设置
    const savedBackupMode = getCookie('sce_backup_mode')
    if (savedBackupMode) {
        try {
            backupMode.value = savedBackupMode === 'true'
        } catch(e) {
            eraseCookie('sce_backup_mode')
        }
    }

    // 恢复用户上次手动设置的首选同步类型（仅在未被上面的 WebDAV 逻辑覆盖的情况下才读取）
    const savedAuthType = safeStorageGet('sce_auth_type')
    if (savedAuthType && authType.value !== 'webdav') {
        authType.value = savedAuthType
    }

    // 初始化后如果本身是受信任状态，则拉取后台同步数据
    // 延迟执行，避免阻塞应用初始加载
    if (currentUser.value && token.value === cookieSessionToken) {
        const fetchApi = isTauriRuntime() ? apiFetch : globalThis.fetch
        scheduleFetchSyncSettings(fetchApi)
    }
}

const fetchSyncSettings = async (fetchApi = apiFetch) => {
    if (!currentUser.value || token.value !== cookieSessionToken) return;
    try {
        const csrfToken = getOrCreateCsrfToken()
        const response = await fetchApi('/api/auth.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ action: 'get_settings', _csrf: csrfToken })
        })
        const result = await response.json()
        if (result.success && result.data) {
            if (result.data.webdav) {
                const savedWebdav = result.data.webdav
                const existingPassword = webdavConfig.value?.url === result.data.webdav.url &&
                    webdavConfig.value?.username === result.data.webdav.username
                    ? webdavConfig.value?.password
                    : undefined
                const decryptedPassword = existingPassword || await decryptWebdavPassword(savedWebdav.encryptedPassword)
                webdavConfig.value = {
                    ...savedWebdav,
                    password: decryptedPassword
                }
                persistLocalWebdavConfig(savedWebdav)
            }
            backupMode.value = !!result.data.backupMode
            const newBackupMode = backupMode.value ? 'true' : 'false'
            if (getCookie('sce_backup_mode') !== newBackupMode) {
                setCookie('sce_backup_mode', newBackupMode)
            }
        }
    } catch (e) {
        console.error('Failed to fetch settings:', e)
    }
}

const scheduleFetchSyncSettings = (fetchApi) => {
    if (syncSettingsTimer) {
        clearTimeout(syncSettingsTimer)
    }
    syncSettingsTimer = setTimeout(() => {
        syncSettingsTimer = null
        fetchSyncSettings(fetchApi)
    }, 100)
}

const cancelScheduledFetchSyncSettings = () => {
    if (syncSettingsTimer) {
        clearTimeout(syncSettingsTimer)
        syncSettingsTimer = null
    }
}

const attachPasswordField = async (requestBody, plainKey, encryptedKey, password, username) => {
    if (!password) return

    const encryptedPassword = await encryptPasswordForTransport(password, username)
    if (encryptedPassword) {
        requestBody[encryptedKey] = encryptedPassword
        return
    }

    requestBody[plainKey] = password
}

export function useAuth() {
    const isLoggedIn = computed(() => {
        return !!currentUser.value || !!webdavConfig.value
    })
    const callAuthApi = async (action, username, password) => {
        try {
            cancelScheduledFetchSyncSettings()
            const csrfToken = getOrCreateCsrfToken()
            const requestBody = {
                action,
                username,
                _csrf: csrfToken
            }

            if (password) {
                await attachPasswordField(requestBody, 'password', 'encryptedPassword', password, username)
            }

            const response = await apiFetch('/api/auth.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(requestBody)
            }, 0)

            if (!response.ok) {
                // Read actual server error message instead of throwing generic error
                const errorData = await response.json().catch(() => null)
                const message = errorData?.message || `服务器错误 (${response.status})`
                console.error('Auth API Error:', response.status, message)
                return { success: false, message }
            }

            const result = await response.json()
            return result
        } catch (err) {
            console.error('Auth API Network Error:', err)
            return { success: false, message: err.message || '网络请求失败，请检查连接' }
        }
    }

    const login = async (username, password) => {
        const result = await callAuthApi('login', username, password)
        if (result.success) {
            currentUser.value = { username: result.data.username }
            token.value = cookieSessionToken
            authType.value = 'retiehe'
            eraseCookie('sce_user')
            safeStorageSet('sce_auth_type', 'retiehe')
            await fetchSyncSettings()
        }
        return result
    }

    const register = async (username, password) => {
        const result = await callAuthApi('register', username, password)
        if (result.success) {
            currentUser.value = { username: result.data.username }
            token.value = cookieSessionToken
            authType.value = 'retiehe'
            eraseCookie('sce_user')
            safeStorageSet('sce_auth_type', 'retiehe')
            await fetchSyncSettings()
        }
        return result
    }

    const changePassword = async (currentPassword, newPassword) => {
        cancelScheduledFetchSyncSettings()
        if (!currentUser.value || token.value !== cookieSessionToken) {
            return { success: false, message: '请先登录 SCE 账号' }
        }

        try {
            const csrfToken = getOrCreateCsrfToken()
            const requestBody = {
                action: 'change_password',
                _csrf: csrfToken
            }
            await attachPasswordField(requestBody, 'currentPassword', 'encryptedCurrentPassword', currentPassword, currentUser.value.username)
            await attachPasswordField(requestBody, 'newPassword', 'encryptedNewPassword', newPassword, currentUser.value.username)

            const response = await apiFetch('/api/auth.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(requestBody)
            }, 0)

            if (!response.ok) {
                const errorData = await response.json().catch(() => null)
                const message = errorData?.message || `服务器错误 (${response.status})`
                return { success: false, message }
            }

            return await response.json()
        } catch (err) {
            console.error('Change Password API Network Error:', err)
            return { success: false, message: err.message || '网络请求失败，请检查连接' }
        }
    }

    const logout = async (target = 'all') => {
        cancelScheduledFetchSyncSettings()
        if (target === 'all' || target === 'retiehe') {
            // 调用后端 API 失效 token
            if (currentUser.value && token.value === cookieSessionToken) {
                try {
                    const csrfToken = getOrCreateCsrfToken()
                    await apiFetch('/api/auth.php', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({
                            action: 'logout',
                            _csrf: csrfToken
                        })
                    }, 0)
                } catch (e) {
                    console.error('Logout API error:', e)
                }
            }

            currentUser.value = null
            token.value = null
            clearRetieheSessionCookies()
            eraseCookie('sce_user')
            // 退出 SCE 账号后若还有 WebDAV，切换到 WebDAV 模式
            if (authType.value === 'retiehe') {
                authType.value = webdavConfig.value ? 'webdav' : 'retiehe'
            }
        }

        if (target === 'all' || target === 'webdav') {
            webdavConfig.value = null
            backupMode.value = false
            eraseCookie('sce_webdav_config')
            eraseCookie('sce_backup_mode')
            // 断开 WebDAV 后切换到 retiehe；若无 SCE 登录（token 为空），
            // 同时清理由 WebDAV 写入的 currentUser，避免退出后仍被视为已登录
            if (authType.value === 'webdav') {
                if (!token.value) {
                    currentUser.value = null
                }
                authType.value = 'retiehe'
            }
        }

        if (target === 'all') {
            authType.value = 'retiehe'
            safeStorageRemove('sce_auth_type')
        } else {
            safeStorageSet('sce_auth_type', authType.value)
        }
    }

    const setWebdavLogin = async (config, rememberPassword = false) => {
        authType.value = 'webdav'

        webdavConfig.value = config // 内存中保留完整配置（含密码）

        // currentUser.value shouldn't be overridden if already logged into retiehe
        if (!currentUser.value) {
            currentUser.value = { username: config.username }
        }

        const safeConfig = rememberPassword
            ? await preparePersistedWebdavConfig(config)
            : sanitizeWebdavSettings(config)

        // Cookie 中存储配置（可能包含加密密码）
        persistLocalWebdavConfig(safeConfig)
        safeStorageSet('sce_auth_type', 'webdav')

        // Remove old local item if any
        safeStorageRemove('sce_webdav_config')
    }

    const updateSyncSettings = async (webdav, backup) => {
        cancelScheduledFetchSyncSettings()
        if (!currentUser.value || token.value !== cookieSessionToken) return { success: false, message: '未登录' }
        try {
            const persistedWebdav = await preparePersistedWebdavConfig(webdav)
            const csrfToken = getOrCreateCsrfToken()
            const response = await apiFetch('/api/auth.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ 
                    action: 'set_settings', 
                    settings: { webdav: persistedWebdav, backupMode: backup },
                    _csrf: csrfToken
                })
            }, 0)
            const result = await response.json()
            if (result.success) {
                webdavConfig.value = webdav
                backupMode.value = backup
                persistLocalWebdavConfig(persistedWebdav)
                // 持久化备份模式到 Cookie
                setCookie('sce_backup_mode', backup ? 'true' : 'false', 30)
            }
            return result
        } catch (e) {
            return { success: false, message: '网络错误' }
        }
    }

    const setAuthType = (type) => {
        authType.value = type
        safeStorageSet('sce_auth_type', type)
    }

    return {
        currentUser,
        isLoggedIn,
        token,
        authType,
        webdavConfig,
        backupMode,
        isLoginDialogVisible,
        login,
        register,
        changePassword,
        setWebdavLogin,
        updateSyncSettings,
        setAuthType,
        logout,
        initAuth
    }
}
