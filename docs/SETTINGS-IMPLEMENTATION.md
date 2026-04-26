# 设置系统实现文档

## 概述

实现了完整的统一设置对话框系统，包含全局设置和工作区设置两大类别，所有设置项都有对应的实际功能落地。

## 已实现功能

### 1. 全局设置

#### 1.1 云端同步 (SyncPanel)
- ✅ WebDAV 配置（服务器地址、用户名、密码）
- ✅ 自动备份模式开关
- ✅ 同步目标选择（SCE 云 / WebDAV）
- ✅ 连接验证和保存到数据库
- ✅ 清空配置功能
- ✅ 实时同步状态显示

#### 1.2 界面偏好 (UIPanel)
- ✅ 语言选择（当前仅支持简体中文，多语言功能标记为即将推出）
- ✅ **颜色模式选择（简单模式 / 定制模式）**
  - ✅ **简单模式**：
    - ✅ 配色方案选择（浅色 / 深色 / 跟随浏览器）
    - ✅ 主题色选择（颜色选择器 + 文本输入）
    - ✅ 实时预览
  - ✅ **定制模式**：
    - ✅ 主色调配置（主色、主色浅、主色深）
    - ✅ 背景色配置（主背景、选中背景、卡片背景、微妙背景、柔和背景）
    - ✅ 文字颜色配置（主文字、次要文字、弱化文字）
    - ✅ 边框颜色配置（边框、强边框）
    - ✅ 状态颜色配置（危险、危险悬停、成功、信息）
    - ✅ 实时可读性检测（对比度计算、WCAG 标准提示）
    - ✅ 重置所有颜色功能
  - ✅ 持久化到 localStorage
  - ✅ 应用启动时自动加载并应用
  - ✅ 保存时应用到 CSS 变量
- ✅ **默认缩放比例设置（50-200%）**
  - ✅ 应用启动时自动应用
- ✅ **动画效果开关**
  - ✅ 通过 CSS 类 `.disable-animations` 全局禁用动画
  - ✅ 实时生效

#### 1.3 编辑器行为 (EditorPanel)
- ✅ **自动保存间隔设置（10-600秒）**
  - ✅ 输入验证和边界检查
  - ✅ 自动保存到 localStorage 备份
  - ✅ 应用启动时自动启动
  - ✅ 间隔变化时自动重启定时器
- ✅ **撤销历史大小设置（10-100）**
  - ✅ 动态调整撤销栈最大容量
  - ✅ 超出限制时自动裁剪
- ✅ **拖拽灵敏度调节（0.5-2.0x）**
  - ✅ 应用到触摸拖拽预览
  - ✅ 实时生效
- ✅ **双击学生行为选择**
  - ✅ 编辑该学生信息（触发编辑事件）
  - ✅ 随机移入/移出（座位表：移出到候选区；候选区：随机分配到空座位）
  - ✅ 实时生效
  - ✅ 对座位表和学生候选区均有效

### 2. 工作区设置

#### 2.1 工作区信息 (WorkspaceInfoPanel)
- ✅ 统计数据展示（学生总数、已分配座位、空座位、标签数量、座位总数、规则数量）
- ✅ 学生名单管理入口（打开 StudentRosterDialog）
- ✅ 标签设置入口（打开 TagSettingsDialog）
- ✅ 数据实时更新

#### 2.2 座位表配置 (SeatConfigPanel)
- ✅ 基本配置（大组数量、每组列数、每列座位数、错位距离）
- ✅ 讲台位置选择（底部 / 顶部）
- ✅ 座位对齐方式（对齐底部 / 对齐顶部）
- ✅ 自动初始化 groups 数组
- ✅ 配置变化监听
- ✅ 高级配置入口（跳转到侧边栏编辑标签）

#### 2.3 自动轮换 (RotationPanel)
- ✅ 轮换组数量显示
- ✅ 循环模式和互换模式说明
- ✅ 使用说明和提示
- ✅ 打开轮换配置入口（跳转到侧边栏）

#### 2.4 智能排位 (AssignmentPanel)
- ✅ 规则数量显示
- ✅ 算法特性说明（模拟退火、多维约束、智能优化）
- ✅ 打开规则编辑器入口（跳转到侧边栏）

#### 2.5 导出配置 (ExportPanel)
- ✅ 导出系统功能说明
- ✅ 当前配置预览（标题、颜色模式、行号、讲台）
- ✅ 功能特性列表
- ✅ 打开导出预览对话框

### 3. 核心功能

#### 3.1 设置持久化
- ✅ localStorage 存储（使用 `safeStorageGet` / `safeStorageSet`）
- ✅ 自动加载保存的设置
- ✅ 设置合并策略（保留新字段）
- ✅ 错误处理和降级

#### 3.2 设置应用
- ✅ **主题色应用到 CSS 变量 `--color-primary`**
- ✅ **应用启动时自动应用主题色**
- ✅ **保存时应用主题色**
- ✅ **实时预览（主题色）**
- ✅ **撤销历史大小动态调整**
- ✅ **动画效果全局开关**
- ✅ **自动保存定时器**
- ✅ **拖拽灵敏度应用**
- ✅ **双击座位行为**

#### 3.3 UI 交互
- ✅ Tab 切换（全局设置 / 工作区设置）
- ✅ 左侧导航栏
- ✅ 保存按钮（全局设置保存到 localStorage，工作区设置自动保存）
- ✅ 取消按钮
- ✅ 重置按钮（仅全局设置支持）
- ✅ ESC 键关闭对话框
- ✅ 点击遮罩层关闭对话框

#### 3.4 用户反馈
- ✅ 保存成功提示
- ✅ 保存失败提示
- ✅ 重置成功提示
- ✅ 工作区设置不支持重置的提示
- ✅ 自动保存提示

## 技术实现

### 数据结构

```javascript
// 全局设置结构
{
  sync: {
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    autoSync: true,
    syncInterval: 300000
  },
  ui: {
    language: 'zh-CN',
    colorMode: 'simple', // 'simple' | 'custom'
    colorScheme: 'light', // 'light' | 'dark' | 'auto'
    themeColor: '#23587b',
    customColors: {
      primary: '#23587b',
      primaryLight: '#2d6a94',
      primaryDark: '#1a4460',
      surface: '#ffffff',
      bgSelected: '#e8f4f8',
      bgCard: '#fafbfc',
      bgSubtle: '#f8fafc',
      bgSoft: '#f1f5f9',
      textPrimary: '#334155',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      borderStrong: '#cbd5e1',
      danger: '#f44336',
      dangerHover: '#d32f2f',
      success: '#059669',
      info: '#1d4ed8'
    },
    defaultZoom: 100,
    enableAnimations: true
  },
  editor: {
    autoSaveInterval: 60000,
    undoHistorySize: 50,
    dragSensitivity: 1.0,
    doubleClickAction: 'edit' // 'edit' | 'random'
  }
}
```

### 关键 Composables

- `useGlobalSettings()` - 全局设置管理
- `useAutoSave()` - 自动保存功能
- `useSettingsApplier()` - 设置应用器（未使用，功能已集成到各模块）
- `useAuth()` - 认证和同步配置
- `useWebDav()` - WebDAV 连接
- `useSeatChart()` - 座位配置
- `useStudentData()` - 学生数据
- `useTagData()` - 标签数据
- `useSeatRules()` - 规则数据
- `useZoneRotation()` - 轮换组数据
- `useExportSettings()` - 导出配置
- `useSidebar()` - 侧边栏状态
- `useUndo()` - 撤销/重做（支持动态调整历史大小）
- `useStudentDragging()` - 学生拖拽（支持灵敏度调节）
- `useLogger()` - 日志提示（用于双击随机分配的反馈）

### 工具函数

- `safeStorageGet()` - 安全读取 localStorage
- `safeStorageSet()` - 安全写入 localStorage
- `safeStorageRemove()` - 安全删除 localStorage
- `checkColorCombination()` - 检查颜色组合的可读性
- `getContrastRatio()` - 计算对比度（WCAG 标准）
- `getReadabilityRating()` - 获取可读性评级
- `hexToRgb()` - hex 颜色转 RGB

## 功能落地详情

### 1. 颜色系统
- **简单模式**：
  - **配色方案**：通过 `data-theme` 属性切换浅色/深色/跟随浏览器
  - **主题色**：应用到 CSS 变量 `--color-primary`
- **定制模式**：
  - **自定义颜色**：应用到所有 CSS 颜色变量
  - **可读性检测**：实时计算对比度，显示 WCAG 等级
- **应用位置**：CSS 变量（`:root`）
- **生效时机**：应用启动、保存设置、实时预览
- **影响范围**：全局 UI 颜色
- **应用位置**：CSS 变量 `--color-primary`
- **生效时机**：应用启动、保存设置、实时预览
- **影响范围**：全局 UI 颜色（按钮、链接、高亮等）

### 2. 默认缩放
- **应用位置**：`useZoom().setScale()`
- **生效时机**：应用启动时
- **影响范围**：座位图初始缩放比例

### 3. 动画效果
- **应用位置**：`document.documentElement` 的 `.disable-animations` 类
- **生效时机**：应用启动、设置变化
- **影响范围**：全局所有 CSS 动画和过渡效果

### 4. 自动保存
- **应用位置**：`useAutoSave()` 定时器
- **生效时机**：应用启动、间隔变化
- **保存内容**：工作区 JSON 数据到 localStorage
- **备份键**：`sce-autosave-backup`、`sce-autosave-time`

### 5. 撤销历史大小
- **应用位置**：`useUndo().setMaxHistory()`
- **生效时机**：应用启动、设置变化
- **影响范围**：撤销栈最大容量，超出时自动裁剪

### 6. 拖拽灵敏度
- **应用位置**：`useStudentDragging()` 触摸拖拽计算
- **生效时机**：拖拽时实时应用
- **影响范围**：触摸拖拽预览的移动速度

### 7. 双击学生行为
- **应用位置**：
  - `SeatItem.vue` 的 `@dblclick` 事件（座位表中的学生）
  - `CandidateItem.vue` 的 `@dblclick` 事件（候选区中的学生）
- **生效时机**：双击学生时
- **行为选项**：
  - `edit`：触发 `edit-student` 事件（编辑学生信息）
  - `random`：
    - 座位表：将学生从座位移出到候选区（调用 `clearSeat`）
    - 候选区：将学生随机分配到空座位（调用 `assignStudent`）

## 文件清单

### 新增文件
- `src/components/settings/panels/SyncPanel.vue`
- `src/components/settings/panels/UIPanel.vue` - 重写，支持简单模式和定制模式
- `src/components/settings/panels/EditorPanel.vue`
- `src/components/settings/panels/WorkspaceInfoPanel.vue`
- `src/components/settings/panels/SeatConfigPanel.vue`
- `src/components/settings/panels/RotationPanel.vue`
- `src/components/settings/panels/AssignmentPanel.vue`
- `src/components/settings/panels/ExportPanel.vue`
- `src/utils/storage.js`
- `src/utils/colorContrast.js` - 颜色对比度和可读性检测工具
- `src/composables/useAutoSave.js`
- `src/composables/useSettingsApplier.js`（未使用）
- `src/styles/disable-animations.css`

### 修改文件
- `src/components/settings/UnifiedSettingsDialog.vue` - 添加面板集成和保存逻辑，应用颜色方案
- `src/composables/useGlobalSettings.js` - 添加颜色模式、配色方案、自定义颜色支持，添加 `applyColorScheme()` 函数
- `src/assets/main.css` - 添加深色模式和定制模式 CSS 变量
- `src/App.vue` - 应用启动时加载和应用颜色方案
- `src/composables/useUndo.js` - 添加动态调整历史大小功能
- `src/composables/useStudentDragging.js` - 添加拖拽灵敏度支持
- `src/components/seat/SeatItem.vue` - 添加双击事件处理（座位表）
- `src/components/student/CandidateItem.vue` - 添加双击事件处理（候选区）
- `src/components/settings/panels/EditorPanel.vue` - 修改双击行为选项文本
- `src/main.js` - 导入禁用动画样式

## 使用方式

### 打开设置对话框

在 AppHeader 中点击"设置"按钮即可打开统一设置对话框。

### 修改设置

1. 选择顶部 Tab（全局设置 / 工作区设置）
2. 在左侧导航栏选择类别
3. 在右侧面板中修改设置
4. 点击"保存"按钮保存更改

### 重置设置

1. 选择要重置的类别
2. 点击"重置"按钮
3. 确认重置操作

## 注意事项

1. **多语言功能**：当前仅支持简体中文，多语言功能标记为"即将推出"
2. **工作区设置**：工作区设置（座位配置、轮换、规则等）会自动保存到工作区数据中，不需要手动保存
3. **颜色设置**：
   - 简单模式：选择配色方案和主题色，修改后需要点击"保存"才会持久化，但会实时预览
   - 定制模式：手动配置所有颜色，实时显示可读性提示，修改后需要点击"保存"才会持久化
   - 跟随浏览器：使用 `prefers-color-scheme` 媒体查询自动切换深浅色
4. **缩放比例**：默认缩放比例仅在打开工作区时应用，不会立即改变当前缩放
5. **重置功能**：工作区设置不支持重置，因为它们是工作区特定数据
6. **自动保存**：自动保存仅保存到 localStorage 备份，不会自动上传到云端

## 测试建议

1. **颜色系统**：
   - 简单模式：切换浅色/深色/跟随浏览器，验证颜色是否正确切换
   - 定制模式：修改各类颜色，验证实时预览和可读性提示
   - 保存后刷新页面，验证颜色是否保持
2. **动画效果**：关闭动画后，所有过渡效果应立即消失
3. **自动保存**：修改座位后等待设置的间隔，检查 localStorage 中的备份
4. **撤销历史**：设置较小的历史大小（如 10），验证超出后是否自动裁剪
5. **双击学生**：
   - 切换为"编辑该学生信息"，双击座位表或候选区的学生，验证是否触发编辑
   - 切换为"随机移入/移出"，双击座位表的学生验证是否移出到候选区，双击候选区的学生验证是否随机分配到空座位

## 后续优化

- [ ] 添加多语言支持
- [ ] 添加更多主题色预设
- [ ] 添加颜色主题导入导出功能
- [ ] 添加设置搜索功能
- [ ] 优化移动端体验
- [ ] 自动保存支持云端同步
- [ ] 拖拽灵敏度应用到更多拖拽场景
- [ ] 添加颜色无障碍检查工具


### 1. 全局设置

#### 1.1 云端同步 (SyncPanel)
- ✅ WebDAV 配置（服务器地址、用户名、密码）
- ✅ 自动备份模式开关
- ✅ 同步目标选择（SCE 云 / WebDAV）
- ✅ 连接验证和保存到数据库
- ✅ 清空配置功能
- ✅ 实时同步状态显示

#### 1.2 界面偏好 (UIPanel)
- ✅ 语言选择（当前仅支持简体中文，多语言功能标记为即将推出）
- ✅ 主题色选择（颜色选择器 + 文本输入）
- ✅ 主题色实时预览
- ✅ 主题色持久化到 localStorage
- ✅ 应用启动时自动应用保存的主题色
- ✅ 默认缩放比例设置（50-200%）
- ✅ 动画效果开关

#### 1.3 编辑器行为 (EditorPanel)
- ✅ 自动保存间隔设置（10-600秒）
- ✅ 输入验证和边界检查
- ✅ 撤销历史大小设置（10-100）
- ✅ 拖拽灵敏度调节（0.5-2.0x）
- ✅ 双击座位行为选择（编辑学生信息 / 快速分配）

### 2. 工作区设置

#### 2.1 工作区信息 (WorkspaceInfoPanel)
- ✅ 统计数据展示（学生总数、已分配座位、空座位、标签数量、座位总数、规则数量）
- ✅ 学生名单管理入口（打开 StudentRosterDialog）
- ✅ 标签设置入口（打开 TagSettingsDialog）
- ✅ 数据实时更新

#### 2.2 座位表配置 (SeatConfigPanel)
- ✅ 基本配置（大组数量、每组列数、每列座位数、错位距离）
- ✅ 讲台位置选择（底部 / 顶部）
- ✅ 座位对齐方式（对齐底部 / 对齐顶部）
- ✅ 自动初始化 groups 数组
- ✅ 配置变化监听
- ✅ 高级配置入口（跳转到侧边栏编辑标签）

#### 2.3 自动轮换 (RotationPanel)
- ✅ 轮换组数量显示
- ✅ 循环模式和互换模式说明
- ✅ 使用说明和提示
- ✅ 打开轮换配置入口（跳转到侧边栏）

#### 2.4 智能排位 (AssignmentPanel)
- ✅ 规则数量显示
- ✅ 算法特性说明（模拟退火、多维约束、智能优化）
- ✅ 打开规则编辑器入口（跳转到侧边栏）

#### 2.5 导出配置 (ExportPanel)
- ✅ 导出系统功能说明
- ✅ 当前配置预览（标题、颜色模式、行号、讲台）
- ✅ 功能特性列表
- ✅ 打开导出预览对话框

### 3. 核心功能

#### 3.1 设置持久化
- ✅ localStorage 存储（使用 `safeStorageGet` / `safeStorageSet`）
- ✅ 自动加载保存的设置
- ✅ 设置合并策略（保留新字段）
- ✅ 错误处理和降级

#### 3.2 设置应用
- ✅ 主题色应用到 CSS 变量 `--color-primary`
- ✅ 应用启动时自动应用主题色
- ✅ 保存时应用主题色
- ✅ 实时预览（主题色）

#### 3.3 UI 交互
- ✅ Tab 切换（全局设置 / 工作区设置）
- ✅ 左侧导航栏
- ✅ 保存按钮（全局设置保存到 localStorage，工作区设置自动保存）
- ✅ 取消按钮
- ✅ 重置按钮（仅全局设置支持）
- ✅ ESC 键关闭对话框
- ✅ 点击遮罩层关闭对话框

#### 3.4 用户反馈
- ✅ 保存成功提示
- ✅ 保存失败提示
- ✅ 重置成功提示
- ✅ 工作区设置不支持重置的提示

## 技术实现

### 数据结构

```javascript
// 全局设置结构
{
  sync: {
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    autoSync: true,
    syncInterval: 300000
  },
  ui: {
    language: 'zh-CN',
    themeColor: '#23587b',
    defaultZoom: 100,
    enableAnimations: true
  },
  editor: {
    autoSaveInterval: 60000,
    undoHistorySize: 50,
    dragSensitivity: 1.0,
    doubleClickAction: 'edit' // 'edit' | 'random'
  }
}
```

### 关键 Composables

- `useGlobalSettings()` - 全局设置管理
- `useAuth()` - 认证和同步配置
- `useWebDav()` - WebDAV 连接
- `useSeatChart()` - 座位配置
- `useStudentData()` - 学生数据
- `useTagData()` - 标签数据
- `useSeatRules()` - 规则数据
- `useZoneRotation()` - 轮换组数据
- `useExportSettings()` - 导出配置
- `useSidebar()` - 侧边栏状态

### 工具函数

- `safeStorageGet()` - 安全读取 localStorage
- `safeStorageSet()` - 安全写入 localStorage
- `safeStorageRemove()` - 安全删除 localStorage

## 文件清单

### 新增文件
- `src/components/settings/panels/SyncPanel.vue`
- `src/components/settings/panels/UIPanel.vue`
- `src/components/settings/panels/EditorPanel.vue`
- `src/components/settings/panels/WorkspaceInfoPanel.vue`
- `src/components/settings/panels/SeatConfigPanel.vue`
- `src/components/settings/panels/RotationPanel.vue`
- `src/components/settings/panels/AssignmentPanel.vue`
- `src/components/settings/panels/ExportPanel.vue`
- `src/utils/storage.js`

### 修改文件
- `src/components/settings/UnifiedSettingsDialog.vue` - 添加面板集成和保存逻辑
- `src/composables/useGlobalSettings.js` - 添加主题色应用函数

## 使用方式

### 打开设置对话框

在 AppHeader 中点击"设置"按钮即可打开统一设置对话框。

### 修改设置

1. 选择顶部 Tab（全局设置 / 工作区设置）
2. 在左侧导航栏选择类别
3. 在右侧面板中修改设置
4. 点击"保存"按钮保存更改

### 重置设置

1. 选择要重置的类别
2. 点击"重置"按钮
3. 确认重置操作

## 注意事项

1. **多语言功能**：当前仅支持简体中文，多语言功能标记为"即将推出"
2. **工作区设置**：工作区设置（座位配置、轮换、规则等）会自动保存到工作区数据中，不需要手动保存
3. **主题色**：主题色修改后需要点击"保存"才会持久化，但会实时预览
4. **缩放比例**：默认缩放比例仅在打开工作区时应用，不会立即改变当前缩放
5. **重置功能**：工作区设置不支持重置，因为它们是工作区特定数据

## 后续优化

- [ ] 添加多语言支持
- [ ] 添加更多主题色预设
- [ ] 添加深色模式
- [ ] 添加设置导入导出功能
- [ ] 添加设置搜索功能
- [ ] 优化移动端体验
