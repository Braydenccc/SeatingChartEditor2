# 修复登录 403 错误 - Product Requirement Document

## Overview
- **Summary**: 修复生产环境登录时出现的 403 Forbidden 错误，该错误由 CSRF 校验失败导致
- **Purpose**: 解决用户无法登录到 sce.jbyc.cc 生产环境的问题
- **Target Users**: 使用 sce.jbyc.cc 在线版座位表编辑器的用户

## Goals
- 修复 CSRF 校验导致的 403 错误
- 确保登录和注册功能在生产环境正常工作
- 保持 CSRF 保护机制的安全性
- 兼容热铁盒 (Retiehe) 部署环境

## Non-Goals (Out of Scope)
- 不重构整个认证系统
- 不移除 CSRF 保护机制
- 不修改用户数据存储方式
- 不添加新的认证功能

## Background & Context
### 问题描述
用户在访问 https://sce.jbyc.cc/ 时，登录/注册会返回 403 Forbidden 错误。错误日志显示：
```
POST https://sce.jbyc.cc/api/auth.php 403 (Forbidden)
Auth API Error: 403 服务器错误 (403)
```

### 代码分析
1. **前端** (`useAuth.js`):
   - 使用 `/api/auth.php` 相对路径请求
   - 实现了 Double-Submit Cookie CSRF 保护
   - Cookie 设置：`SameSite=Strict` + 可选 `Secure` 标志

2. **后端** (`public/api/auth.php`):
   - 第 195-197 行明确检查 CSRF token，失败返回 403
   - CSRF 校验逻辑：比较 Cookie 中的 `sce_csrf` 与请求头 `X-CSRF-Token` 或请求体 `_csrf`

### 部署环境
- 生产环境部署在热铁盒 (Retiehe) Web Hosting
- 域名：sce.jbyc.cc
- 使用 HTTPS

### 可能的原因
1. **SameSite=Strict 策略问题** - 严格的 SameSite 策略可能在某些场景下阻止 Cookie 传递
2. **热铁盒部署环境的 Cookie 处理** - 部署平台可能对 Cookie 有特殊处理
3. **Secure 标志兼容性** - HTTPS 环境下的 Secure Cookie 可能存在兼容性问题

## Functional Requirements
- **FR-1**: 用户可以正常登录到生产环境
- **FR-2**: 用户可以正常注册新账号
- **FR-3**: CSRF 保护机制仍然有效
- **FR-4**: 登录状态可以正常保持（Cookie 正常工作）

## Non-Functional Requirements
- **NFR-1**: 修复不应降低安全性
- **NFR-2**: 修复应向后兼容现有用户
- **NFR-3**: 修复应同时适用于开发环境和生产环境

## Constraints
- **Technical**: 必须保持 CSRF 保护机制
- **Business**: 必须兼容热铁盒部署环境
- **Dependencies**: 不能引入新的第三方库

## Assumptions
- 热铁盒部署环境支持 Cookie
- 问题确实由 CSRF 校验导致
- 修改可以通过正常的部署流程上线

## Acceptance Criteria

### AC-1: 登录功能正常工作
- **Given**: 用户在 sce.jbyc.cc 有账号
- **When**: 用户输入正确的用户名和密码并点击登录
- **Then**: 登录成功，用户状态保持，没有 403 错误
- **Verification**: `human-judgment`
- **Notes**: 需要在生产环境实际测试

### AC-2: 注册功能正常工作
- **Given**: 用户访问 sce.jbyc.cc
- **When**: 用户输入有效的新用户名和密码并点击注册
- **Then**: 注册成功，用户自动登录，没有 403 错误
- **Verification**: `human-judgment`

### AC-3: CSRF 保护仍然有效
- **Given**: 应用正在运行
- **When**: 尝试发送没有有效 CSRF token 的请求
- **Then**: 请求被拒绝，返回 403 错误
- **Verification**: `programmatic` (可通过测试验证)

### AC-4: Cookie 正常设置和读取
- **Given**: 用户已登录
- **When**: 刷新页面或重新打开浏览器
- **Then**: 登录状态保持，Cookie 正确读取
- **Verification**: `human-judgment`

### AC-5: 开发环境不受影响
- **Given**: 开发者在本地运行 `npm run dev`
- **When**: 使用登录/注册功能
- **Then**: 一切正常工作，mock API 正常响应
- **Verification**: `human-judgment`

## Open Questions
- [ ] 热铁盒部署环境对 Cookie 是否有特殊限制？
- [ ] 是否有其他部署相关的配置需要调整？
