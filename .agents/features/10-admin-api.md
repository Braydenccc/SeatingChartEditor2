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

## 4. 支持操作

- 用户管理：`list_users`、`get_user_detail`、`set_user_status`、`reset_user_password`
- 工作区管理：`list_workspaces`、`get_workspace_detail`、`rename_workspace`、`set_workspace_deleted`
- 审计查询：`list_audit_logs`、`list_audit_failures`

`set_user_status` 使用 `user_profiles` 数据库存储普通用户状态。老用户没有 profile 时默认为 `active`；状态为 `disabled` 时，普通登录和已有会话校验都会被拒绝。

`set_workspace_deleted` 只做软删除和恢复：删除时写入 `metadata.deleted`、`metadata.deletedAt` 和 `metadata.tags[] = deleted`；恢复时移除删除标签并清除删除时间。admin API 不提供物理删除工作区。

## 5. 审计日志

日志字段包括 `id`、`time`、`timestamp`、`action`、`success`、`verified`、`status`、`ip`、`userAgent`、`reason`、`target` 和 `paramsSummary`。

`paramsSummary` 会脱敏敏感字段，不记录 token、密码、新密码、工作区 content、WebDAV 凭据或用户设置详情。
