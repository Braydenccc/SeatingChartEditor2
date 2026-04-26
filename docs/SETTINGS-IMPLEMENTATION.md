# 设置系统实现文档

## 概述

实现了完整的统一设置对话框系统，包含全局设置和工作区设置两大类别。

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
    doubleClickAction: 'edit'
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
