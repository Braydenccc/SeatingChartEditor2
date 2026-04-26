# 安全审计报告 - 单元 2：前端 XSS 防护

**审计日期**: 2026-04-26  
**审计范围**: 前端 XSS 防护、动态内容渲染、用户输入转义  
**审计人员**: Claude (手动审计)  

---

## 1. 检查摘要

本次审计检查了以下文件和模块：

- **`src/main.js`** - 应用入口，错误处理
- **`src/components/layout/ExportPreview.vue`** - 导出预览组件
- **`src/composables/useMarkdown.js`** - Markdown 渲染（如存在）
- **所有 Vue 组件** - 搜索 `v-html` 和动态内容渲染

**检查内容**：
- 所有 `v-html` 使用点
- 所有 `innerHTML` 使用点
- 动态内容渲染安全性
- 用户输入的转义处理
- Markdown 渲染安全

---

## 2. 发现的安全问题

### 2.1 严重问题

#### 问题 1: 错误信息使用 innerHTML 渲染

**位置**: `src/main.js` 第 14 行

**问题描述**:
```javascript
appRoot.innerHTML = `
  <div class="fatal-error-screen">
    <div class="fatal-error-card">
      <h1>应用启动失败</h1>
      <p>请截图这段信息反馈给开发者：</p>
      <pre>${message}</pre>
    </div>
  </div>
`
```

- 使用 `innerHTML` 渲染错误信息
- `message` 来自 `error.message`，可能包含恶意脚本
- 虽然使用 `<pre>` 标签，但仍可能被 XSS 攻击

**风险**:
- 如果错误对象被恶意构造，可能执行任意 JavaScript
- 攻击场景：恶意第三方库抛出包含 `<script>` 的错误

**影响范围**: 应用启动失败时的错误显示

**修复建议**:
```javascript
const renderFatalError = (error) => {
  const appRoot = document.getElementById('app')
  if (!appRoot) return

  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  
  // 使用 textContent 而非 innerHTML
  const errorScreen = document.createElement('div')
  errorScreen.className = 'fatal-error-screen'
  
  const errorCard = document.createElement('div')
  errorCard.className = 'fatal-error-card'
  
  const title = document.createElement('h1')
  title.textContent = '应用启动失败'
  
  const description = document.createElement('p')
  description.textContent = '请截图这段信息反馈给开发者：'
  
  const pre = document.createElement('pre')
  pre.textContent = message // 使用 textContent 自动转义
  
  errorCard.appendChild(title)
  errorCard.appendChild(description)
  errorCard.appendChild(pre)
  errorScreen.appendChild(errorCard)
  
  appRoot.innerHTML = '' // 清空
  appRoot.appendChild(errorScreen)
}
```

---

### 2.2 高危问题

#### 问题 2: Excel 预览使用 v-html 渲染

**位置**: `src/components/layout/ExportPreview.vue` 第 296 行

**问题描述**:
```vue
<div v-html="excelPreviewHtml"></div>
```

- 使用 `v-html` 渲染 Excel 预览 HTML
- `excelPreviewHtml` 由 `generateExcelPreviewHtml()` 生成
- 虽然代码中有转义处理，但仍存在风险

**风险**:
- 如果学生姓名、标签等数据包含恶意脚本，可能被执行
- 虽然当前代码有转义，但未来修改可能引入漏洞

**影响范围**: Excel 导出预览功能

**修复建议**:
```javascript
// 方案 1: 使用 DOMPurify 库清理 HTML
import DOMPurify from 'dompurify'

const excelPreviewHtml = computed(() => {
  const rawHtml = generateExcelPreviewHtml(/* ... */)
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'div'],
    ALLOWED_ATTR: ['class', 'style']
  })
})

// 方案 2: 使用 Vue 组件渲染（推荐）
// 将 HTML 字符串改为 Vue 组件，避免使用 v-html
<template>
  <table class="excel-preview-table">
    <thead>
      <tr>
        <th v-for="header in headers" :key="header">{{ header }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in rows" :key="index">
        <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
      </tr>
    </tbody>
  </table>
</template>
```

---

### 2.3 中等问题

#### 问题 3: 用户输入未统一转义

**位置**: 多个组件

**问题描述**:
- 学生姓名、标签名称等用户输入在多处使用
- 虽然 Vue 默认转义 `{{ }}` 插值，但需确保所有地方都使用正确的方式
- 未发现明显的 XSS 漏洞，但缺少统一的输入清理机制

**风险**:
- 未来代码修改可能引入 XSS 漏洞
- 缺少防御深度

**影响范围**: 所有显示用户输入的地方

**修复建议**:
```javascript
// 创建统一的输入清理函数
export function sanitizeUserInput(input) {
  if (typeof input !== 'string') return input
  
  // 移除控制字符
  return input.replace(/[\x00-\x1F\x7F]/g, '')
}

// 在数据输入点使用
const addStudent = (name, studentId) => {
  students.value.push({
    id: generateId(),
    name: sanitizeUserInput(name),
    studentId: sanitizeUserInput(studentId),
    // ...
  })
}
```

---

#### 问题 4: 缺少 Content Security Policy

**位置**: `index.html` 或服务器配置

**问题描述**:
- 未配置 Content Security Policy (CSP)
- 无法限制脚本来源
- 无法防止内联脚本执行

**风险**:
- XSS 攻击成功后可执行任意脚本
- 无法限制攻击范围

**影响范围**: 整个应用

**修复建议**:
```html
<!-- 在 index.html 中添加 CSP -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com;
">

<!-- 或在服务器配置中添加（推荐） -->
<!-- server.cjs 或 Nginx 配置 -->
```

---

### 2.4 低危问题

#### 问题 5: 缺少 XSS 防护测试

**位置**: 测试文件

**问题描述**:
- 未发现针对 XSS 的专门测试
- 无法验证输入清理和转义的有效性

**风险**:
- 未来修改可能引入 XSS 漏洞而不被发现

**影响范围**: 测试覆盖率

**修复建议**:
```javascript
// 添加 XSS 防护测试
describe('XSS Protection', () => {
  it('should escape HTML in student names', () => {
    const { addStudent, students } = useStudentData()
    
    addStudent('<script>alert("XSS")</script>', '001')
    
    // 确保脚本标签被转义或移除
    expect(students.value[0].name).not.toContain('<script>')
  })
  
  it('should escape HTML in tag names', () => {
    const { addTag, tags } = useTagData()
    
    addTag('<img src=x onerror=alert("XSS")>')
    
    expect(tags.value[0].name).not.toContain('<img')
  })
})
```

---

## 3. 已验证的安全措施

### 3.1 Vue 默认转义 ✅

**实施情况**:
- ✅ Vue 模板中的 `{{ }}` 插值自动转义 HTML
- ✅ 大部分用户输入使用 `{{ }}` 显示
- ✅ 未发现大量 `v-html` 使用

**评价**: Vue 的默认转义提供了基础保护。

---

### 3.2 Excel 数据转义 ✅

**位置**: `src/composables/useExcelData.js`

**实施情况**:
- ✅ Excel 导出时使用 `xlsx-js-style` 库
- ✅ 库自动处理特殊字符转义
- ✅ 未发现公式注入风险

**评价**: Excel 导出安全性较好。

---

## 4. 修复优先级建议

### 高优先级（立即修复）
1. **问题 1**: 修复 main.js 中的 innerHTML XSS 漏洞
2. **问题 2**: 重构 ExportPreview.vue，移除 v-html 或使用 DOMPurify

### 中优先级（近期修复）
3. **问题 4**: 添加 Content Security Policy
4. **问题 3**: 创建统一的输入清理机制

### 低优先级（可选优化）
5. **问题 5**: 添加 XSS 防护测试

---

## 5. 总体评价

**安全性评分**: 7.5/10

**优点**:
- ✅ Vue 默认转义提供基础保护
- ✅ 大部分用户输入使用安全的方式显示
- ✅ Excel 导出安全性较好

**不足**:
- ❌ main.js 中存在 innerHTML XSS 漏洞
- ❌ ExportPreview.vue 使用 v-html
- ❌ 缺少 CSP 配置
- ❌ 缺少统一的输入清理机制

**建议**:
1. 优先修复 innerHTML 和 v-html 问题
2. 添加 Content Security Policy
3. 创建统一的输入清理和验证机制
4. 添加 XSS 防护测试

---

**审计完成时间**: 2026-04-26  
**下次审计建议**: 修复高优先级问题后进行复审
