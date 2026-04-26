# 安全审计报告 - 单元 4：数据库操作安全

**审计日期**: 2026-04-26  
**审计范围**: 数据库操作、键名消毒、用户数据隔离、敏感数据存储  
**审计人员**: Claude (手动审计)  

---

## 1. 检查摘要

本次审计检查了以下文件和模块：

- **`public/api/common.php`** (118 行) - 共享工具函数
- **`public/api/workspace.php`** (179 行) - 工作区数据库操作
- **`public/api/auth.php`** (229 行) - 认证数据库操作

**检查内容**：
- 数据库键名消毒（sanitizeDbKey 使用覆盖率）
- SQL 注入风险（KV 数据库键值构造）
- 用户数据隔离（文件访问控制）
- 数据验证和清理
- 敏感数据存储（密码哈希、token 加密）

---

## 2. 发现的安全问题

### 2.1 严重问题

#### 问题 1: 数据库键名未全面消毒

**位置**: `public/api/workspace.php` 多处

**问题描述**:
```php
// 第 65 行 - 未使用 sanitizeDbKey
$userFilesKey = $username . '_files';

// 第 84 行 - 未使用 sanitizeDbKey
$userFilesKey = $username . '_files';

// 第 159 行 - 未使用 sanitizeDbKey
$userFilesKey = $username . '_files';
```

- 用户名直接拼接到数据库键名
- 虽然用户名经过 `isValidUsername()` 验证（仅允许 `[A-Za-z0-9_-]`），但未使用 `sanitizeDbKey()` 二次清理
- 如果验证逻辑被绕过，可能导致键名污染

**风险**:
- 键名污染
- 数据混乱
- 潜在的越权访问

**影响范围**: 所有用户文件列表操作

**修复建议**:
```php
// 统一使用 sanitizeDbKey 处理所有键名
$userFilesKey = sanitizeDbKey($username . '_files');

// 或创建专门的函数
function getUserFilesKey($username) {
    if (!isValidUsername($username)) {
        respond(['success' => false, 'message' => '无效的用户名'], 400);
    }
    return sanitizeDbKey($username . '_files');
}

// 使用
$userFilesKey = getUserFilesKey($username);
```

---

#### 问题 2: 文件 ID 未消毒直接用作键名

**位置**: `public/api/workspace.php` 第 62、90、124、154 行

**问题描述**:
```php
// 第 62 行
$dbFiles->set($fileId, json_encode($fileData));

// 第 90 行
$fileRaw = $dbFiles->get($fileId);

// 第 124 行
$fileRaw = $dbFiles->get($fileId);

// 第 154 行
$dbFiles->delete($fileId);
```

- 文件 ID 未经 `sanitizeDbKey()` 处理直接用作数据库键名
- 虽然有 `isValidFileId()` 验证，但未在所有地方调用（见单元 5 报告）
- 存在键名污染风险

**风险**:
- 键名污染
- 数据覆盖
- 越权访问

**影响范围**: 所有文件操作

**修复建议**:
```php
// 在所有数据库操作前消毒键名
if (!isValidFileId($fileId)) {
    respond(['success' => false, 'message' => '无效的文件 ID 格式']);
}
$safeFileId = sanitizeDbKey($fileId);

// 使用消毒后的键名
$dbFiles->set($safeFileId, json_encode($fileData));
$fileRaw = $dbFiles->get($safeFileId);
$dbFiles->delete($safeFileId);
```

---

### 2.2 高危问题

#### 问题 3: 用户数据隔离依赖元数据

**位置**: `public/api/workspace.php` 第 94、134、156 行

**问题描述**:
```php
// 第 94 行 - list 操作
if ($fileData['metadata']['author'] === $username) {
    $list[] = [
        'fileId' => $fileId,
        'metadata' => $fileData['metadata']
    ];
}

// 第 134 行 - load 操作
if ($fileData['metadata']['author'] !== $username) {
    respond(['success' => false, 'message' => '无权访问该文件']);
}

// 第 156 行 - delete 操作
if ($fileData && isset($fileData['metadata']) && $fileData['metadata']['author'] === $username) {
    $dbFiles->delete($fileId);
}
```

- 用户数据隔离完全依赖文件元数据中的 `author` 字段
- 如果元数据被篡改或损坏，隔离机制失效
- 没有独立的权限表或访问控制列表

**风险**:
- 元数据损坏导致权限混乱
- 数据库直接操作可绕过权限检查
- 缺少审计日志

**影响范围**: 所有文件访问控制

**修复建议**:
```php
// 方案 1: 使用独立的权限表
// users_files 表存储 username -> [fileId1, fileId2, ...]
// 验证时同时检查权限表和元数据

function hasFileAccess($username, $fileId, $dbUsers, $dbFiles) {
    // 检查权限表
    $userFilesKey = sanitizeDbKey($username . '_files');
    $fileIds = $dbUsers->get_array($userFilesKey);
    if (!in_array($fileId, $fileIds)) {
        return false;
    }
    
    // 检查元数据（双重验证）
    $fileRaw = $dbFiles->get($fileId);
    if (!$fileRaw) return false;
    
    $fileData = json_decode($fileRaw, true);
    if (!$fileData || !isset($fileData['metadata'])) return false;
    
    return $fileData['metadata']['author'] === $username;
}

// 方案 2: 使用命名空间隔离
// 键名格式：user:{username}:file:{fileId}
// 用户只能访问自己命名空间下的键
```

---

#### 问题 4: 敏感数据未加密存储

**位置**: `public/api/auth.php` 第 107-108 行

**问题描述**:
```php
$sessionData = json_encode(['token' => $token, 'expiry' => $expiry]);
$sessionDb->set($username, $sessionData);
```

- Token 以明文形式存储在数据库
- 数据库泄露会直接暴露所有用户的 Token
- 虽然 Token 是随机生成的，但存储不安全

**风险**:
- 数据库泄露导致大规模账号劫持
- 内部人员可直接读取 Token
- 无法检测 Token 是否被窃取

**影响范围**: 所有用户会话

**修复建议**:
```php
// 存储 Token 的哈希值而非明文
$token = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $token);
$sessionData = json_encode(['tokenHash' => $tokenHash, 'expiry' => $expiry]);
$sessionDb->set($username, $sessionData);

// 验证时比对哈希值
function isAuthorized($sessionDb, $username, $token) {
    if (!is_string($username) || !is_string($token) || strlen($token) < MIN_TOKEN_LENGTH) {
        return false;
    }
    $savedData = $sessionDb->get($username);
    if (!$savedData) {
        return false;
    }

    $data = json_decode($savedData, true);
    if (!is_array($data) || !isset($data['tokenHash']) || !isset($data['expiry'])) {
        return false;
    }

    if (time() > (int)$data['expiry']) {
        $sessionDb->delete($username);
        return false;
    }

    $tokenHash = hash('sha256', $token);
    return hash_equals($data['tokenHash'], $tokenHash);
}
```

---

### 2.3 中等问题

#### 问题 5: 缺少数据库操作审计日志

**位置**: 所有数据库操作

**问题描述**:
- 除了认证操作（`logSecurityEvent()`），其他数据库操作无审计日志
- 无法追踪文件的创建、修改、删除历史
- 无法检测异常操作

**风险**:
- 数据丢失无法追溯
- 恶意操作无法检测
- 合规性问题

**影响范围**: 所有数据库操作

**修复建议**:
```php
// 添加通用审计日志函数
function logDatabaseOperation($operation, $username, $details = []) {
    try {
        $auditDb = new Database('audit_logs');
        $logEntry = json_encode([
            'operation' => $operation,
            'username' => $username,
            'ip' => getClientIp(),
            'time' => time(),
            'timestamp' => date('c'),
            'details' => $details
        ], JSON_UNESCAPED_UNICODE);
        $auditDb->push('operations', $logEntry);
    } catch (Exception $e) {
        error_log("Audit log failed: {$operation} for {$username} - " . $e->getMessage());
    }
}

// 在关键操作中使用
if ($action === 'save') {
    // ... 保存逻辑
    logDatabaseOperation('file_save', $username, ['fileId' => $fileId, 'size' => $contentSize]);
}

if ($action === 'delete') {
    // ... 删除逻辑
    logDatabaseOperation('file_delete', $username, ['fileId' => $fileId]);
}
```

---

#### 问题 6: 数据验证不完整

**位置**: `public/api/workspace.php` 第 36-40 行

**问题描述**:
```php
$name = isset($input['name']) ? trim($input['name']) : '未命名工作区';
$content = isset($input['content']) ? $input['content'] : '';

if (empty($content)) {
    respond(['success' => false, 'message' => '工作区内容不能为空']);
}
```

- 仅验证 `content` 非空
- 未验证 `name` 长度和格式
- 未验证 `content` 的 JSON 格式
- 未验证 `content` 的结构（必需字段）

**风险**:
- 恶意数据污染数据库
- 超长名称导致存储问题
- 无效数据导致加载失败

**影响范围**: 工作区保存功能

**修复建议**:
```php
// 验证名称
$name = isset($input['name']) ? trim($input['name']) : '未命名工作区';
if (strlen($name) > 100) {
    respond(['success' => false, 'message' => '工作区名称过长，最多 100 字符']);
}
$name = sanitizeDbKey($name); // 清理特殊字符

// 验证内容
$content = isset($input['content']) ? $input['content'] : '';
if (empty($content)) {
    respond(['success' => false, 'message' => '工作区内容不能为空']);
}

// 验证 JSON 格式
if (is_string($content)) {
    $parsed = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'message' => '工作区内容格式无效']);
    }
    $content = $parsed;
}

// 验证必需字段
if (!isset($content['students']) || !is_array($content['students'])) {
    respond(['success' => false, 'message' => '工作区内容缺少学生数据']);
}
```

---

### 2.4 低危问题

#### 问题 7: 数据库错误处理不完善

**位置**: `public/api/workspace.php` 第 176-178 行

**问题描述**:
```php
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Internal Server Error'], 500);
}
```

- 捕获所有异常但不记录详细信息
- 无法区分不同类型的错误（网络、数据库、逻辑）
- 调试困难

**风险**:
- 调试困难
- 无法监控数据库健康状态

**影响范围**: 所有数据库操作

**修复建议**:
```php
} catch (Exception $e) {
    // 记录详细错误日志
    error_log('Workspace API Exception: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    
    // 根据错误类型返回不同的响应
    $message = 'Internal Server Error';
    $code = 500;
    
    if (strpos($e->getMessage(), 'Database') !== false) {
        $message = '数据库操作失败，请稍后重试';
        $code = 503;
    }
    
    respond(['success' => false, 'message' => $message], $code);
}
```

---

## 3. 已验证的安全措施

### 3.1 密码哈希 ✅

**位置**: `public/api/auth.php` 第 148、178 行

**实施情况**:
- ✅ 使用 `password_hash()` 和 `PASSWORD_DEFAULT`（bcrypt）
- ✅ 使用 `password_verify()` 验证
- ✅ 自动处理盐值

**评价**: 密码哈希实现正确，符合最佳实践。

---

### 3.2 用户名验证 ✅

**位置**: `public/api/common.php` 第 25-27 行

**实施情况**:
- ✅ 正则表达式验证（`^[A-Za-z0-9_-]{1,32}$`）
- ✅ 限制长度和字符集
- ✅ 防止注入攻击

**评价**: 用户名验证严格，有效防止注入。

---

### 3.3 键名消毒函数 ✅

**位置**: `public/api/common.php` 第 70-72 行

**实施情况**:
- ✅ 使用正则表达式替换特殊字符
- ✅ 仅保留 `[a-zA-Z0-9_-]`
- ✅ 函数实现正确

**评价**: 键名消毒函数实现正确，但使用覆盖率不足。

---

### 3.4 权限验证 ✅

**位置**: `public/api/workspace.php` 多处

**实施情况**:
- ✅ 所有操作前验证用户身份
- ✅ 文件访问前检查所有者
- ✅ 使用 `hash_equals()` 防止时序攻击

**评价**: 权限验证机制较为完善，但依赖元数据存在风险。

---

## 4. 修复优先级建议

### 高优先级（立即修复）
1. **问题 1**: 全面使用 `sanitizeDbKey()` 处理所有键名
2. **问题 2**: 文件 ID 消毒后再用作键名
3. **问题 4**: Token 哈希存储

### 中优先级（近期修复）
4. **问题 3**: 改进用户数据隔离机制（独立权限表或命名空间）
5. **问题 6**: 完善数据验证（名称长度、内容格式、必需字段）
6. **问题 5**: 添加数据库操作审计日志

### 低优先级（可选优化）
7. **问题 7**: 改进错误处理和日志记录

---

## 5. 总体评价

**安全性评分**: 7.0/10

**优点**:
- ✅ 密码哈希实现正确
- ✅ 用户名验证严格
- ✅ 键名消毒函数实现正确
- ✅ 权限验证机制较为完善

**不足**:
- ❌ 键名消毒使用覆盖率不足
- ❌ Token 明文存储
- ❌ 用户数据隔离依赖元数据
- ❌ 数据验证不完整
- ❌ 缺少审计日志

**建议**:
1. 优先修复键名消毒和 Token 存储问题
2. 改进用户数据隔离机制
3. 完善数据验证
4. 添加审计日志
5. 改进错误处理

---

**审计完成时间**: 2026-04-26  
**下次审计建议**: 修复高优先级问题后进行复审
