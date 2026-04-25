# 统一设置菜单设计文档

## 文档信息
- **创建日期**：2026-04-25
- **设计目标**：建立统一的全局设置和工作区设置管理系统
- **设计方案**：一步到位重构，集成所有设置项

---

## 一、概述

### 1.1 设计目标
创建一个统一的设置管理系统，将分散在各处的全局设置和工作区设置整合到一个对话框中，提供清晰的分类导航和一致的用户体验。

### 1.2 核心特性
- **双层架构**：顶部 Tab 区分"全局设置"和"工作区设置"
- **左侧导航**：设置分类放在左侧栏，便于快速定位
- **多端同步**：支持 localStorage、热铁盒云端、WebDAV 三种存储方式
- **手动保存**：修改后需点击"保存"按钮才生效，支持取消恢复
- **三种登录状态**：未登录（仅本地）、SCE 账号（云端同步）、WebDAV（网盘同步）

---

## 二、整体架构

### 2.1 入口位置
- **位置**：[AppHeader.vue](src/components/layout/AppHeader.vue) 右侧
- **样式**：齿轮图标 + "设置"文字，与用户按钮保持一致的视觉风格
- **布局**：`[👤 用户名 ▼]  [⚙️ 设置]  [GitHub图标]`
- **统一样式**：相同的圆角、内边距、字体、hover 效果、边框样式

### 2.2 对话框结构
```
┌─────────────────────────────────────────────┐
│  [全局设置] [工作区设置]  ← 顶部 Tab 切换   │
├──────┬──────────────────────────────────────┤
│ 云端 │                                      │
│ 同步 │                                      │
│──────│         设置内容区域                  │
│ 界面 │                                      │
│ 偏好 │                                      │
│──────│                                      │
│ 编辑 │                                      │
│ 器   │                                      │
├──────┴──────────────────────────────────────┤
│          [取消] [保存]  ← 底部操作栏         │
└─────────────────────────────────────────────┘
```

**三层结构**：
- **顶部 Tab**：全局设置 / 工作区设置（两个大类）
- **左侧栏**：设置分类导航（根据顶部 Tab 动态切换）
- **右侧区域**：具体设置项表单
- **底部操作栏**：取消、保存按钮

### 2.3 数据存储策略
- **全局设置**：localStorage + 热铁盒云端数据库（自动同步）或 WebDAV
- **工作区设置**：随当前工作区数据保存，不影响其他工作区
- **启动时**：优先从云端拉取全局设置 → 失败则使用 localStorage → 都失败则使用默认值

---

## 三、设置分类与具体设置项

### 3.1 全局设置分类

#### 云端同步
- WebDAV 服务器地址
- WebDAV 用户名/密码
- 自动同步开关
- 同步间隔设置（毫秒）
- 连接测试按钮

#### 界面偏好
- 界面语言（中文/English）
- 主题色选择（当前 #23587b 或自定义）
- 默认缩放比例（50%-200%）
- 动画效果开关
- 紧凑模式开关

#### 编辑器行为
- 自动保存间隔（关闭/30秒/1分钟/5分钟）
- 默认文件格式（.sce / .bydsce.json）
- 撤销历史记录数量（10-100步）
- 拖拽灵敏度（0.5-2.0）
- 双击行为（编辑/选中）

### 3.2 工作区设置分类

**注意**：工作区设置直接修改**当前工作区**的配置，不是设置默认值。这些设置与 SidebarPanel 中的功能一致，只是整合到统一界面中。

#### 工作区信息
- 工作区名称（可编辑）
- 创建时间（只读）
- 最后修改时间（只读）
- 备注说明（可编辑）

#### 座位表配置
- 大组数量（`seatConfig.groupCount`）
- 每组列数（`seatConfig.columnsPerGroup`）
- 每列座位数（`seatConfig.seatsPerColumn`）
- 讲台位置（`seatConfig.podiumPosition`：顶部/底部）
- 座位对齐方式（`seatConfig.seatAlignment`：对齐顶部/底部）
- 每大组独立配置（`seatConfig.groups[]`：支持不同大组有不同列数/行数）

#### 自动轮换配置
**位移轮换参数**：
- 行偏移（`configForm.shiftDistance`）
- 列直移（`configForm.shiftColShift`）
- 溢出列移（`configForm.shiftDirection`）

**选区轮换组**（`rotGroups`）：
- 轮换组列表（循环/互换类型）
- 每个组内的选区配置

#### 智能排位配置
- 退火强度/迭代次数（`assignConfig.maxIterations`）
- 算法选择（`assignConfig.algorithm`：SA/EXHAUSTIVE）

#### 导出配置
**图片导出**（来自 `useExportSettings`）：
- 标题/显示开关/字号/间距/颜色模式
- 行号/组号/讲台/标签显示开关
- 翻转行序开关
- 各元素字号（标题/行号/组号/讲台/姓名/学号/标签）
- Y轴偏移微调

**Excel 导出**：
- 单元格内容模板
- 边框样式（内边框/外边框/颜色）
- 字体样式（标题/表头/座位单元格的粗体/斜体/颜色/字号）
- 背景颜色（标题/表头/行号/讲台/座位/空座/空置）
- 行号/组号/序号编号方案
- 单元格尺寸（列宽/行高）
- 标签统计表开关

**WebDAV 导出路径**（`exportSettings.webdavExportDir`）

---

## 四、数据模型与 API 设计

### 4.1 前端数据模型

#### 全局设置数据结构 (`useGlobalSettings`)
```javascript
const globalSettings = ref({
  // 云端同步
  sync: {
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    autoSync: true,
    syncInterval: 300000 // 毫秒
  },
  
  // 界面偏好
  ui: {
    language: 'zh-CN', // 'zh-CN' | 'en-US'
    themeColor: '#23587b',
    defaultZoom: 100, // 50-200
    enableAnimations: true,
    compactMode: false
  },
  
  // 编辑器行为
  editor: {
    autoSaveInterval: 60000, // 0=关闭, 30000/60000/300000
    defaultFileFormat: '.sce', // '.sce' | '.bydsce.json'
    undoHistorySize: 50, // 10-100
    dragSensitivity: 1.0, // 0.5-2.0
    doubleClickAction: 'edit' // 'edit' | 'select'
  }
})
```

#### 工作区设置数据结构
直接使用现有的 composables，不创建新的数据结构：
- `seatConfig` (来自 `useSeatChart`)
- `exportSettings` (来自 `useExportSettings`)
- `assignConfig` (来自 `useAssignment`)
- `rotGroups` (来自 `useZoneRotation`)
- `configForm` (来自 SidebarPanel，用于轮换参数)

### 4.2 后端 API 设计

**基础路径**：`https://api.retiehe.com/sce/`

#### 1. 获取用户全局设置
```
GET /user-settings
Headers: Authorization: Bearer <token>  // 仅 SCE 账号登录时需要
Response: {
  success: true,
  data: { ...globalSettings },
  updatedAt: "2026-04-25T10:30:00Z"
}
```

#### 2. 保存用户全局设置
```
POST /user-settings
Headers: Authorization: Bearer <token>  // 仅 SCE 账号登录时需要
Body: { ...globalSettings }
Response: {
  success: true,
  updatedAt: "2026-04-25T10:35:00Z"
}
```

#### 3. 错误处理
- 401: 未登录或 token 过期
- 500: 服务器错误
- 前端降级策略：API 失败时使用 localStorage

### 4.3 同步机制

#### 三种登录状态的处理

**场景 A：未登录（游客模式）**
- 仅使用 localStorage 存储
- 设置对话框中显示提示："当前未登录，设置仅保存在本地浏览器"
- 提供"登录以同步设置"按钮

**场景 B：SCE 账号登录**
- localStorage + 热铁盒云端数据库双重存储
- 启动时优先从云端拉取
- 保存时同时写入 localStorage 和云端 API

**场景 C：WebDAV 登录**
- localStorage + WebDAV 网盘双重存储
- 在 WebDAV 根目录保存 `.sce-settings.json` 文件
- 启动时从 WebDAV 读取该文件
- 保存时同时写入 localStorage 和 WebDAV

#### 启动时加载逻辑
```javascript
if (isLoggedIn && authType === 'retiehe') {
  // SCE 账号：从热铁盒 API 加载
  settings = await fetchFromRetieheAPI() || loadFromLocalStorage() || defaultSettings
} else if (isLoggedIn && authType === 'webdav') {
  // WebDAV：从网盘加载
  settings = await fetchFromWebDAV('/.sce-settings.json') || loadFromLocalStorage() || defaultSettings
} else {
  // 未登录：仅本地
  settings = loadFromLocalStorage() || defaultSettings
}
```

#### 保存时逻辑
```javascript
// 始终保存到 localStorage
saveToLocalStorage(settings)

if (isLoggedIn && authType === 'retiehe') {
  // 同步到热铁盒 API
  await saveToRetieheAPI(settings)
} else if (isLoggedIn && authType === 'webdav') {
  // 同步到 WebDAV
  await saveToWebDAV('/.sce-settings.json', settings)
}
```

#### 设置对话框中的状态提示
- 未登录：显示"仅本地存储"标签
- SCE 账号：显示"已同步到云端"标签 + 最后同步时间
- WebDAV：显示"已同步到 WebDAV"标签 + 最后同步时间

---

## 五、组件设计与交互细节

### 5.1 组件结构

**文件位置**：`src/components/settings/UnifiedSettingsDialog.vue`

**组件层级**：
```
UnifiedSettingsDialog.vue (主对话框)
├── SettingsTopTabs.vue (顶部 Tab：全局/工作区)
├── SettingsSidebar.vue (左侧分类导航)
└── SettingsContent.vue (右侧内容区)
    ├── GlobalSyncSettings.vue (全局-云端同步)
    ├── GlobalUISettings.vue (全局-界面偏好)
    ├── GlobalEditorSettings.vue (全局-编辑器行为)
    ├── WorkspaceInfoSettings.vue (工作区-信息)
    ├── WorkspaceSeatSettings.vue (工作区-座位表配置)
    ├── WorkspaceRotationSettings.vue (工作区-自动轮换)
    ├── WorkspaceAssignmentSettings.vue (工作区-智能排位)
    └── WorkspaceExportSettings.vue (工作区-导出配置)
```

### 5.2 视觉设计规范

#### 对话框尺寸
- 宽度：900px
- 高度：600px
- 最小宽度：800px
- 最小高度：500px
- 居中显示，带半透明遮罩

#### 布局比例
- 顶部 Tab 栏：50px 高度
- 左侧导航栏：200px 宽度
- 右侧内容区：自适应
- 底部操作栏：60px 高度

#### 配色方案（与项目一致）
- 主色：`#23587b`
- 背景：`#ffffff`
- 边框：`#e0e0e0`
- 激活状态：`rgba(35, 88, 123, 0.1)`
- 悬停状态：`rgba(35, 88, 123, 0.05)`

#### 图标使用
- 统一使用 `lucide-vue-next`
- 尺寸：16px（导航项）、14px（表单项）
- 描边宽度：2

### 5.3 交互细节

#### 打开对话框
- 点击 AppHeader 的"设置"按钮
- 淡入动画（200ms）
- 默认打开"全局设置 > 云端同步"

#### 切换顶部 Tab
- 点击切换"全局设置"/"工作区设置"
- 左侧导航栏内容动态更新
- 保持在第一个分类

#### 左侧导航交互
- 点击分类切换右侧内容
- 激活项高亮显示
- 支持键盘上下键导航

#### 表单交互
- 输入框失焦时验证
- 滑块实时显示数值
- 颜色选择器使用原生 `<input type="color">`
- 开关使用自定义 Toggle 组件

#### 保存/取消
**点击"保存"**：
1. 验证所有表单项
2. 显示加载状态
3. 执行保存逻辑（localStorage + 云端）
4. 显示成功/失败提示
5. 关闭对话框

**点击"取消"**：
1. 如果有未保存修改，弹出确认对话框
2. 确认后恢复原始值并关闭

#### 同步状态显示
右上角显示同步状态标签：
- 未登录：灰色"仅本地"
- SCE 账号：绿色"已同步" + 时间
- WebDAV：蓝色"WebDAV 已同步" + 时间
- 同步中：黄色"同步中..."
- 同步失败：红色"同步失败"

### 5.4 响应式适配

#### 移动端（<768px）
- 对话框全屏显示
- 左侧导航改为顶部横向滚动 Tab
- 底部操作栏固定在底部

#### 平板端（768px-1024px）
- 对话框宽度 90vw
- 保持左侧导航布局

---

## 六、实现计划

### 6.1 前端实现步骤

#### 阶段 1：基础架构（优先级：高）
1. 创建 `useGlobalSettings` composable
2. 创建 `UnifiedSettingsDialog` 主对话框组件
3. 实现顶部 Tab 切换逻辑
4. 实现左侧导航栏
5. 在 AppHeader 添加设置按钮入口

#### 阶段 2：全局设置实现（优先级：高）
1. 实现 `GlobalSyncSettings` 组件
2. 实现 `GlobalUISettings` 组件
3. 实现 `GlobalEditorSettings` 组件
4. 实现 localStorage 存储逻辑
5. 实现表单验证和保存逻辑

#### 阶段 3：工作区设置整合（优先级：中）
1. 实现 `WorkspaceInfoSettings` 组件
2. 实现 `WorkspaceSeatSettings` 组件（整合 SidebarPanel 中的座位配置）
3. 实现 `WorkspaceRotationSettings` 组件（整合轮换配置）
4. 实现 `WorkspaceAssignmentSettings` 组件（整合排位配置）
5. 实现 `WorkspaceExportSettings` 组件（整合导出配置）

#### 阶段 4：云端同步实现（优先级：中）
1. 实现热铁盒 API 调用逻辑
2. 实现 WebDAV 文件读写逻辑
3. 实现启动时加载逻辑
4. 实现保存时同步逻辑
5. 实现同步状态显示

#### 阶段 5：优化与测试（优先级：低）
1. 响应式适配（移动端/平板）
2. 动画效果优化
3. 错误处理完善
4. 单元测试编写
5. 用户体验测试

### 6.2 后端实现步骤

#### 热铁盒 API 开发
1. 创建用户设置数据表
2. 实现 `GET /user-settings` 接口
3. 实现 `POST /user-settings` 接口
4. 添加认证中间件
5. 错误处理和日志记录

### 6.3 迁移计划

#### SidebarPanel 重构
1. 保留 SidebarPanel 现有功能（向后兼容）
2. 在设置对话框中提供相同功能的入口
3. 逐步引导用户使用新的设置界面
4. 未来版本可考虑移除 SidebarPanel 中的重复设置项

---

## 七、技术要点

### 7.1 状态管理
- 全局设置使用 `useGlobalSettings` composable 管理
- 工作区设置直接使用现有 composables（`useSeatChart`、`useExportSettings` 等）
- 避免重复的状态定义

### 7.2 数据持久化
- localStorage 作为本地缓存，始终可用
- 云端同步作为增强功能，失败时降级到本地
- WebDAV 同步使用现有的 `useWebDav` composable

### 7.3 表单验证
- 使用 Vue 3 的响应式系统进行实时验证
- 保存前进行完整性检查
- 提供清晰的错误提示

### 7.4 性能优化
- 使用 `defineAsyncComponent` 异步加载设置子组件
- 避免不必要的响应式计算
- 防抖处理频繁的输入事件

---

## 八、注意事项

### 8.1 向后兼容
- 保持现有 composables 的 API 不变
- SidebarPanel 中的功能继续可用
- 工作区文件格式保持兼容

### 8.2 数据安全
- WebDAV 密码使用加密存储
- 敏感信息不记录日志
- 云端传输使用 HTTPS

### 8.3 用户体验
- 提供清晰的同步状态反馈
- 未保存修改时给予警告
- 错误信息友好且可操作

### 8.4 测试覆盖
- 三种登录状态的完整测试
- 同步失败的降级测试
- 表单验证的边界测试
- 响应式布局的兼容性测试

---

## 九、未来扩展

### 9.1 可能的增强功能
- 设置导入/导出（JSON 格式）
- 设置历史记录和回滚
- 多设备设置冲突解决
- 设置搜索功能
- 设置预设方案（如"紧凑模式"、"演示模式"）

### 9.2 国际化支持
- 所有设置项的多语言翻译
- 根据 `ui.language` 动态切换界面语言
- 日期时间格式本地化

---

## 十、总结

本设计文档详细描述了统一设置菜单的完整实现方案，包括：
- 清晰的架构设计（双层 Tab + 左侧导航）
- 完整的设置项分类（全局设置 + 工作区设置）
- 三种登录状态的同步机制（未登录/SCE/WebDAV）
- 详细的组件设计和交互规范
- 分阶段的实现计划

该方案采用一步到位重构的策略，将所有设置项整合到统一界面，同时保持向后兼容，为用户提供更好的设置管理体验。
