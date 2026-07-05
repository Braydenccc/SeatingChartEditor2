---
module_name: Admin API
description: 独立管理后台 API、管理员密钥校验、审计日志和普通用户禁用机制。
related_files:
  - public/api/admin.php
  - public/api/auth.php
  - public/api/common.php
---

# 10-管理后台 API (Admin API)

## 1. 核心职责

`api/admin.php` 是独立于普通用户登录态的高权限后端入口，不复用 `sce_username` / `sce_token` Cookie。所有 admin 调用都必须先通过热铁盒 `admin` 数据库开关和管理员密钥校验，并且每次调用都写入审计日志。

## 2. 数据库键

`admin` 数据库由站点管理员在热铁盒数据库界面手动维护：

- `is_enable`: 总开关，值必须严格为 `1`，否则所有 admin API 视为未验证。
- `api_token_hash`: 管理员明文 token 的 SHA-256 hex，后端不保存明文 token。
- `audit_logs`: 所有 admin 调用日志，后端仅追加和读取。
- `audit_failures`: 失败、参数错误、校验未通过或未验证调用的备份日志，后端仅追加和读取。

后端不提供修改或删除 `admin` 配置与日志的云函数；清理、关闭或更换密钥只能通过热铁盒数据库管理界面手动完成。

## 3. 调用方式

所有请求使用 POST JSON：

```text
POST /api/admin.php
X-Admin-Token: <plain-admin-token>
Content-Type: application/json
```

请求体必须包含 `action`。失败鉴权统一返回 `401 未验证`，不暴露是开关关闭、缺少密钥、密钥哈希不存在还是 token 错误。

测试环境使用的公开测试 token：

```text
plain token = SCEV2_ADMIN_TEST_20260704_0a986bb2c8fcf03bca32fa00194e3755c5a73940f4a3e5ce
sha256 hex  = bacb80844a71cbc2f4b5da606db6b137edd114c429f85acb715ca5d2ee940b93
```

测试环境热铁盒 `admin` 数据库应写入 `is_enable = 1` 和上述 `sha256 hex` 到 `api_token_hash`。生产环境必须重新生成 token，不能复用该测试值。

## 4. 支持操作

- 用户管理：`list_users`、`get_user_detail`、`set_user_status`、`reset_user_password`
- 工作区管理：`list_workspaces`、`get_workspace_detail`、`rename_workspace`、`set_workspace_deleted`
- 身份源管理：`list_oauth_providers`、`save_oauth_provider`、`delete_oauth_provider`、`test_oauth_provider`
- OAuth 绑定管理：`list_oauth_identity_links`、`unlink_oauth_identity`
- 审计查询：`list_audit_logs`、`list_audit_failures`

`set_user_status` 使用 `user_profiles` 数据库存储普通用户状态。老用户没有 profile 时默认为 `active`；状态为 `disabled` 时，普通登录和已有会话校验都会被拒绝。

`set_workspace_deleted` 只做软删除和恢复：删除时写入 `metadata.deleted`、`metadata.deletedAt` 和 `metadata.tags[] = deleted`；恢复时移除删除标签并清除删除时间。admin API 不提供物理删除工作区。

`save_oauth_provider` 维护多 OAuth/OIDC 身份源配置，敏感的 `clientSecret` 只写入后端 `oauth_providers` 数据库，审计日志会脱敏。管理员把 `callbackUrl` 配到 Casdoor/STCN 等提供商应用中。普通端 OAuth 登录统一走 `/api/oauth-start.php` 和 `/api/oauth-callback.php`。

账号绑定模型：SCE 账号是云端工作区、设置和审计归属主体；账号密码登录和 OAuth 登录都是登录同一个 SCE 账号的方式。账号密码登录通过 `password_login_links` 映射到 `accountId`，OAuth 身份通过 `oauth_identity_links.accountId` 绑定到同一账号。用户可在账号中心添加或解除登录方式，但至少需要保留一种可用登录方式；添加已属于另一账号的登录方式时，需要二次确认并合并到当前账号。

## 5. 审计日志

日志字段包括 `id`、`time`、`timestamp`、`action`、`success`、`verified`、`status`、`ip`、`userAgent`、`reason`、`target` 和 `paramsSummary`。

`paramsSummary` 会脱敏敏感字段，不记录 token、密码、新密码、工作区 content、WebDAV 凭据或用户设置详情。
