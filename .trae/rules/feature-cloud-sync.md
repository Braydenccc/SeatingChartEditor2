---
trigger: conditional
globs:
  - "src/components/auth/**"
  - "src/components/workspace/**"
  - "src/composables/useAuth.js"
  - "src/composables/useWebDav.js"
  - "src/composables/useCloudWorkspace.js"
  - "public/api/**"
---

# 云端同步与认证

双轨方案：Retinbox 官方账号 + WebDAV 私有同步。

## 关键实现

- authType: 'retiehe'|'webdav'，backupMode 存入 retiehe 时镜像抄送 webdav
- CSRF：getOrCreateCsrfToken 往 Cookie 和 Fetch Header 塞相同 Token
- DAV Proxy：私有 WebDAV 不支持 CORS，通过 /api/dav-proxy PHP 转发绕过
- 零依赖 WebDAV：手写 DOMParser 解析 XML

## 防坑

- 必须通过 useCloudWorkspace.js 封装调用，**不要**直接调 useWebDav.js
- WebDAV 密码明文存 localStorage(sce_webdav_config)，安全审计需注意