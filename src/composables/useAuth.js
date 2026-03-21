import { ref, computed } from 'vue'
import bcryptjs from 'bcryptjs'

const currentUser = ref(null)
const token = ref(null)
const isLoginDialogVisible = ref(false)

// Fixed client-side salt used to pre-hash passwords before transmission.
// This prevents the plaintext password from traveling over the wire;
// the server then applies its own bcrypt round on top.
const CLIENT_SALT = '$2a$06$seatcharteditor0000000'

// Cookie helper functions
const setCookie = (name, value, days) => {
    let expires = ""
    if (days) {
        const date = new Date()
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
        expires = "; expires=" + date.toUTCString()
    }
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Strict" + secure
}

const getCookie = (name) => {
    const nameEQ = name + "="
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') c = c.substring(1, c.length)
        if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length))
    }
    return null
}

const eraseCookie = (name) => {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict'
}

// Generate a CSRF token and persist it in a cookie for the session
const getOrCreateCsrfToken = () => {
    let csrfToken = getCookie('sce_csrf')
    if (!csrfToken) {
        csrfToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        setCookie('sce_csrf', csrfToken, 1)
    }
    return csrfToken
}

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
}

export function useAuth() {
    const isLoggedIn = computed(() => !!currentUser.value && !!token.value)

    const callAuthApi = async (action, username, password) => {
        try {
            // Pre-hash the password with a fixed client-side salt so the plaintext
            // password is never transmitted over the network.
            const hashedPassword = await bcryptjs.hash(password, CLIENT_SALT)

            const csrfToken = getOrCreateCsrfToken()
            const response = await fetch('/api/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ action, username, password: hashedPassword })
            })

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`)
            }

            const result = await response.json()
            return result
        } catch (err) {
            console.error('Auth API Error:', err)
            return { success: false, message: '网络请求失败，请检查连接' }
        }
    }

    const login = async (username, password) => {
        const result = await callAuthApi('login', username, password)
        if (result.success) {
            currentUser.value = { username: result.data.username }
            token.value = result.data.token
            setCookie('sce_user', JSON.stringify(currentUser.value), 30) // 30 days
            setCookie('sce_token', token.value, 30)
        }
        return result
    }

    const register = async (username, password) => {
        const result = await callAuthApi('register', username, password)
        if (result.success) {
            currentUser.value = { username: result.data.username }
            token.value = result.data.token
            setCookie('sce_user', JSON.stringify(currentUser.value), 30) // 30 days
            setCookie('sce_token', token.value, 30)
        }
        return result
    }

    const logout = () => {
        currentUser.value = null
        token.value = null
        eraseCookie('sce_user')
        eraseCookie('sce_token')
    }

    return {
        currentUser,
        isLoggedIn,
        token,
        isLoginDialogVisible,
        login,
        register,
        logout,
        initAuth
    }
}
