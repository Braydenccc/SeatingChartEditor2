# 修复登录 403 错误 - The Implementation Plan

## [x] Task 1: 调整 Cookie SameSite 策略
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 `useAuth.js` 中的 Cookie SameSite 策略，从 `Strict` 改为 `Lax`
  - 这是最可能解决问题的方案，因为 Strict 策略过于严格
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-4]
- **Test Requirements**:
  - `human-judgement` TR-1.1: 登录时 Cookie 能正确设置和读取
  - `human-judgement` TR-1.2: 刷新页面后登录状态保持
- **Notes**: SameSite=Lax 仍然提供良好的 CSRF 保护，同时更兼容

## [x] Task 2: 改进 CSRF 校验的回退机制
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 优化后端 `auth.php` 中的 CSRF 校验逻辑
  - 增强对热铁盒部署环境的兼容性
  - 确保即使 Cookie 读取有问题，也能通过其他方式验证
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: CSRF token 通过请求头和请求体都能验证
  - `programmatic` TR-2.2: 无效的 CSRF token 仍然返回 403
- **Notes**: 保持安全性的同时提高兼容性

## [x] Task 3: 在开发环境测试修复
- **Priority**: P1
- **Depends On**: [Task 1, Task 2]
- **Description**: 
  - 运行 `npm run dev` 测试修复后的代码
  - 验证登录、注册、CSRF 保护都正常工作
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `human-judgement` TR-3.1: 开发环境 mock API 正常响应
  - `human-judgement` TR-3.2: 登录注册功能在本地正常工作

## [x] Task 4: 构建并准备部署
- **Priority**: P1
- **Depends On**: [Task 3]
- **Description**: 
  - 运行 `npm run build:web` 构建生产版本
  - 验证构建产物没有错误
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `human-judgement` TR-4.1: 构建成功完成
  - `human-judgement` TR-4.2: 构建产物包含修改后的文件
