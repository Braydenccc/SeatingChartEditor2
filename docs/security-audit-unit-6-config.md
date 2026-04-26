# 安全审计报告 - 单元 6：配置和依赖安全

**审计日期**: 2026-04-26  
**审计范围**: 配置文件、依赖项、环境变量、构建脚本  
**审计人员**: Claude (手动审计)  

---

## 1. 检查摘要

本次审计检查了以下文件和模块：

- **`package.json`** - 依赖项配置
- **`vite.config.js`** - Vite 构建配置
- **`.gitignore`** - Git 忽略配置
- **`scripts/deploy-staging.js`** - 部署脚本
- **`server.cjs`** - 本地开发服务器

**检查内容**：
- 依赖项已知漏洞
- 环境变量安全存储
- 敏感信息泄露
- 构建和部署脚本安全
- 开发服务器配置
- CORS 配置

---

## 2. 发现的安全问题

### 2.1 严重问题

#### 问题 1: 开发服务器监听 0.0.0.0

**位置**: `vite.config.js` 第 26-29 行

**问题描述**:
```javascript
server: {
  port: 5173,
  host: "0.0.0.0"  // 监听所有网络接口
}
```

- 开发服务器监听 `0.0.0.0`，暴露到所有网络接口
- 局域网内的其他设备可访问开发服务器
- 可能暴露敏感开发数据和调试信息

**风险**:
- 局域网攻击
- 敏感信息泄露
- 开发环境被利用

**影响范围**: 开发环境

**修复建议**:
```javascript
server: {
  port: 5173,
  host: process.env.VITE_HOST || "127.0.0.1",  // 默认仅本地访问
  // 如需局域网访问，使用环境变量：VITE_HOST=0.0.0.0 npm run dev
}
```

---

### 2.2 高危问题

#### 问题 2: 环境变量未验证

**位置**: `scripts/deploy-staging.js`

**问题描述**:
```javascript
const apiKey = process.env.RTH_API_KEY;
if (!apiKey) {
  console.error('错误: 未设置 RTH_API_KEY 环境变量');
  process.exit(1);
}
```

- 仅检查环境变量是否存在，未验证格式
- 未验证 API Key 的有效性
- 可能使用错误的 API Key 导致部署失败或误操作

**风险**:
- 部署到错误的环境
- API Key 泄露未被发现
- 误操作风险

**影响范围**: 部署流程

**修复建议**:
```javascript
const apiKey = process.env.RTH_API_KEY;

// 验证环境变量存在
if (!apiKey) {
  console.error('错误: 未设置 RTH_API_KEY 环境变量');
  process.exit(1);
}

// 验证格式（UUID）
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(apiKey)) {
  console.error('错误: RTH_API_KEY 格式无效（应为 UUID）');
  process.exit(1);
}

// 验证环境（可选）
const targetEnv = process.env.DEPLOY_ENV || 'staging';
console.log(`部署目标环境: ${targetEnv}`);
console.log('请确认环境正确，按 Ctrl+C 取消...');
await new Promise(resolve => setTimeout(resolve, 3000));
```

---

#### 问题 3: 依赖项版本过于宽松

**位置**: `package.json`

**问题描述**:
```json
{
  "dependencies": {
    "@playwright/test": "^1.59.1",
    "@vueuse/core": "^14.2.1",
    "vue": "^3.5.22"
  }
}
```

- 使用 `^` 允许次版本更新
- 可能引入不兼容的更新或安全漏洞
- 无法保证构建的可重现性

**风险**:
- 依赖项自动更新引入漏洞
- 构建不可重现
- 生产环境与开发环境不一致

**影响范围**: 所有依赖项

**修复建议**:
```json
// 方案 1: 使用精确版本（推荐用于生产）
{
  "dependencies": {
    "@playwright/test": "1.59.1",
    "@vueuse/core": "14.2.1",
    "vue": "3.5.22"
  }
}

// 方案 2: 使用 package-lock.json 锁定版本
// 确保 package-lock.json 已提交到 Git

// 方案 3: 使用 npm ci 而非 npm install
// 在 CI/CD 中使用 npm ci 确保使用锁定的版本
```

---

### 2.3 中等问题

#### 问题 4: 缺少安全响应头配置

**位置**: `vite.config.js`

**问题描述**:
- Vite 配置中未设置安全响应头
- 虽然 `server.cjs` 中有配置，但 Vite 开发服务器未配置
- 开发环境可能缺少安全保护

**风险**:
- 开发环境 XSS 攻击
- 点击劫持
- MIME 类型嗅探

**影响范围**: 开发环境

**修复建议**:
```javascript
// vite.config.js
export default defineConfig({
  // ... 其他配置
  server: {
    port: 5173,
    host: "127.0.0.1",
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    }
  }
})
```

---

#### 问题 5: .gitignore 配置可能不完整

**位置**: `.gitignore`

**问题描述**:
```gitignore
# Env files
.env
.env.*
```

- 仅忽略 `.env` 和 `.env.*`
- 可能遗漏其他敏感文件（如 `.env.backup`、`secrets.json`）
- 未明确忽略常见的敏感文件模式

**风险**:
- 敏感文件意外提交
- API Key 泄露

**影响范围**: 版本控制

**修复建议**:
```gitignore
# Env files
.env
.env.*
.env.local
.env.*.local
.env.backup
*.env

# Secrets and credentials
secrets.json
credentials.json
*.key
*.pem
*.p12
*.pfx

# API keys
*api-key*
*apikey*

# Database
*.db
*.sqlite
*.sqlite3

# Logs with sensitive data
*.log
logs/
```

---

#### 问题 6: 构建脚本缺少完整性检查

**位置**: `package.json` 构建脚本

**问题描述**:
```json
{
  "scripts": {
    "build": "vite build && pkg server.cjs --targets node18-win-x64 --out-path dist/bin && \"C:\\Program Files (x86)\\NSIS\\makensis.exe\" installer.nsi"
  }
}
```

- 构建脚本链式执行，但未检查中间步骤是否成功
- 使用 `&&` 连接，但错误处理不完善
- 未生成构建产物的哈希值或签名

**风险**:
- 构建失败未被发现
- 产物被篡改无法检测
- 供应链攻击

**影响范围**: 构建流程

**修复建议**:
```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "build:vite": "vite build",
    "build:pkg": "pkg server.cjs --targets node18-win-x64 --out-path dist/bin",
    "build:nsis": "makensis installer.nsi"
  }
}
```

```javascript
// scripts/build.js
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

function run(command, description) {
  console.log(`\n[构建] ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`[成功] ${description} 完成`);
  } catch (error) {
    console.error(`[失败] ${description} 失败`);
    process.exit(1);
  }
}

function generateChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  fs.writeFileSync(`${filePath}.sha256`, hash);
  console.log(`[校验] ${filePath} SHA256: ${hash}`);
}

// 执行构建
run('npm run build:vite', 'Vite 构建');
run('npm run build:pkg', 'PKG 打包');
run('npm run build:nsis', 'NSIS 安装包');

// 生成校验和
generateChecksum('dist/installer.exe');
console.log('\n[完成] 构建成功！');
```

---

### 2.4 低危问题

#### 问题 7: 缺少依赖项审计自动化

**位置**: CI/CD 配置

**问题描述**:
- 未配置自动化依赖项安全审计
- 需要手动运行 `npm audit`
- 可能遗漏已知漏洞

**风险**:
- 依赖项漏洞未及时发现
- 安全更新延迟

**影响范围**: 依赖项管理

**修复建议**:
```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 1'  # 每周一运行
  push:
    branches: [main, dev]
  pull_request:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm audit --audit-level=moderate
      - run: npm outdated || true
```

---

#### 问题 8: 开发依赖项过多

**位置**: `package.json`

**问题描述**:
```json
{
  "devDependencies": {
    "@tauri-apps/cli": "^2.10.1",
    "electron": "^40.8.0",
    "electron-builder": "^26.8.1",
    // ... 更多
  }
}
```

- 同时包含 Tauri、Electron、pkg 三种打包工具
- 增加依赖项攻击面
- 安装时间长

**风险**:
- 依赖项漏洞风险增加
- 供应链攻击面扩大

**影响范围**: 开发环境

**修复建议**:
```json
// 方案 1: 拆分为多个 package.json
// package.json - 核心依赖
// package.tauri.json - Tauri 相关
// package.electron.json - Electron 相关

// 方案 2: 使用 optionalDependencies
{
  "optionalDependencies": {
    "@tauri-apps/cli": "^2.10.1",
    "electron": "^40.8.0",
    "electron-builder": "^26.8.1"
  }
}

// 方案 3: 使用 npm workspaces
```

---

## 3. 已验证的安全措施

### 3.1 .gitignore 配置 ✅

**位置**: `.gitignore`

**实施情况**:
- ✅ 正确排除 `.env` 文件
- ✅ 排除 `node_modules`、`dist`、构建产物
- ✅ 排除 IDE 配置文件
- ✅ 排除日志文件

**评价**: .gitignore 配置基本完善，建议补充更多敏感文件模式。

---

### 3.2 环境变量使用 ✅

**位置**: `scripts/deploy-staging.js`

**实施情况**:
- ✅ 使用环境变量存储 API Key
- ✅ 未硬编码敏感信息
- ✅ 检查环境变量是否存在

**评价**: 环境变量使用正确，建议添加格式验证。

---

### 3.3 安全响应头（server.cjs）✅

**位置**: `server.cjs` 第 63-65、125 行

**实施情况**:
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `Referrer-Policy: no-referrer`
- ✅ `Content-Security-Policy`

**评价**: 生产服务器安全响应头配置完善。

---

### 3.4 路径遍历防护（server.cjs）✅

**位置**: `server.cjs` 第 49-59 行

**实施情况**:
- ✅ 使用 `path.resolve()` 和 `path.relative()` 检测路径遍历
- ✅ 拒绝包含 `..` 的路径
- ✅ 抛出明确的错误

**评价**: 路径遍历防护实现正确。

---

## 4. 依赖项安全分析

### 4.1 核心依赖项

| 依赖项 | 版本 | 用途 | 风险评估 |
|--------|------|------|----------|
| vue | ^3.5.22 | 前端框架 | ✅ 低风险 |
| @vueuse/core | ^14.2.1 | Vue 工具库 | ✅ 低风险 |
| xlsx-js-style | ^1.2.0 | Excel 处理 | ⚠️ 中风险（较少维护） |
| bcryptjs | ^3.0.3 | 密码哈希 | ⚠️ 中风险（建议使用原生 bcrypt） |
| lucide-vue-next | ^1.0.0 | 图标库 | ✅ 低风险 |

### 4.2 开发依赖项

| 依赖项 | 版本 | 用途 | 风险评估 |
|--------|------|------|----------|
| vite | ^7.3.2 | 构建工具 | ✅ 低风险 |
| typescript | ^6.0.3 | 类型检查 | ✅ 低风险 |
| vitest | ^2.1.9 | 测试框架 | ✅ 低风险 |
| electron | ^40.8.0 | 桌面应用 | ⚠️ 中风险（体积大） |
| @tauri-apps/cli | ^2.10.1 | 桌面应用 | ✅ 低风险 |

### 4.3 建议

1. **bcryptjs** → **bcrypt**: 使用原生 bcrypt 性能更好，安全性更高
2. **xlsx-js-style**: 考虑使用更活跃维护的替代品（如 exceljs）
3. 定期运行 `npm audit` 检查已知漏洞
4. 使用 `npm outdated` 检查过时的依赖项

---

## 5. 修复优先级建议

### 高优先级（立即修复）
1. **问题 1**: 修改开发服务器监听地址为 127.0.0.1
2. **问题 2**: 添加环境变量格式验证

### 中优先级（近期修复）
3. **问题 3**: 锁定依赖项版本或使用 package-lock.json
4. **问题 4**: 添加 Vite 开发服务器安全响应头
5. **问题 6**: 改进构建脚本，添加完整性检查

### 低优先级（可选优化）
6. **问题 5**: 完善 .gitignore 配置
7. **问题 7**: 添加依赖项审计自动化
8. **问题 8**: 优化开发依赖项

---

## 6. 总体评价

**安全性评分**: 7.5/10

**优点**:
- ✅ .gitignore 配置基本完善
- ✅ 环境变量使用正确
- ✅ 生产服务器安全响应头配置完善
- ✅ 路径遍历防护实现正确
- ✅ 核心依赖项安全性较好

**不足**:
- ❌ 开发服务器监听 0.0.0.0
- ❌ 环境变量未验证格式
- ❌ 依赖项版本过于宽松
- ❌ 缺少安全响应头（开发环境）
- ❌ 缺少依赖项审计自动化

**建议**:
1. 优先修复开发服务器监听地址
2. 添加环境变量验证
3. 锁定依赖项版本
4. 添加 Vite 开发服务器安全响应头
5. 设置依赖项审计自动化
6. 改进构建脚本

---

**审计完成时间**: 2026-04-26  
**下次审计建议**: 修复高优先级问题后进行复审
