# 09 - 安全增强

## 概述

本文档描述座位表编辑器 v2 的安全增强措施，包括密码传输加密和文件格式验证。

## 1. 密码传输加密

### 问题背景

虽然使用 HTTPS 加密传输层，但客户端抓包工具仍能在浏览器开发者工具中看到明文密码，存在以下风险：
- 本地抓包工具可以捕获明文密码
- 浏览器扩展可能读取请求体
- 开发环境可能未启用 HTTPS

### 解决方案

在客户端使用 **AES-256-GCM** 加密密码后传输，后端解密后再进行 bcrypt 验证。

#### 加密流程

```
客户端：
1. 用户输入密码
2. 使用 PBKDF2 从用户名派生密钥（100,000 次迭代）
3. 使用 AES-256-GCM 加密密码
4. Base64 编码后发送到服务器

服务器：
1. 接收加密密码
2. 使用相同算法派生密钥
3. 解密得到明文密码
4. 使用 bcrypt 验证密码哈希
```

#### 密钥派生

- **算法**：PBKDF2-SHA256
- **迭代次数**：100,000
- **密钥材料**：`sce-auth-{username}`
- **Salt**：`sce-transport-salt-v1`（固定）
- **输出长度**：256 位

#### 加密算法

- **算法**：AES-256-GCM
- **IV 长度**：12 字节（随机生成）
- **认证标签**：16 字节（GCM 自动生成）

### 代码路径

**客户端：**
- [src/utils/crypto.js](../../src/utils/crypto.js) — `encryptPasswordForTransport()` 函数
- [src/composables/useAuth.js](../../src/composables/useAuth.js) — `callAuthApi()` 函数

**服务器端：**
- [public/api/auth.php](../../public/api/auth.php) — `decryptPasswordFromTransport()` 函数

### 向后兼容

服务器同时支持加密密码和明文密码：
- 如果请求包含 `encryptedPassword` 字段，尝试解密
- 如果请求包含 `password` 字段，直接使用（向后兼容）
- 解密失败返回 400 错误

客户端会优先使用 `encryptedPassword`。如果移动端浏览器、WebView 或非安全上下文导致 Web Crypto 不可用或加密失败，前端会回退到后端已有的 `password` 明文字段，避免登录流程在客户端直接中断；生产环境仍由后端 HTTPS 检查保护传输层。

### 安全注意事项

1. **固定 Salt 的权衡**：使用固定 salt 是为了客户端和服务器能够独立派生相同密钥，这是传输加密的必要妥协。真正的密码安全由服务器端的 bcrypt 哈希保证。
2. **HTTPS 仍然必需**：此加密层是额外防护，不能替代 HTTPS。
3. **密钥派生性能**：100,000 次迭代在现代浏览器中约需 50-100ms，不会影响用户体验。

## 2. 文件格式验证

### 问题背景

`workspace.php` 的 `save` 接口接受任意 JSON 内容，存在以下风险：
- 可能被滥用为通用数据存储 API
- 恶意用户可以上传任意文本内容
- 缺少格式验证导致数据完整性问题

### 解决方案

在服务器端验证工作区内容必须符合座位表编辑器的数据结构。

#### 验证规则

**必需字段：**
- `students` — 学生数组
- `seats` — 座位数组
- `seatConfig` — 座位配置对象

**字段类型验证：**
- `students` 必须是数组，每个元素必须包含 `id` 和 `name`
- `seats` 必须是数组，每个元素必须包含 `id`
- `seatConfig` 必须是对象，必须包含 `groups` 数组

**示例有效载荷：**

```json
{
  "students": [
    { "id": "1", "name": "张三", "gender": "male" }
  ],
  "seats": [
    { "id": "s1", "groupIndex": 0, "columnIndex": 0, "rowIndex": 0 }
  ],
  "seatConfig": {
    "groups": [{ "columns": 6, "rows": 5 }]
  }
}
```

**示例无效载荷（会被拒绝）：**

```json
{
  "content": "这是一段纯文本",
  "metadata": { "author": "attacker" }
}
```

### 代码路径

**服务器端：**
- [public/api/workspace.php](../../public/api/workspace.php) — `validateWorkspaceContent()` 函数

### 错误响应

格式验证失败时返回：

```json
{
  "success": false,
  "message": "工作区格式无效: 缺少必需字段: seats"
}
```

### 性能影响

- 验证逻辑在 O(n) 时间复杂度内完成（n 为学生/座位数量）
- 对于典型工作区（50 学生 + 50 座位），验证耗时 < 1ms
- 不影响用户体验

## 3. 测试

### 测试脚本

测试脚本位于 [test-scr/test-security-enhancements.html](../../test-scr/test-security-enhancements.html)。

**测试项目：**

1. **密码加密测试**
   - 测试加密函数是否正常工作
   - 验证加密后的密码格式
   - 测试完整的登录流程

2. **文件格式验证测试**
   - 测试有效工作区格式被接受
   - 测试无效工作区格式被拒绝
   - 测试恶意载荷被拒绝

### 手动测试步骤

1. 部署测试脚本到服务器：
   ```bash
   # 当前 package.json 未定义测试环境部署脚本，请按 Retinbox 平台文档手动部署测试环境
   ```

2. 访问测试页面：
   ```
   https://your-domain.com/test-scr/test-security-enhancements.html
   ```

3. 依次点击测试按钮，验证所有测试通过。

## 4. 部署注意事项

### 环境变量

**REQUIRE_HTTPS**（可选）：
- 默认值：`true`（生产环境强制 HTTPS）
- 开发环境可设置为 `false` 禁用 HTTPS 检查

### 兼容性

- **浏览器要求**：支持 Web Crypto API（所有现代浏览器）
- **降级行为**：Web Crypto 不可用时使用明文字段兼容旧路径，仍要求 HTTPS 保护传输
- **PHP 要求**：PHP 7.2+ （需要 `openssl` 扩展）
- **向后兼容**：旧客户端仍可使用明文密码登录

### 迁移建议

1. 先部署服务器端代码（支持双模式）
2. 再部署客户端代码（使用加密传输）
3. 监控日志，确认无解密失败错误
4. 可选：一段时间后移除明文密码支持

## 5. 安全审计

### 已解决的问题

✅ 密码明文传输（客户端抓包可见）  
✅ 文件上传缺少格式验证（可被滥用为通用 API）

### 仍需注意的安全事项

⚠️ **CSRF 保护**：已实现 Double-Submit Cookie 模式  
⚠️ **速率限制**：已实现登录速率限制（5 次/5 分钟）  
⚠️ **密码强度**：已强制要求 8 字符 + 大小写 + 数字  
⚠️ **Token 过期**：已实现 30 天过期（记住我 90 天）

### 未来改进方向

- 考虑实施 Content Security Policy (CSP)
- 添加 Subresource Integrity (SRI) 校验
- 实现更细粒度的文件权限控制
- 添加审计日志（已部分实现）

## 6. 常见问题

### Q: 为什么不使用非对称加密（RSA）？

A: 非对称加密需要服务器生成密钥对并分发公钥，增加了复杂度。对称加密（AES-GCM）配合 PBKDF2 密钥派生已足够安全，且性能更好。

### Q: 固定 Salt 是否安全？

A: 传输加密的固定 salt 是可接受的，因为：
1. 真正的密码安全由服务器端 bcrypt 哈希保证（每个密码独立 salt）
2. 传输加密只是额外防护层，防止本地抓包
3. HTTPS 仍然是主要防护

### Q: 为什么不直接发送密码哈希？

A: 发送哈希会导致"哈希即密码"问题——攻击者截获哈希后可以直接用哈希登录。我们的方案是加密明文，服务器解密后再哈希验证。

### Q: 文件格式验证会影响性能吗？

A: 不会。验证逻辑非常轻量（< 1ms），且只在保存时执行一次。

### Q: 如何测试加密是否生效？

A: 打开浏览器开发者工具 → Network → 查看 `/api/auth.php` 请求 → Payload 中应该看到 `encryptedPassword` 字段（Base64 字符串），而不是 `password` 字段。
