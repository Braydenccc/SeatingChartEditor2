# HttpOnly Cookie 实施说明

**日期**: 2026-04-26  
**状态**: 待实施  
**优先级**: 高危

---

## 问题描述

当前项目中的认证 Token 和 CSRF Token 存储在前端可读的 Cookie 中（通过 JavaScript `document.cookie` 设置），这使得它们容易受到 XSS 攻击窃取。

**当前实现**（`useAuth.js:49-58`）：
```javascript
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
```

**风险**：
- XSS 攻击可通过 `document.cookie` 读取 Token
- 攻击者可劫持用户会话
- CSRF Token 可被窃取，绕过 CSRF 保护

---

## 解决方案

### 方案 1：后端设置 HttpOnly Cookie（推荐）

**优点**：
- 完全防止 JavaScript 访问敏感 Cookie
- 符合安全最佳实践
- 浏览器原生支持

**缺点**：
- 需要修改后端 API
- 前端无法直接读取 Token（需通过 API 验证）

**实施步骤**：

#### 1. 修改后端 `auth.php`

```php
// 登录成功后，设置 HttpOnly Cookie
function setAuthCookie($name, $value, $days) {
    $expires = time() + ($days * 24 * 60 * 60);
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    $httpOnly = true; // 关键：启用 HttpOnly
    $sameSite = 'Lax';

    setcookie(
        $name,
        $value,
        [
            'expires' => $expires,
            'path' => '/',
            'domain' => '', // 留空使用当前域名
            'secure' => $secure,
            'httponly' => $httpOnly,
            'samesite' => $sameSite
        ]
    );
}

// 登录接口
if ($action === 'login') {
    // ... 验证用户名密码 ...
    
    $token = bin2hex(random_bytes(32));
    $expiry = $rememberMe ? TOKEN_EXPIRY_REMEMBER_ME : TOKEN_EXPIRY_DAYS;
    
    // 后端设置 HttpOnly Cookie
    setAuthCookie('sce_token', $token, $expiry);
    setAuthCookie('sce_username', $username, $expiry);
    
    respond([
        'success' => true,
        'message' => '登录成功',
        // 不再返回 token，由 Cookie 自动携带
    ]);
}
```

#### 2. 修改前端 `useAuth.js`

```javascript
// 移除前端设置 Token Cookie 的逻辑
const login = async (username, password, rememberMe = false) => {
    try {
        const csrfToken = getOrCreateCsrfToken()
        const response = await fetch('/api/auth.php', {
            method: 'POST',
            credentials: 'same-origin', // 自动携带 Cookie
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ 
                action: 'login', 
                username, 
                password, 
                rememberMe,
                _csrf: csrfToken 
            })
        })
        const result = await response.json()
        
        if (result.success) {
            // Token 已由后端设置为 HttpOnly Cookie
            // 前端仅更新状态
            currentUser.value = { username }
            token.value = 'cookie-based' // 标记为基于 Cookie 的认证
            authType.value = 'retiehe'
            safeStorageSet('sce_auth_type', 'retiehe')
        }
        
        return result
    } catch (e) {
        return { success: false, message: '网络错误' }
    }
}

// 验证登录状态时，不再读取 Cookie
const checkLoginStatus = async () => {
    try {
        const csrfToken = getOrCreateCsrfToken()
        const response = await fetch('/api/auth.php', {
            method: 'POST',
            credentials: 'same-origin', // Cookie 自动携带
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ 
                action: 'verify',
                _csrf: csrfToken 
            })
        })
        const result = await response.json()
        
        if (result.success) {
            currentUser.value = { username: result.username }
            token.value = 'cookie-based'
            authType.value = 'retiehe'
        }
        
        return result
    } catch (e) {
        return { success: false }
    }
}
```

#### 3. 修改后端验证逻辑

```php
// 从 Cookie 中读取 Token
function getAuthFromCookie() {
    $token = isset($_COOKIE['sce_token']) ? $_COOKIE['sce_token'] : null;
    $username = isset($_COOKIE['sce_username']) ? $_COOKIE['sce_username'] : null;
    
    return ['token' => $token, 'username' => $username];
}

// 验证接口
if ($action === 'verify') {
    $auth = getAuthFromCookie();
    
    if (!$auth['token'] || !$auth['username']) {
        respond(['success' => false, 'message' => '未登录']);
    }
    
    if (isAuthorized($sessionDb, $auth['username'], $auth['token'])) {
        respond([
            'success' => true,
            'username' => $auth['username']
        ]);
    } else {
        respond(['success' => false, 'message' => '会话已过期']);
    }
}

// 其他需要认证的接口
if ($action === 'some_protected_action') {
    $auth = getAuthFromCookie();
    
    if (!isAuthorized($sessionDb, $auth['username'], $auth['token'])) {
        respond(['success' => false, 'message' => '未授权'], 401);
    }
    
    // ... 执行操作 ...
}
```

---

### 方案 2：使用 sessionStorage + 后端会话（备选）

**优点**：
- 不需要修改 Cookie 逻辑
- Token 不存储在 Cookie 中

**缺点**：
- sessionStorage 仍可被 XSS 读取（不如 HttpOnly 安全）
- 需要后端支持会话管理

**实施步骤**：

1. 后端生成会话 ID，存储在 HttpOnly Cookie
2. 前端将 Token 存储在 sessionStorage
3. 每次请求携带会话 ID（Cookie）和 Token（Header）
4. 后端验证会话 ID 和 Token 匹配

---

## CSRF Token 处理

### 当前实现（可读 Cookie）

CSRF Token 当前存储在可读 Cookie 中（`sce_csrf`），这是 Double-Submit Cookie 模式的标准实现：

```javascript
const getOrCreateCsrfToken = () => {
    let csrfToken = getCookie('sce_csrf')
    if (!csrfToken) {
        csrfToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        setCookie('sce_csrf', csrfToken, 1) // 1 天过期
    }
    return csrfToken
}
```

### 为什么 CSRF Token 可以保持可读

1. **CSRF Token 的作用**：防止跨站请求伪造（CSRF），而非防止 XSS
2. **Double-Submit Cookie 模式**：攻击者无法读取跨域 Cookie（同源策略）
3. **即使 XSS 窃取 CSRF Token**：攻击者已经可以执行任意操作，CSRF 保护失效

### 可选增强方案：后端生成 CSRF Token

如果希望进一步增强安全性，可以让后端生成 CSRF Token 并通过 API 返回：

#### 1. 后端生成 CSRF Token

```php
// auth.php 添加新接口
if ($action === 'get_csrf_token') {
    $csrfToken = bin2hex(random_bytes(24));
    
    // 存储到会话数据库（可选）
    $csrfDb = new Database('csrf_tokens');
    $csrfDb->set($csrfToken, json_encode([
        'created' => time(),
        'expiry' => time() + 3600 // 1 小时
    ]));
    
    respond([
        'success' => true,
        'csrfToken' => $csrfToken
    ]);
}

// 验证 CSRF Token
function verifyCsrfToken($csrfToken) {
    $csrfDb = new Database('csrf_tokens');
    $data = $csrfDb->get($csrfToken);
    
    if (!$data) return false;
    
    $tokenData = json_decode($data, true);
    if (time() > $tokenData['expiry']) {
        $csrfDb->delete($csrfToken);
        return false;
    }
    
    return true;
}
```

#### 2. 前端获取 CSRF Token

```javascript
const getOrCreateCsrfToken = async () => {
    // 先尝试从内存中获取
    if (csrfTokenCache.value && csrfTokenExpiry.value > Date.now()) {
        return csrfTokenCache.value
    }
    
    // 从后端获取新 Token
    try {
        const response = await fetch('/api/auth.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_csrf_token' })
        })
        const result = await response.json()
        
        if (result.success) {
            csrfTokenCache.value = result.csrfToken
            csrfTokenExpiry.value = Date.now() + 3600000 // 1 小时
            return result.csrfToken
        }
    } catch (e) {
        console.error('Failed to get CSRF token:', e)
    }
    
    // 回退到客户端生成
    return Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}
```

### 建议

**当前实现已足够安全**，无需修改 CSRF Token 存储方式。如果实施 HttpOnly Cookie 方案（认证 Token），CSRF Token 可以保持当前实现。

---

## 实施优先级

1. **立即实施**：方案 1（后端设置 HttpOnly Cookie）
2. **测试环境验证**：确保登录、登出、会话验证正常
3. **生产环境部署**：配合 HTTPS 强制启用

---

## 兼容性说明

- **浏览器支持**：所有现代浏览器均支持 HttpOnly Cookie
- **Retinbox 平台**：PHP `setcookie()` 函数支持 HttpOnly 参数
- **向后兼容**：需要清除旧的非 HttpOnly Cookie

---

## 测试清单

- [ ] 登录成功后，Cookie 设置为 HttpOnly
- [ ] 前端无法通过 `document.cookie` 读取 Token
- [ ] 后端可正常验证 Cookie 中的 Token
- [ ] 登出时正确清除 Cookie
- [ ] 会话过期后自动跳转登录
- [ ] HTTPS 环境下 Secure 标志正确设置

---

## 参考资料

- [OWASP: HttpOnly Cookie](https://owasp.org/www-community/HttpOnly)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [PHP setcookie() 文档](https://www.php.net/manual/en/function.setcookie.php)

---

**下一步**：实施方案 1，修改 `auth.php` 和 `useAuth.js`
