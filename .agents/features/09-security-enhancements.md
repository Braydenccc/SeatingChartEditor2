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
- [src/utils/crypto.ts](../../src/utils/crypto.ts) — `encryptPasswordForTransport()` 函数
- [src/composables/useAuth.ts](../../src/composables/useAuth.ts) — `callAuthApi()` 函数

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
- `tags` — 标签数组
- `layout.seats`（或旧版 `seats`）— 座位数组
- `layout.config`（或旧版 `seatConfig`）— 座位配置对象

**字段类型验证：**
- `students` 必须是数组，每个元素必须包含 `id` 和 `name`
- `tags` 必须是数组，每个元素必须包含 `id`、`name` 和 `color`
- `seats` 必须是数组，每个元素必须包含 `id`
- 客户端会在修改现有状态前完成嵌套结构、唯一 ID、容量上限和布局字段校验

**示例有效载荷：**

```json
{
  "students": [
    { "id": "1", "name": "张三", "gender": "male" }
  ],
  "tags": [
    { "id": "tag-1", "name": "重点", "color": "#FF0000" }
  ],
  "layout": {
    "seats": [
      { "id": "seat-0-0-0", "group": 0, "col": 0, "row": 0 }
    ],
    "config": {
      "groupCount": 1,
      "columnsPerGroup": 1,
      "seatsPerColumn": 1,
      "groups": [{ "columns": 1, "rows": 1 }]
    }
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

**客户端：**
- [src/utils/workspaceValidation.ts](../../src/utils/workspaceValidation.ts) — 完整工作区结构校验
- [src/composables/useWorkspace.ts](../../src/composables/useWorkspace.ts) — 迁移、原子提交与失败回滚

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

后端安全回归同时由 CI 覆盖：所有 `public/api/*.php` 会运行 PHP lint，离线契约夹具验证账号/session、DAV 公网地址与请求体限制、调试端点默认关闭。Vite mock 与浏览器 E2E 不能替代这组 PHP 检查。

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

**TRUST_PROXY_PROTO_HEADERS**（可选）：
- 默认值：`false`，此时忽略 `X-Forwarded-Proto`、`X-Forwarded-SSL` 和 `CF-Visitor`
- 只有应用位于受控反向代理之后，且代理会覆盖或清除客户端传入的同名头时，才可设置为 `true`

**TRUST_PROXY_IP_HEADERS**（可选）：
- 默认值：`false`，客户端 IP 直接取 `REMOTE_ADDR`
- 仅在同样受控的反向代理边界内启用；否则攻击者可伪造限流来源地址

管理 API 的本地 HTTP 例外只根据 `REMOTE_ADDR` 是否为 loopback 判断，不信任可由客户端伪造的 `Host`。非本机开发若确需 HTTP，必须显式设置 `ADMIN_ALLOW_HTTP=true`。

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

- 已解决：密码明文传输（客户端抓包可见）
- 已解决：文件上传缺少格式验证（可被滥用为通用 API）
- 已解决：WebDAV DNS 预检与 cURL 连接二次解析之间的重绑定窗口；已固定预检 IP，并在连接前拒绝 mapped/compatible/NAT64/6to4/Teredo/ISATAP 等转换地址。
- 已解决：DAV 请求体只依赖 `Content-Length` 的 10 MiB 限制；现按实际读取字节强制执行。
- 已解决：调试端点信任 `Host` 或代理回环地址；现在生产环境始终关闭，只允许 development/test 显式开关加独立高熵请求头令牌。

### 仍需注意的安全事项

- 注意：**CSRF 保护**：已实现 Double-Submit Cookie 模式
- 注意：**速率限制**：已实现登录速率限制（5 次/5 分钟）
- 注意：**密码强度**：已强制要求 8 字符 + 大小写 + 数字
- 注意：**Token 过期**：已实现 30 天过期（记住我 90 天）
- 注意：**限流并发安全**：登录、IP 和管理接口限流使用 Retinbox 原子数组 `push` 记录独立尝试，并清理时间窗口外条目，不再使用会丢增量的 `get`/`set` 读改写。
- 注意：**对象权限隔离**：工作区权限使用无歧义哈希键，读取时同时核对 `username`、`fileId` 和权限值；旧键只在主体完全匹配时迁移。
- 注意：**写入确认**：工作区单条 KV 使用 60000 字节/字符安全上限，写入后回读校验；列表数组追加也会确认结果。
- 注意：**注册补偿**：同一用户名注册先通过 Retinbox 原子数组取得短期租约，再按账号、带 `registrationMarker` 的待提交资料、会话三步写入。提交资料与成功响应前均核对账号、资料和会话仍属于本次请求；失败补偿只删除与本次 expected value 一致的数据，避免并发注册互相删除或清理后来覆盖的数据。
- 注意：**审计编码**：管理审计与认证安全日志字段先规范为有效 UTF-8 并安全截断，JSON 编码使用无效 UTF-8 替换；认证安全日志单条最多 4096 字节，主记录过大或无法编码时写入最小兜底记录并同步记录有界服务器错误日志。
- 注意：**禁用会话吊销**：管理员禁用账号时会先轮换持久化 `sessionEpoch`，再删除当前服务端会话；重新启用前再次确认删除成功。鉴权同时核对 profile 世代与签发时的密码哈希指纹，因此即使删除失败或并发登录晚于删除写入，禁用前及旧密码签发的 token 也不会恢复有效。禁用、重新启用、管理员重置密码和用户修改密码共用同一账号安全租约；自助改密在租约内先吊销旧会话再写入密码和新会话，不会用陈旧 profile 覆盖管理员操作。
- 注意：**服务端文件标识**：新建云工作区的 `fileId` 仅由服务端随机生成。客户端提供的 ID 只可覆盖已存在且有写权限的工作区，不能用于预占或选择新建记录键。

### 未来改进方向

- 考虑实施 Content Security Policy (CSP)
- 添加 Subresource Integrity (SRI) 校验
- 实现更细粒度的文件权限控制
- 添加审计日志（已部分实现）

### 已知待决风险

WebDAV 密码当前仍使用前端源码中的固定 fallback key 加密。该机制可避免直接明文展示，但无法在 `users_settings` 数据库或本地 Cookie 泄露时保护第三方 WebDAV 凭据。本轮不改变凭据策略；后续需要在“桌面系统凭据库、Web 端仅内存保存、用户口令派生”之间做产品取舍。

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
