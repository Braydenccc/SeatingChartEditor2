# 安全审计报告 - 单元 3：认证和会话管理

**审计日期**: 2026-04-26  
**审计范围**: 认证机制、会话管理、Token 存储、Cookie 安全  
**审计人员**: Claude (手动审计)  

---

## 1. 检查摘要

本次审计检查了以下文件和模块：

- **`src/composables/useAuth.js`** (380 行) - 认证和会话管理
- **`src/composables/useCloudWorkspace.js`** (261 行) - 云端工作区认证
- **`src/composables/useWebDav.js`** - WebDAV 认证
- **`src/components/auth/LoginDialog.vue`** - 登录界面

**检查内容**：
- Token 存储安全性
- WebDAV 密码存储方式
- 会话过期处理
- CSRF token 生成和验证流程
- Cookie 安全标志
- 密码传输安全

---

## 2. 发现的安全问题

### 2.1 严重问题

#### 问题 1: WebDAV 密码明文存储在 Cookie

**位置**: `src/composables/useAuth.js` 第 312-327 行

**问题描述**:
```javascript
const setWebdavLogin = (config) => {
    authType.value = 'webdav'
    webdavConfig.value = config  // config 包含明文密码
    // ...
    const configJson = JSON.stringify(config)
    if (getCookie('sce_webdav_config') !== configJson) {
        setCookie('sce_webdav_config', configJson)  // 密码明文存储在 Cookie
    }
}
```

- WebDAV 配置（包含用户名和密码）以明文形式存储在 Cookie
- 虽然设置了 `Secure` 标志（HTTPS），但仍可被 JavaScript 读取
- XSS 攻击可窃取密码

**风险**:
- XSS 攻击可直接读取密码
- 浏览器开发者工具可查看密码
- 密码泄露风险极高

**影响范围**: WebDAV 认证功能

**修复建议**:
```javascript
// 方案 1: 不存储密码，每次使用时要求输入
const setWebdavLogin = (config) => {
    authType.value = 'webdav'
    // 仅存储非敏感信息
    const safeConfig = {
        url: config.url,
        username: config.username
        // 不存储 password
    }
    webdavConfig.value = config  // 仅在内存中保存完整配置
    setCookie('sce_webdav_config', JSON.stringify(safeConfig))
}

// 方案 2: 使用后端代理，前端仅存储 Token
// 1. 前端发送用户名密码到后端
// 2. 后端验证 WebDAV 凭证，生成 Token
// 3. 前端存储 Token，后端代理 WebDAV 请求
```

---

#### 问题 2: Cookie 缺少 HttpOnly 标志

**位置**: `src/composables/useAuth.js` 第 49-58 行

**问题描述**:
```javascript
export const setCookie = (name, value, days = COOKIE_EXPIRY_DAYS) => {
    // ...
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax" + secure
    // 缺少 HttpOnly 标志
}
```

- Cookie 未设置 `HttpOnly` 标志
- JavaScript 可读取所有 Cookie（包括 Token）
- XSS 攻击可窃取 Token

**风险**:
- XSS 攻击可窃取用户 Token
- 账号劫持风险

**影响范围**: 所有 Cookie（Token、用户信息、WebDAV 配置）

**修复建议**:
```javascript
// 前端无法设置 HttpOnly，需要后端配合
// 方案 1: 后端设置 Cookie
// 登录成功后，后端通过 Set-Cookie 响应头设置 HttpOnly Cookie

// 方案 2: 使用 localStorage 存储非敏感数据，敏感数据由后端管理
// 前端仅存储 sessionId，后端维护会话状态

// 临时方案: 在文档中明确说明 XSS 风险
// 并加强 XSS 防护（CSP、输入验证）
```

---

### 2.2 高危问题

#### 问题 3: CSRF Token 存储在可读 Cookie

**位置**: `src/composables/useAuth.js` 第 81-95 行

**问题描述**:
```javascript
const getOrCreateCsrfToken = () => {
    let csrfToken = getCookie('sce_csrf')
    if (!csrfToken) {
        // 生成随机 Token
        csrfToken = Array.from(cryptoApi.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }
    setCookie('sce_csrf', csrfToken, 1)  // 存储在可读 Cookie
    return csrfToken
}
```

- CSRF Token 存储在可读 Cookie
- 这是 Double-Submit Cookie 模式的正确实现
- 但如果存在 XSS 漏洞，攻击者可读取 Token 并伪造请求

**风险**:
- XSS 攻击可绕过 CSRF 保护
- 需要确保没有 XSS 漏洞

**影响范围**: CSRF 保护机制

**修复建议**:
```javascript
// Double-Submit Cookie 模式本身是正确的
// 关键是防止 XSS 攻击：
// 1. 修复所有 XSS 漏洞（见单元 2 报告）
// 2. 添加 Content Security Policy
// 3. 使用 SameSite=Strict（当前是 Lax）

export const setCookie = (name, value, days = COOKIE_EXPIRY_DAYS) => {
    // ...
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    const sameSite = name === 'sce_csrf' ? '; SameSite=Strict' : '; SameSite=Lax'
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/" + sameSite + secure
}
```

---

#### 问题 4: localStorage 存储认证类型

**位置**: `src/composables/useAuth.js` 第 146、232、308 行

**问题描述**:
```javascript
safeStorageSet('sce_auth_type', 'retiehe')
```

- 使用 localStorage 存储认证类型
- localStorage 无过期时间，永久存储
- XSS 攻击可读取和修改

**风险**:
- XSS 攻击可修改认证类型，导致认证混乱
- 虽然不是敏感信息，但仍有风险

**影响范围**: 认证类型管理

**修复建议**:
```javascript
// 方案 1: 使用 sessionStorage（会话结束后清除）
const safeStorageSet = (key, value) => {
    try {
        sessionStorage.setItem(key, value)  // 改用 sessionStorage
        return true
    } catch (error) {
        console.warn(`Failed to write sessionStorage key "${key}":`, error)
        return false
    }
}

// 方案 2: 存储在 Cookie（可设置过期时间）
setCookie('sce_auth_type', authType.value, 7)
```

---

### 2.3 中等问题

#### 问题 5: 密码传输依赖 HTTPS

**位置**: `src/composables/useAuth.js` 第 187-200 行

**问题描述**:
```javascript
const callAuthApi = async (action, username, password) => {
    try {
        // Passwords must be transmitted over HTTPS to prevent plaintext exposure.
        // Server-side bcrypt hashing (already implemented in the backend) provides
        // the primary password security layer.
        const csrfToken = getOrCreateCsrfToken()
        const response = await fetch('/api/auth.php', {
            method: 'POST',
            // ...
            body: JSON.stringify({ action, username, password, _csrf: csrfToken })
        })
    }
}
```

- 密码以明文形式在请求体中传输
- 依赖 HTTPS 加密
- 如果 HTTPS 未启用或被降级攻击，密码会泄露

**风险**:
- HTTPS 降级攻击（MITM）可窃取密码
- 开发环境可能未启用 HTTPS

**影响范围**: 登录和注册功能

**修复建议**:
```javascript
// 方案 1: 前端哈希密码（不推荐，因为哈希值等同于密码）
// 方案 2: 强制 HTTPS（推荐）
const callAuthApi = async (action, username, password) => {
    // 检查 HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('必须使用 HTTPS 连接')
    }
    
    // ... 原有逻辑
}

// 方案 3: 使用 SRP (Secure Remote Password) 协议
// 复杂度较高，适合高安全要求场景
```

---

#### 问题 6: 会话同步可能失败

**位置**: `src/composables/useAuth.js` 第 157-181 行

**问题描述**:
```javascript
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
            // 更新本地配置
        }
    } catch (e) {
        console.error('Failed to fetch settings:', e)
        // 静默失败，不影响用户体验
    }
}
```

- 会话同步失败时静默处理
- 用户可能不知道配置未同步
- 可能导致数据不一致

**风险**:
- 用户配置丢失
- 数据不一致

**影响范围**: 会话同步功能

**修复建议**:
```javascript
const fetchSyncSettings = async () => {
    if (!currentUser.value || !token.value) return;
    try {
        // ... 原有逻辑
    } catch (e) {
        console.error('Failed to fetch settings:', e)
        // 显示警告提示
        const { warning } = useLogger()
        warning('配置同步失败，部分设置可能未生效')
    }
}
```

---

### 2.4 低危问题

#### 问题 7: Cookie 过期时间不一致

**位置**: `src/composables/useAuth.js` 多处

**问题描述**:
- `sce_user` 和 `sce_token` 使用默认过期时间（7 天）
- 后端 Token 过期时间为 30 天
- Cookie 过期后 Token 仍有效，但前端无法访问

**风险**:
- 用户体验不佳（需要重新登录）
- 不是安全问题

**影响范围**: 用户体验

**修复建议**:
```javascript
const login = async (username, password) => {
    const result = await callAuthApi('login', username, password)
    if (result.success) {
        currentUser.value = { username: result.data.username }
        token.value = result.data.token
        authType.value = 'retiehe'
        const userJson = JSON.stringify(currentUser.value)
        
        // 使用与后端一致的过期时间
        setCookie('sce_user', userJson, 30)  // 30 天
        setCookie('sce_token', token.value, 30)  // 30 天
        
        safeStorageSet('sce_auth_type', 'retiehe')
        await fetchSyncSettings()
    }
    return result
}
```

---

## 3. 已验证的安全措施

### 3.1 CSRF Token 生成 ✅

**位置**: `src/composables/useAuth.js` 第 81-95 行

**实施情况**:
- ✅ 使用 `crypto.getRandomValues()` 生成强随机 Token
- ✅ 回退到伪随机生成（兼容性）
- ✅ Double-Submit Cookie 模式实现正确

**评价**: CSRF Token 生成安全，符合最佳实践。

---

### 3.2 Cookie 安全标志 ✅

**位置**: `src/composables/useAuth.js` 第 49-58 行

**实施情况**:
- ✅ HTTPS 环境下设置 `Secure` 标志
- ✅ 设置 `SameSite=Lax` 防止 CSRF
- ✅ 设置 `path=/` 限制作用域

**评价**: Cookie 安全配置较好，但缺少 `HttpOnly`（需后端配合）。

---

### 3.3 Token 验证 ✅

**位置**: `src/composables/useCloudWorkspace.js` 第 51-91 行

**实施情况**:
- ✅ 每次 API 请求都验证 Token
- ✅ Token 和用户名一起发送
- ✅ 使用 CSRF Token 保护

**评价**: Token 验证机制完善。

---

### 3.4 会话过期处理 ✅

**位置**: `src/composables/useAuth.js` 第 100-117 行

**实施情况**:
- ✅ 初始化时验证 Cookie 中的用户信息
- ✅ 解析失败时清除 Cookie
- ✅ 格式验证

**评价**: 会话初始化处理正确。

---

## 4. 修复优先级建议

### 高优先级（立即修复）
1. **问题 1**: 移除 WebDAV 密码的 Cookie 存储
2. **问题 2**: 添加 HttpOnly 标志（需后端配合）或改用其他方案

### 中优先级（近期修复）
3. **问题 3**: 加强 XSS 防护，确保 CSRF Token 安全
4. **问题 5**: 强制 HTTPS 或添加警告提示
5. **问题 4**: 改用 sessionStorage 或 Cookie 存储认证类型

### 低优先级（可选优化）
6. **问题 6**: 添加会话同步失败提示
7. **问题 7**: 统一 Cookie 和后端 Token 过期时间

---

## 5. 总体评价

**安全性评分**: 6.5/10

**优点**:
- ✅ CSRF Token 生成安全
- ✅ Cookie 安全标志配置较好
- ✅ Token 验证机制完善
- ✅ 会话过期处理正确

**不足**:
- ❌ WebDAV 密码明文存储在 Cookie
- ❌ Cookie 缺少 HttpOnly 标志
- ❌ 密码明文传输（依赖 HTTPS）
- ❌ localStorage 存储认证信息

**建议**:
1. 优先修复 WebDAV 密码存储问题
2. 与后端配合添加 HttpOnly Cookie
3. 强制 HTTPS 或添加警告
4. 加强 XSS 防护（见单元 2 报告）
5. 改用更安全的存储方式

---

**审计完成时间**: 2026-04-26  
**下次审计建议**: 修复高优先级问题后进行复审
