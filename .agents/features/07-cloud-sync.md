---
module_name: Cloud Sync & Authentication
description: 官方账号认证机制及泛底层的 WebDAV 私有同步双轨方案。
related_files:
  - src/composables/useAuth.ts
  - src/composables/useWebDav.ts
  - src/composables/useCloudWorkspace.ts
---

# 07-云端同步与认证 (Cloud Sync & Authentication)

## 1. 核心职责 (Core Purpose)
由于本软件定位“开箱即用”且部署在 Retinbox 上，因此提供了非常轻量的 `api/auth.php` 和 `api/workspace.php` 用于储存 `.sce` 存档。同时考虑到部分敏感学校不用公有云，所以内嵌了纯前端的纯原生 WebDAV 协议引擎。

## 2. 源代码入口 (Source Files)
- 登录认证态: `src/composables/useAuth.ts`
- WebDAV 底层驱动: `src/composables/useWebDav.ts`
- 聚合存储操作平台: `src/composables/useCloudWorkspace.ts`
- 桌面端 HTTP/API 适配: `src/platform/apiClient.ts`、`src/platform/webdavTransport.ts`

## 3. 数据模型 / 核心API (Data Models & Core API)

```typescript
// useAuth.ts 控制着当前的全局读写源
const authType = ref<'retiehe' | 'webdav'>('retiehe')
const backupMode = ref<boolean>(false) // 若开启，存入 retiehe 时会静默镜像抄送到 webdav
```

## 4. 关键实现节点 (Implementation Details)
- **Double-Submit Cookie (CSRF)**: 由于该软件在浏览器中运行且不依赖重型框架路由，安全机制非常原始但有效。`getOrCreateCsrfToken` 会往 Cookie 和 Fetch Request Header 里塞入相同的 Token 来防御攻击。
- **DAV Proxy 劫持 (`fetch('/api/dav-proxy.php')`)**: 很多国企或个人的私有 WebDAV（尤其是群晖、坚果云）是**绝对不支持跨域 (CORS)** 的。在 Web 直接用 Fetch 请求会立刻报错失败。所以 Web 版会请求当前后台的 `dav-proxy.php` 进行 PHP 转发绕过浏览器限制。
- **Tauri WebDAV**: 桌面端通过 `@tauri-apps/plugin-http` 发起 WebDAV 请求，不走 PHP proxy，也不受浏览器 CORS 限制。默认只允许 HTTPS WebDAV；HTTP 仅允许 `localhost` / `127.0.0.1`。
- **Tauri Retinbox API**: 桌面端不能使用相对 `/api/*.php`，必须通过 `src/platform/apiClient.ts` 读取设置面板保存的 SCE 云服务地址、`VITE_RETIEHE_API_BASE` 或内置默认地址 `https://sce.jbyc.cc`，再拼接 `/api/auth.php` 和 `/api/workspace.php`。
- **桌面端 API 边界**: 自定义 SCE 云服务地址必须是合法 HTTPS URL，只有 `localhost`、`127.0.0.1`、`::1` 开发地址允许 HTTP。Tauri Cookie 按规范化 Origin 分区，切换服务地址不会把旧服务会话发送给新 Origin。
- **请求超时与重试**: `apiFetch` 默认使用有限超时，并与调用方 `AbortSignal` 组合，超时覆盖响应正文的完整读取。只重试网络错误、408、425、429 和 5xx；POST 只有在后端已实现对应幂等协议时才可携带 `Idempotency-Key` 并启用重试。当前 `workspace.php` 不消费幂等键，因此工作区 POST 显式禁用自动重试。
- **不依赖第三方库**: WebDAV 解析直接手写使用了原生的 `new DOMParser().parseFromString(text, 'text/xml')`，零 npm 依赖，避免了包体积膨胀。
- **工作区列表管理**: SCE 云端工作区列表以 `users` 库中的 `{username}_files` 数组为准；删除工作区会在 `scefiles` 对应记录的 `metadata` 上写入 `deleted` 标记和 `deletedAt` 时间，不删除数据库值。`list`、`load`、`rename` 和覆盖保存都会忽略已标记删除的工作区。
- **云工作区写入契约**: 新建 SCE 云工作区会在第一次请求前生成稳定的 128 位十六进制 `fileId`。单条 `scefiles` KV 在外层 JSON 编码后必须同时不超过 60000 字节和字符；写入会回读校验，失败不得返回成功。保存或重命名已确认写入后，兼容 `{username}_files` 索引追加失败不会把主操作改判为失败：后端记录告警，并以 `success: true`、原 `fileId` 和 `indexWarning` 返回；列表读取同时以权限表补齐索引。
- **文件权限键**: 权限记录使用 `fileId + NUL + username` 的 SHA-256 键，并核对记录内的主体字段。读取旧拼接键时仅接受主体完全匹配的记录，并自动迁移到 v2 键。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **多数据源混淆**: 在写上传/下载界面时，务必调用 `useCloudWorkspace.ts` 里的封装函数（例如 `listWorkspaces()`），**绝对不要**去绕过它直接调用底层的 `useWebDav.ts`，因为它负责把官方接口和 DAV 接口的数据拼合成无缝的列表给 UI 消费。
- **凭证存储**: SCE 密码不储存在前端。WebDAV 密码会以可逆密文保存在本地 Cookie，并在启用 SCE 同步设置时写入用户设置；当前 fallback key 固定在前端源码中，不能视为抵抗数据库泄露的安全加密。是否改为系统凭据库、仅内存保存或用户口令派生仍需产品决策。
- **Tauri 导入规则**: 不要在 `useAuth`、`useCloudWorkspace` 或组件中直接静态导入 Tauri HTTP 插件；所有桌面端 HTTP 行为都应留在 `src/platform/`。
