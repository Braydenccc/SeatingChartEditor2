import { ref, computed } from 'vue'

const currentUser = ref(null)
const token = ref(null)
const isLoginDialogVisible = ref(false)

// 鉴权方式: 'retiehe' 或 'webdav'
const authType = ref('retiehe')
const webdavConfig = ref(null)
const backupMode = ref(false)


export const setCookie = (name, value, days) => {
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
        csrfToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }
    setCookie('sce_csrf', csrfToken, 1)
    return csrfToken
}

export { getOrCreateCsrfToken }

// Initialize from cookies
const initAuth = () => {
    const savedUser = getCookie('sce_user')
    const savedToken = getCookie('sce_token')
    if (savedUser && savedToken) {
        try {
            const parsed = JSON.parse(savedUser)
            if (parsed && typeof parsed === 'object' && typeof parsed.username === 'string') {
                currentUser.value = parsed
                token.value = savedToken
            } else {
                eraseCookie('sce_user')
                eraseCookie('sce_token')
            }
        } catch (e) {
            eraseCookie('sce_user')
            eraseCookie('sce_token')
        }
    }
    
    // 初始化 WebDAV 访客配置
    const savedWebdav = getCookie('sce_webdav_config')
    if (savedWebdav) {
        try {
            const config = JSON.parse(savedWebdav)
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
    const savedAuthType = localStorage.getItem('sce_auth_type')
    if (savedAuthType && authType.value !== 'webdav') {
        authType.value = savedAuthType
    }

    // 初始化后如果本身是受信任状态，则拉取后台同步数据
    // 延迟执行，避免阻塞应用初始加载
    if (currentUser.value && token.value) {
        setTimeout(() => fetchSyncSettings(), 100)
    }
}

const fetchSyncSettings = async () => {
    if (!currentUser.value || !token.value) return;
    try {
        const csrfToken = getOrCreateCsrfToken()
        const response = await fetch('/api/auth.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ action: 'get_settings', username: currentUser.value.username, token: token.value, _csrf: csrfToken })
        })
        const result = await response.json()
        if (result.success && result.data) {
            if (result.data.webdav) {
                webdavConfig.value = result.data.webdav
            }
            backupMode.value = !!result.data.backupMode
            // 持久化备份模式到 Cookie
            setCookie('sce_backup_mode', backupMode.value ? 'true' : 'false', 30)
        }
    } catch (e) {
        console.error('Failed to fetch settings:', e)
    }
}

export function useAuth() {
    const isLoggedIn = computed(() => {
        return !!currentUser.value || !!webdavConfig.value
    })
    const callAuthApi = async (action, username, password) => {
        try {
            // Passwords must be transmitted over HTTPS to prevent plaintext exposure.
            // Server-side bcrypt hashing (already implemented in the backend) provides
            // the primary password security layer.
            const csrfToken = getOrCreateCsrfToken()
            const response = await fetch('/api/auth.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ action, username, password, _csrf: csrfToken })
            })

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
            return { success: false, message: '网络请求失败，请检查连接' }
        }
    }

    const login = async (username, password) => {
        const result = await callAuthApi('login', username, password)
        if (result.success) {
            currentUser.value = { username: result.data.username }
            token.value = result.data.token
            authType.value = 'retiehe'
            setCookie('sce_user', JSON.stringify(currentUser.value), 30) // 30 days
            setCookie('sce_token', token.value, 30)
            localStorage.setItem('sce_auth_type', 'retiehe')
            await fetchSyncSettings()
        }
        return result
    }

    const register = async (username, password) => {
        const result = await callAuthApi('register', username, password)
        if (result.success) {
            currentUser.value = { username: result.data.username }
            token.value = result.data.token
            authType.value = 'retiehe'
            setCookie('sce_user', JSON.stringify(currentUser.value), 30) // 30 days
            setCookie('sce_token', token.value, 30)
            localStorage.setItem('sce_auth_type', 'retiehe')
            await fetchSyncSettings()
        }
        return result
    }

    const logout = (target = 'all') => {
        if (target === 'all' || target === 'retiehe') {
            currentUser.value = null
            token.value = null
            eraseCookie('sce_user')
            eraseCookie('sce_token')
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
            // 断开 WebDAV 后若还有 SCE 账号，切换到 retiehe
            if (authType.value === 'webdav') {
                authType.value = currentUser.value ? 'retiehe' : 'retiehe'
            }
        }
        
        if (target === 'all') {
            authType.value = 'retiehe'
            localStorage.removeItem('sce_auth_type')
        } else {
            localStorage.setItem('sce_auth_type', authType.value)
        }
    }

    const setWebdavLogin = (config) => {
        authType.value = 'webdav'
        webdavConfig.value = config
        // currentUser.value shouldn't be overridden if already logged into retiehe
        if (!currentUser.value) {
            currentUser.value = { username: config.username }
        }
        setCookie('sce_webdav_config', JSON.stringify(config), 30)
        localStorage.setItem('sce_auth_type', 'webdav')
        
        // Remove old local item if any
        localStorage.removeItem('sce_webdav_config')
    }

    const updateSyncSettings = async (webdav, backup) => {
        if (!currentUser.value || !token.value) return { success: false, message: '未登录' }
        try {
            const csrfToken = getOrCreateCsrfToken()
            const response = await fetch('/api/auth.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ 
                    action: 'set_settings', 
                    username: currentUser.value.username, 
                    token: token.value, 
                    settings: { webdav, backupMode: backup },
                    _csrf: csrfToken
                })
            })
            const result = await response.json()
            if (result.success) {
                webdavConfig.value = webdav
                backupMode.value = backup
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
        localStorage.setItem('sce_auth_type', type)
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
        setWebdavLogin,
        updateSyncSettings,
        setAuthType,
        logout,
        initAuth
    }
}
