---
module_name: Cloud Sync & Authentication
description: 官方账号认证机制及泛底层的 WebDAV 私有同步双轨方案。
related_files:
  - src/composables/useAuth.js
  - src/composables/useWebDav.js
  - src/composables/useCloudWorkspace.js
---

# 07-云端同步与认证 (Cloud Sync & Authentication)

## 1. 核心职责 (Core Purpose)
由于本软件定位“开箱即用”且部署在 Retinbox 上，因此提供了非常轻量的 `api/auth.php` 和 `api/workspace.php` 用于储存 `.sce` 存档。同时考虑到部分敏感学校不用公有云，所以内嵌了纯前端的纯原生 WebDAV 协议引擎。

## 2. 源代码入口 (Source Files)
- 登录认证态: `src/composables/useAuth.js`
- WebDAV 底层驱动: `src/composables/useWebDav.js`
- 聚合存储操作平台: `src/composables/useCloudWorkspace.js`

## 3. 数据模型 / 核心API (Data Models & Core API)

```typescript
// useAuth.js 控制着当前的全局读写源
const authType = ref<'retiehe' | 'webdav'>('retiehe')
const backupMode = ref<boolean>(false) // 若开启，存入 retiehe 时会静默镜像抄送到 webdav
```

## 4. 关键实现节点 (Implementation Details)
- **Double-Submit Cookie (CSRF)**: 由于该软件在浏览器中运行且不依赖重型框架路由，安全机制非常原始但有效。`getOrCreateCsrfToken` 会往 Cookie 和 Fetch Request Header 里塞入相同的 Token 来防御攻击。
- **DAV Proxy 劫持 (`fetch('/api/dav-proxy')`)**: 很多国企或个人的私有 WebDAV（尤其是群晖、坚果云）是**绝对不支持跨域 (CORS)** 的。在 Web 直接用 Fetch 请求会立刻报错失败。所以代码里故意写了请求当前后台的 `dav-proxy` 进行 PHP 转发绕过浏览器限制。
- **不依赖第三方库**: WebDAV 解析直接手写使用了原生的 `new DOMParser().parseFromString(text, 'text/xml')`，零 npm 依赖，避免了包体积膨胀。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **多数据源混淆**: 在写上传/下载界面时，务必调用 `useCloudWorkspace.js` 里的封装函数（例如 `listWorkspaces()`），**绝对不要**去绕过它直接调用底层的 `useWebDav.js`，因为它负责把官方接口和 DAV 接口的数据拼合成无缝的列表给 UI 消费。
- **凭证存储**: Retiehe 密码不储存在前端。WebDAV 的密码是**明文**存放在 `localStorage`（通过 Cookie 代理保存的 `sce_webdav_config` JSON 里）的。如果有安全审计要求，需提醒用户。
