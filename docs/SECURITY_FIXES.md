# 安全修复报告

**修复日期**: 2026-04-26  
**修复人员**: Claude Code (Opus 4.7)  
**严重程度**: 高危

---

## 修复概览

本次安全修复解决了 6 个安全漏洞，涵盖认证、授权、数据保护等关键领域。

---

## 已修复的安全问题

### 1. CSRF 保护逻辑漏洞 (P0 - 高危)

**问题描述**:  
原 `ensureCsrfMatched()` 函数使用 OR 逻辑，只要提供 Header 或 Body 中任意一个 CSRF token 即可通过验证，攻击者可以伪造请求。

**修复前**:
```php
if ($csrfHeader !== '' || $bodyCsrf !== '') {
    return true;  // 危险：只需提供一个即可
}
```

**修复后**:
```php
if ($csrfHeader !== '' && $bodyCsrf !== '' && hash_equals($csrfHeader, $bodyCsrf)) {
    return true;  // 必须同时提供且匹配
}
return false;  // 其他情况全部拒绝
```

**影响文件**:
- `public/api/auth.php`
- `public/api/workspace.php`
- `dist/api/auth.php`
- `dist/api/workspace.php`

---

### 2. Session Token 无过期机制 (P1 - 中危)

**问题描述**:  
Token 一旦生成永久有效，泄露后攻击者可无限期使用。

**修复方案**:
- 添加 `TOKEN_EXPIRY_DAYS = 30` 常量
- Token 存储格式改为 `{token, expiry}` JSON 结构
- `isAuthorized()` 函数增加过期时间检查
- 过期 Token 自动删除

**修复后代码**:
```php
function issueSessionToken($sessionDb, $username) {
    $token = bin2hex(random_bytes(32));
    $expiry = time() + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60);
    $sessionData = json_encode(['token' => $token, 'expiry' => $expiry]);
    $sessionDb->set($username, $sessionData);
    return $token;
}

function isAuthorized($sessionDb, $username, $token) {
    // ... 验证逻辑
    if (time() > $sessionData['expiry']) {
        $sessionDb->delete($username);
        return false;
    }
    return hash_equals($sessionData['token'], $token);
}
```

**影响文件**:
- `public/api/auth.php`
- `public/api/workspace.php`
- `dist/api/auth.php`
- `dist/api/workspace.php`

---

### 3. 强制 HTTPS 检查 (P2 - 中危)

**问题描述**:  
密码可能通过 HTTP 明文传输。

**修复方案**:
- 添加 `REQUIRE_HTTPS = false` 配置常量（默认关闭，生产环境建议开启）
- 新增 `ensureHttps()` 函数检查连接协议
- 支持反向代理场景（检查 `X-Forwarded-Proto` 头）

**修复后代码**:
```php
const REQUIRE_HTTPS = false;  // 生产环境设为 true

function ensureHttps() {
    if (!REQUIRE_HTTPS) {
        return;
    }
    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
               (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    if (!$isHttps) {
        respond(['success' => false, 'message' => '必须使用 HTTPS 连接'], 403);
    }
}
```

**使用位置**:
- `register` 操作
- `login` 操作

**影响文件**:
- `public/api/auth.php`
- `dist/api/auth.php`

---

### 4. 基于 IP 的速率限制 (P3 - 中危)

**问题描述**:  
原速率限制仅基于用户名，攻击者可通过尝试不同用户名绕过限制。

**修复方案**:
- 新增 `checkIpRateLimit()` 函数
- IP 限制阈值为用户名限制的 3 倍（15 次/5 分钟）
- 使用 `$_SERVER['REMOTE_ADDR']` 获取客户端 IP

**修复后代码**:
```php
function checkIpRateLimit() {
    $rateLimitDb = new Database('users_rate_limit');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = 'ip_' . $clientIp;
    // ... 限制逻辑（与用户名限制类似）
    if (count($attempts) >= MAX_ATTEMPTS * 3) {
        respond(['success' => false, 'message' => "IP 请求过于频繁，请在 {$waitTime} 秒后重试"], 429);
    }
}
```

**使用位置**:
- `register` 操作
- `login` 操作

**影响文件**:
- `public/api/auth.php`
- `dist/api/auth.php`

---

### 5. 文件 ID 生成算法改进 (P2 - 中危)

**问题描述**:  
使用 `uniqid('ws_')` 生成文件 ID，基于时间戳，容易被预测和枚举。

**修复方案**:
- 改用 `bin2hex(random_bytes(16))` 生成 32 字符随机 ID
- 提供 128 位熵，几乎不可能被猜测

**修复前**:
```php
$fileId = uniqid('ws_');  // 示例: ws_661a2b3c4d5e6
```

**修复后**:
```php
$fileId = bin2hex(random_bytes(16));  // 示例: 3f8a9b2c1d4e5f6a7b8c9d0e1f2a3b4c
```

**影响文件**:
- `public/api/workspace.php`
- `dist/api/workspace.php`

---

### 6. 错误信息泄露修复 (P3 - 低危)

**问题描述**:  
注册时返回"该用户名已被注册"，攻击者可枚举有效用户名。

**修复方案**:
- 统一错误消息为"注册失败，请检查输入或稍后重试"
- 不透露用户名是否存在

**修复前**:
```php
respond(['success' => false, 'message' => '该用户名已被注册']);
```

**修复后**:
```php
respond(['success' => false, 'message' => '注册失败，请检查输入或稍后重试']);
```

**影响文件**:
- `public/api/auth.php`
- `dist/api/auth.php`

---

## 配置建议

### 生产环境部署前

1. **启用 HTTPS 强制检查**:
   ```php
   // public/api/auth.php
   const REQUIRE_HTTPS = true;  // 改为 true
   ```

2. **确保服务器配置 HTTPS**:
   - 使用有效的 SSL/TLS 证书
   - 配置 HSTS 头（`Strict-Transport-Security`）

3. **监控速率限制触发**:
   - 定期检查 `users_rate_limit` 数据库
   - 记录异常 IP 地址

---

## 兼容性说明

### 破坏性变更

1. **Token 存储格式变更**:
   - 旧 Token（字符串格式）将无法通过新的 `isAuthorized()` 验证
   - **影响**: 所有现有用户需要重新登录
   - **迁移方案**: 清空 `users_sessions` 数据库或等待用户自然重新登录

2. **CSRF 验证严格化**:
   - 必须同时提供 Header 和 Body 中的 CSRF token
   - **影响**: 不符合规范的客户端请求将被拒绝
   - **前端兼容**: 现有前端代码已正确实现，无需修改

### 非破坏性变更

- 文件 ID 生成算法（仅影响新创建的文件）
- IP 速率限制（新增功能）
- HTTPS 检查（默认关闭）
- 错误消息调整（不影响功能）

---

## 测试建议

### 手动测试清单

- [ ] 注册新用户
- [ ] 登录现有用户
- [ ] 验证 Token 过期（修改 `TOKEN_EXPIRY_DAYS` 为 0 测试）
- [ ] 触发速率限制（连续失败登录 5 次）
- [ ] 触发 IP 速率限制（连续失败登录 15 次）
- [ ] 保存/加载/删除工作区文件
- [ ] 验证 CSRF 保护（使用 Postman 发送不匹配的 token）

### 自动化测试

建议添加以下测试用例：
- Token 过期验证
- CSRF 双重验证
- 速率限制边界测试
- 文件 ID 唯一性测试

---

## 后续改进建议

1. **日志审计系统**:
   - 记录所有登录尝试（成功/失败）
   - 记录敏感操作（文件删除、设置修改）

2. **双因素认证 (2FA)**:
   - 支持 TOTP（Google Authenticator）
   - 邮箱验证码

3. **Content Security Policy (CSP)**:
   - 防御 XSS 攻击
   - 限制资源加载来源

4. **Token 自动刷新**:
   - 接近过期时自动续期
   - 避免用户频繁重新登录

5. **IP 白名单/黑名单**:
   - 支持管理员配置可信 IP
   - 自动封禁恶意 IP

---

## 参考资料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PHP Security Best Practices](https://www.php.net/manual/en/security.php)

---

**修复完成时间**: 2026-04-26  
**版本**: v2.0-security-patch
