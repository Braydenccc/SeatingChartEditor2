# 安全审计报告 - 单元 1：后端 API 安全

**审计日期**: 2026-04-26  
**审计范围**: 后端 API 认证、授权、CSRF 保护、输入验证、速率限制  
**审计人员**: Claude (手动审计)  

---

## 1. 检查摘要

本次审计检查了以下文件和模块：

- **`public/api/auth.php`** (229 行) - 认证 API（注册、登录、登出、设置）
- **`public/api/workspace.php`** (179 行) - 工作区 API（保存、列表、加载、删除）
- **`public/api/common.php`** (118 行) - 共享工具函数

**检查内容**：
- 认证和授权机制完整性
- CSRF 保护实现
- 输入验证覆盖率
- 速率限制有效性
- 错误处理和信息泄露
- HTTPS 强制执行

---

## 2. 发现的安全问题

### 2.1 严重问题

#### 问题 1: GET 参数可能绕过 CSRF 保护

**位置**: `public/api/common.php` 第 105-107 行

**问题描述**:
```php
// 回退到 $_GET（URL 参数）
if ((!$input || !isset($input['action'])) && !empty($_GET) && isset($_GET['action'])) {
    $input = $_GET;
}
```

- `parseRequestInput()` 函数接受 GET 参数作为输入
- GET 请求可能绕过 CSRF 检查（浏览器会自动发送 Cookie，但无法设置自定义请求头）
- 攻击者可构造恶意链接：`https://example.com/api/workspace.php?action=delete&fileId=xxx&username=victim&token=stolen&_csrf=guessed`

**风险**:
- CSRF 保护失效
- 攻击者可通过钓鱼链接执行未授权操作
- 影响所有 API 端点

**影响范围**: 所有后端 API

**修复建议**:
```php
// 仅接受 POST 请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method Not Allowed'], 405);
}

// 移除 GET 参数回退逻辑
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input && !empty($_POST)) {
    $input = $_POST;
}

if (!$input || !isset($input['action'])) {
    respond(['success' => false, 'message' => 'Invalid Request'], 400);
}
```

---

#### 问题 2: HTTPS 可选配置

**位置**: `public/api/auth.php` 第 15 行

**问题描述**:
```php
const REQUIRE_HTTPS = false;
```

- HTTPS 强制执行被禁用
- 密码和 Token 可能通过明文 HTTP 传输
- 中间人攻击可窃取凭证

**风险**:
- 密码泄露
- Token 劫持
- 会话劫持

**影响范围**: 所有认证操作

**修复建议**:
```php
const REQUIRE_HTTPS = true; // 生产环境必须启用

// 或根据环境动态配置
$host = $_SERVER['HTTP_HOST'] ?? '';
$isProduction = !strpos($host, 'localhost') && !strpos($host, 'test');
define('REQUIRE_HTTPS', $isProduction);
```

---

### 2.2 高危问题

#### 问题 3: 错误信息泄露（测试环境）

**位置**: `public/api/auth.php` 第 219-224 行

**问题描述**:
```php
$isTestEnv = strpos($host, 'test') !== false || strpos($host, 'localhost') !== false;
$message = $isTestEnv
    ? 'Internal Server Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine()
    : 'Internal Server Error';
```

- 测试环境暴露详细错误信息（异常消息、文件路径、行号）
- 攻击者可通过测试环境探测系统结构
- 可能泄露敏感路径和代码逻辑

**风险**:
- 信息泄露
- 帮助攻击者构造针对性攻击

**影响范围**: 测试环境的所有 API

**修复建议**:
```php
// 仅记录日志，不返回详细信息
error_log("Auth API Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString());
respond(['success' => false, 'message' => 'Internal Server Error'], 500);

// 或使用更严格的环境检测
$isLocalDev = $_SERVER['REMOTE_ADDR'] === '127.0.0.1' || $_SERVER['REMOTE_ADDR'] === '::1';
```

---

#### 问题 4: Token 未加密存储

**位置**: `public/api/auth.php` 第 103-109 行

**问题描述**:
```php
$token = bin2hex(random_bytes(32));
$sessionData = json_encode(['token' => $token, 'expiry' => $expiry]);
$sessionDb->set($username, $sessionData);
```

- Token 以明文形式存储在数据库
- 数据库泄露会直接暴露所有用户的 Token
- 虽然使用了强随机生成，但存储不安全

**风险**:
- 数据库泄露导致大规模账号劫持
- 内部人员可直接读取 Token

**影响范围**: 所有用户会话

**修复建议**:
```php
// 存储 Token 的哈希值
$token = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $token);
$sessionData = json_encode(['tokenHash' => $tokenHash, 'expiry' => $expiry]);
$sessionDb->set($username, $sessionData);

// 验证时比对哈希值
function isAuthorized($sessionDb, $username, $token) {
    // ... 原有逻辑
    $tokenHash = hash('sha256', $token);
    return hash_equals($data['tokenHash'], $tokenHash);
}
```

---

### 2.3 中等问题

#### 问题 5: 速率限制可被绕过（IP 伪造）

**位置**: `public/api/common.php` 第 74-92 行

**问题描述**:
```php
$ip = $_SERVER['HTTP_X_REAL_IP'] ??
      $_SERVER['HTTP_X_FORWARDED_FOR'] ??
      $_SERVER['REMOTE_ADDR'] ??
      'unknown';
```

- 优先使用 `X-Real-IP` 和 `X-Forwarded-For` 请求头
- 攻击者可伪造这些请求头绕过 IP 速率限制
- 仅在反向代理正确配置时安全

**风险**:
- 速率限制失效
- 暴力破解攻击

**影响范围**: IP 速率限制

**修复建议**:
```php
// 仅在可信代理环境下使用 X-Forwarded-For
$trustedProxies = ['127.0.0.1', '::1']; // 配置可信代理 IP
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

if (in_array($remoteAddr, $trustedProxies)) {
    $ip = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $remoteAddr;
} else {
    $ip = $remoteAddr;
}

if (strpos($ip, ',') !== false) {
    $ip = explode(',', $ip)[0];
}
$ip = trim($ip);
```

---

#### 问题 6: 密码强度要求不够严格

**位置**: `public/api/auth.php` 第 85-101 行

**问题描述**:
```php
if (strlen($password) < 8) { ... }
if (!preg_match('/[A-Z]/', $password)) { ... }
if (!preg_match('/[a-z]/', $password)) { ... }
if (!preg_match('/[0-9]/', $password)) { ... }
```

- 密码要求：8 字符 + 大写 + 小写 + 数字
- 未要求特殊字符
- 未检测常见弱密码（如 `Password123`）

**风险**:
- 用户可能使用弱密码
- 暴力破解风险

**影响范围**: 注册功能

**修复建议**:
```php
function validatePassword($password) {
    if (strlen($password) < 12) { // 提高到 12 字符
        respond(['success' => false, 'message' => '密码至少需要 12 个字符']);
    }
    
    if (!preg_match('/[A-Z]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个大写字母']);
    }
    
    if (!preg_match('/[a-z]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个小写字母']);
    }
    
    if (!preg_match('/[0-9]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个数字']);
    }
    
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个特殊字符']);
    }
    
    // 检测常见弱密码
    $weakPasswords = ['Password123', 'Qwerty123', 'Admin123', '12345678'];
    if (in_array($password, $weakPasswords)) {
        respond(['success' => false, 'message' => '密码过于简单，请使用更复杂的密码']);
    }
}
```

---

#### 问题 7: 会话过期时间过长

**位置**: `public/api/auth.php` 第 13-14 行

**问题描述**:
```php
const TOKEN_EXPIRY_DAYS = 30;
const TOKEN_EXPIRY_REMEMBER_ME = 90;
```

- 默认会话 30 天，"记住我" 90 天
- Token 泄露后长期有效
- 无刷新机制

**风险**:
- Token 泄露后长期可用
- 增加账号劫持风险

**影响范围**: 所有用户会话

**修复建议**:
```php
const TOKEN_EXPIRY_DAYS = 7;  // 缩短到 7 天
const TOKEN_EXPIRY_REMEMBER_ME = 30; // 缩短到 30 天

// 或实现 Token 刷新机制
// 短期 Access Token (1 小时) + 长期 Refresh Token (30 天)
```

---

### 2.4 低危问题

#### 问题 8: 缺少账号锁定机制

**位置**: `public/api/auth.php` 速率限制部分

**问题描述**:
- 仅有速率限制（5 次/5 分钟）
- 无永久或临时账号锁定
- 攻击者可持续尝试（每 5 分钟 5 次）

**风险**:
- 长期暴力破解风险

**影响范围**: 登录功能

**修复建议**:
```php
// 添加账号锁定机制
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION = 3600; // 1 小时

function checkAccountLockout($username) {
    $lockoutDb = new Database('users_lockout');
    $data = $lockoutDb->get($username);
    
    if ($data) {
        $lockout = json_decode($data, true);
        if ($lockout['until'] > time()) {
            $remaining = $lockout['until'] - time();
            respond(['success' => false, 'message' => "账号已锁定，请在 {$remaining} 秒后重试"], 403);
        }
    }
}

function recordFailedAttempt($username) {
    $lockoutDb = new Database('users_lockout');
    $data = $lockoutDb->get($username);
    
    $attempts = $data ? json_decode($data, true)['attempts'] : 0;
    $attempts++;
    
    if ($attempts >= MAX_FAILED_ATTEMPTS) {
        $lockoutDb->set($username, json_encode([
            'attempts' => $attempts,
            'until' => time() + LOCKOUT_DURATION
        ]));
    } else {
        $lockoutDb->set($username, json_encode(['attempts' => $attempts, 'until' => 0]));
    }
}
```

---

## 3. 已验证的安全措施

以下安全措施已正确实施：

### 3.1 CSRF 保护 ✅

**位置**: `public/api/common.php` 第 33-46 行

**实施情况**:
- ✅ Double-Submit Cookie 模式
- ✅ 验证请求头和请求体中的 CSRF token
- ✅ 使用 `hash_equals()` 防止时序攻击

**评价**: CSRF 保护实现正确，但需修复 GET 参数绕过问题。

---

### 3.2 密码哈希 ✅

**位置**: `public/api/auth.php` 第 148、178 行

**实施情况**:
- ✅ 使用 `password_hash()` 和 `PASSWORD_DEFAULT`（bcrypt）
- ✅ 使用 `password_verify()` 验证
- ✅ 自动处理盐值

**评价**: 密码哈希实现正确，符合最佳实践。

---

### 3.3 输入验证 ✅

**位置**: `public/api/common.php` 第 25-31 行

**实施情况**:
- ✅ 用户名正则验证（`^[A-Za-z0-9_-]{1,32}$`）
- ✅ 文件 ID 正则验证（`^[A-Za-z0-9_-]{1,64}$`）
- ✅ Token 长度验证（≥32 字符）

**评价**: 输入验证较为完善，建议补充文件 ID 验证到 workspace.php。

---

### 3.4 速率限制 ✅

**位置**: `public/api/auth.php` 第 47-83 行

**实施情况**:
- ✅ 用户名限制（5 次/5 分钟）
- ✅ IP 限制（15 次/5 分钟）
- ✅ 滑动窗口算法

**评价**: 速率限制实现正确，但需修复 IP 伪造问题。

---

### 3.5 安全日志 ✅

**位置**: `public/api/auth.php` 第 17-32 行

**实施情况**:
- ✅ 记录认证事件（成功/失败）
- ✅ 记录 IP 地址和时间戳
- ✅ 使用独立数据库存储

**评价**: 安全日志实现完善，便于审计。

---

## 4. 修复优先级建议

### 高优先级（立即修复）
1. **问题 1**: 禁用 GET 参数，仅接受 POST 请求
2. **问题 2**: 生产环境强制启用 HTTPS
3. **问题 4**: Token 哈希存储

### 中优先级（近期修复）
4. **问题 3**: 移除测试环境详细错误信息
5. **问题 5**: 修复 IP 伪造漏洞
6. **问题 6**: 提高密码强度要求

### 低优先级（可选优化）
7. **问题 7**: 缩短会话过期时间或实现 Token 刷新
8. **问题 8**: 添加账号锁定机制

---

## 5. 总体评价

**安全性评分**: 7.0/10

**优点**:
- ✅ CSRF 保护实现正确
- ✅ 密码哈希符合最佳实践
- ✅ 输入验证较为完善
- ✅ 速率限制有效
- ✅ 安全日志完善

**不足**:
- ❌ GET 参数可能绕过 CSRF 保护
- ❌ HTTPS 可选配置
- ❌ Token 明文存储
- ❌ 错误信息泄露

**建议**:
1. 优先修复高优先级问题（GET 参数、HTTPS、Token 存储）
2. 加强密码强度要求
3. 修复 IP 伪造漏洞
4. 考虑添加账号锁定机制

---

**审计完成时间**: 2026-04-26  
**下次审计建议**: 修复高优先级问题后进行复审
