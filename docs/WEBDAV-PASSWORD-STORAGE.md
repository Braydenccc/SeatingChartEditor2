# WebDAV 密码存储方案

## 概述

为了提升用户体验，允许用户选择在浏览器中记住 WebDAV 密码，避免每次刷新页面都需要重新输入。密码使用 AES-GCM 加密后存储在浏览器 Cookie 中。

## 实现方案

### 加密算法

- **算法**：AES-GCM (256-bit)
- **密钥派生**：PBKDF2 (100,000 iterations, SHA-256)
- **IV**：每次加密生成随机 12 字节 IV
- **存储格式**：Base64 编码的 (IV + 密文)

### 密钥来源

系统根据用户登录状态使用不同的加密密钥：

#### 1. 已登录 SCE 账号（推荐）

- **密钥来源**：用户的 SCE Token
- **安全性**：较高
- **原理**：每个用户的 Token 是唯一的，攻击者需要同时获取 Token 和加密密码才能解密
- **优势**：
  - Token 存储在 Cookie 中，受同源策略保护
  - Token 在服务端有过期机制
  - 不同用户使用不同密钥

#### 2. 未登录 SCE 账号（不推荐）

- **密钥来源**：通用密钥 `sce-webdav-fallback-key-v1`
- **安全性**：较低
- **原理**：所有未登录用户使用相同的通用密钥
- **风险**：
  - 通用密钥硬编码在前端代码中
  - 攻击者可以通过阅读源代码获取密钥
  - 所有用户使用相同密钥，一旦泄露影响所有人

## 存储位置

- **Cookie 名称**：`sce_webdav_config`
- **存储内容**：
  ```json
  {
    "url": "https://pan.example.com/dav",
    "username": "user123",
    "path": "/sce_data",
    "encryptedPassword": "base64_encoded_encrypted_data"
  }
  ```
- **Cookie 属性**：
  - `SameSite=Lax`：防止 CSRF 攻击
  - `Secure`：仅在 HTTPS 下传输（生产环境）
  - `Path=/`：全站可访问
  - `Max-Age=7天`：7 天后自动过期

## 安全风险

### 1. XSS 攻击风险（高危）

**风险描述**：如果网站存在 XSS 漏洞，攻击者可以：
1. 读取 Cookie 中的加密密码
2. 读取前端代码中的加密密钥（通用密钥或 Token）
3. 在浏览器中执行解密操作
4. 获取明文密码

**缓解措施**：
- 已实施严格的 XSS 防护（详见 `docs/security-audit-unit-2-xss.md`）
- 使用 DOM API 而非 `innerHTML`
- 对所有用户输入进行转义
- 设置 CSP 响应头

**残留风险**：
- 无法完全消除 XSS 风险
- 第三方库可能存在漏洞
- 浏览器扩展可能注入恶意脚本

### 2. 通用密钥泄露风险（中危）

**风险描述**：未登录用户使用的通用密钥硬编码在前端代码中，任何人都可以：
1. 查看浏览器开发者工具
2. 阅读源代码文件 `src/utils/crypto.js`
3. 获取通用密钥 `sce-webdav-fallback-key-v1`

**影响范围**：
- 仅影响未登录 SCE 账号的用户
- 攻击者需要同时获取目标用户的 Cookie

**缓解措施**：
- 在 UI 中明确提示用户风险
- 推荐用户登录 SCE 账号以使用更安全的密钥
- 提供"不记住密码"选项（默认）

### 3. 中间人攻击风险（低危）

**风险描述**：如果用户在 HTTP 环境下使用，Cookie 可能被中间人截获。

**缓解措施**：
- 生产环境强制 HTTPS（`REQUIRE_HTTPS=true`）
- Cookie 设置 `Secure` 属性
- 开发环境可通过环境变量禁用 HTTPS 要求

## 用户指南

### 如何启用密码记住功能

1. 打开 WebDAV 登录对话框
2. 填写服务器地址、用户名、密码
3. **勾选"记住密码（加密存储到浏览器）"复选框**
4. 点击"连接并创建文件夹"

### 安全建议

#### 强烈推荐

1. **登录 SCE 账号后再使用 WebDAV**
   - 提供更强的加密密钥
   - Token 有过期机制
   - 更好的安全保护

2. **使用 WebDAV 应用专用密码**
   - 大多数网盘服务支持生成应用专用密码
   - 即使泄露也不影响主账号
   - 可以随时撤销

3. **定期更换密码**
   - 建议每 3-6 个月更换一次
   - 怀疑泄露时立即更换

#### 不推荐

1. **在公共设备上勾选"记住密码"**
   - 其他人可能访问你的浏览器
   - Cookie 可能被读取

2. **在不信任的网络环境下使用**
   - 公共 WiFi 可能存在中间人攻击
   - 建议使用 VPN

3. **未登录 SCE 账号时记住密码**
   - 安全性较低
   - 通用密钥容易泄露

### 如何清除已保存的密码

1. 点击右上角用户菜单
2. 选择"断开 WebDAV"
3. 或者手动清除浏览器 Cookie：`sce_webdav_config`

## 技术实现

### 加密流程

```javascript
// 1. 派生密钥
const key = await deriveKey(userToken || FALLBACK_KEY)

// 2. 生成随机 IV
const iv = crypto.getRandomValues(new Uint8Array(12))

// 3. 加密密码
const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(password)
)

// 4. 组合 IV + 密文并 Base64 编码
const combined = new Uint8Array(iv.length + encrypted.byteLength)
combined.set(iv, 0)
combined.set(new Uint8Array(encrypted), iv.length)
const base64 = btoa(String.fromCharCode(...combined))
```

### 解密流程

```javascript
// 1. Base64 解码
const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

// 2. 分离 IV 和密文
const iv = combined.slice(0, 12)
const data = combined.slice(12)

// 3. 派生密钥
const key = await deriveKey(userToken || FALLBACK_KEY)

// 4. 解密
const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
)

// 5. 转换为字符串
const password = decoder.decode(decrypted)
```

### 相关文件

- `src/utils/crypto.js` - 加密工具函数
- `src/composables/useAuth.js` - 认证逻辑，包含密码加密/解密
- `src/components/auth/LoginDialog.vue` - WebDAV 登录 UI

## 替代方案

### 方案 1：不存储密码（当前默认）

- **优点**：最安全
- **缺点**：用户体验差，每次刷新都需要重新输入

### 方案 2：后端代理 WebDAV 请求

- **优点**：密码存储在服务端，前端无法访问
- **缺点**：
  - 需要后端支持
  - 增加服务器负载
  - 用户需要信任服务器

### 方案 3：浏览器原生密码管理器

- **优点**：浏览器提供的安全存储
- **缺点**：
  - 需要用户手动保存
  - 不同浏览器行为不一致
  - 无法跨设备同步（除非浏览器账号同步）

## 合规性

### GDPR（欧盟通用数据保护条例）

- ✅ 用户明确同意（勾选复选框）
- ✅ 数据最小化（仅存储必要信息）
- ✅ 透明度（明确告知风险）
- ✅ 用户控制（可随时清除）

### 最佳实践

- ✅ 使用行业标准加密算法（AES-GCM）
- ✅ 密钥派生使用 PBKDF2
- ✅ 每次加密使用随机 IV
- ⚠️ 密钥存储在前端（无法避免）
- ⚠️ 无法防止 XSS 攻击（前端加密的固有限制）

## 总结

WebDAV 密码记住功能是一个**便利性与安全性的权衡**：

- **便利性**：用户无需每次输入密码
- **安全性**：前端加密无法防止 XSS 攻击

**推荐使用场景**：
- 个人设备
- 已登录 SCE 账号
- 使用应用专用密码
- 信任的网络环境

**不推荐使用场景**：
- 公共设备
- 未登录 SCE 账号
- 不信任的网络环境
- 使用主账号密码

**最佳实践**：
1. 登录 SCE 账号
2. 使用 WebDAV 应用专用密码
3. 勾选"记住密码"
4. 定期更换密码
