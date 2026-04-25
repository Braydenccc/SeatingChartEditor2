# 统一设置菜单实现计划

## 文档信息
- **创建日期**：2026-04-25
- **基于规范**：[2026-04-25-unified-settings-design.md](../specs/2026-04-25-unified-settings-design.md)
- **实施策略**：分阶段实现，每阶段可独立测试

---

## 一、实现概述

### 1.1 目标
实现一个统一的设置管理系统，整合全局设置和工作区设置，支持三种登录状态的数据同步。

### 1.2 技术栈
- Vue 3 Composition API
- Pinia（如需要）
- lucide-vue-next（图标）
- 现有 composables 系统
- WebDAV 客户端库

### 1.3 实现周期
预计 6 周，分 6 个阶段完成。

---

## 二、阶段 1：基础架构（第 1 周）

### 2.1 创建全局设置 Composable

**文件**：`src/composables/useGlobalSettings.js`

**实现内容**：
```javascript
import { ref, computed } from 'vue'

const STORAGE_KEY = 'sce-global-settings'

// 默认设置
const defaultSettings = {
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
    enableAnimations: true,
    compactMode: false
  },
  editor: {
    autoSaveInterval: 60000,
    defaultFileFormat: '.sce',
    undoHistorySize: 50,
    dragSensitivity: 1.0,
    doubleClickAction: 'edit'
  }
}

const globalSettings = ref({ ...defaultSettings })

export function useGlobalSettings() {
  // 从 localStorage 加载
  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        globalSettings.value = { ...defaultSettings, ...JSON.parse(stored) }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  // 保存到 localStorage
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalSettings.value))
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  // 更新单个设置
  const updateSetting = (path, value) => {
    const keys = path.split('.')
    let target = globalSettings.value
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]]
    }
    target[keys[keys.length - 1]] = value
  }

  // 重置设置
  const resetSettings = (category) => {
    if (category) {
      globalSettings.value[category] = { ...defaultSettings[category] }
    } else {
      globalSettings.value = { ...defaultSettings }
    }
  }

  return {
    globalSettings,
    loadFromLocalStorage,
    saveToLocalStorage,
    updateSetting,
    resetSettings
  }
}
```

**测试要点**：
- localStorage 读写正确
- 默认值正确应用
- 重置功能正常
- 响应式更新正常

---

### 2.2 创建设置对话框主组件

**文件**：`src/components/settings/UnifiedSettingsDialog.vue`

**实现内容**：
```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-overlay" @click.self="handleCancel">
      <div class="settings-dialog">
        <!-- 顶部 Tab -->
        <div class="settings-tabs">
          <button
            :class="{ active: activeTab === 'global' }"
            @click="activeTab = 'global'"
          >
            全局设置
          </button>
          <button
            :class="{ active: activeTab === 'workspace' }"
            @click="activeTab = 'workspace'"
          >
            工作区设置
          </button>
        </div>

        <!-- 主体区域 -->
        <div class="settings-body">
          <!-- 左侧导航 -->
          <nav class="settings-nav">
            <button
              v-for="category in currentCategories"
              :key="category.id"
              :class="{ active: activeCategory === category.id }"
              @click="activeCategory = category.id"
            >
              <component :is="category.icon" :size="16" />
              <span>{{ category.label }}</span>
            </button>
          </nav>

          <!-- 右侧内容 -->
          <div class="settings-content">
            <component :is="currentPanel" />
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="settings-footer">
          <button class="btn-secondary" @click="handleReset">重置</button>
          <div class="footer-actions">
            <button class="btn-secondary" @click="handleCancel">取消</button>
            <button class="btn-primary" @click="handleSave">保存</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Cloud, Palette, Edit, Info, Grid, RotateCw, Wand2, FileDown } from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible', 'save'])

const activeTab = ref('global')
const activeCategory = ref('sync')

// 全局设置分类
const globalCategories = [
  { id: 'sync', label: '云端同步', icon: Cloud },
  { id: 'ui', label: '界面偏好', icon: Palette },
  { id: 'editor', label: '编辑器行为', icon: Edit }
]

// 工作区设置分类
const workspaceCategories = [
  { id: 'info', label: '工作区信息', icon: Info },
  { id: 'seat', label: '座位表配置', icon: Grid },
  { id: 'rotation', label: '自动轮换', icon: RotateCw },
  { id: 'assignment', label: '智能排位', icon: Wand2 },
  { id: 'export', label: '导出配置', icon: FileDown }
]

const currentCategories = computed(() => {
  return activeTab.value === 'global' ? globalCategories : workspaceCategories
})

const currentPanel = computed(() => {
  // 动态加载对应的面板组件
  const panelMap = {
    global: {
      sync: 'GlobalSyncPanel',
      ui: 'GlobalUIPanel',
      editor: 'GlobalEditorPanel'
    },
    workspace: {
      info: 'WorkspaceInfoPanel',
      seat: 'WorkspaceSeatPanel',
      rotation: 'WorkspaceRotationPanel',
      assignment: 'WorkspaceAssignmentPanel',
      export: 'WorkspaceExportPanel'
    }
  }
  return panelMap[activeTab.value][activeCategory.value]
})

const handleSave = () => {
  emit('save')
  emit('update:visible', false)
}

const handleCancel = () => {
  // TODO: 检查是否有未保存的更改
  emit('update:visible', false)
}

const handleReset = () => {
  // TODO: 重置当前分类的设置
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-dialog {
  width: 900px;
  height: 600px;
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  height: 50px;
}

.settings-tabs button {
  flex: 1;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.settings-tabs button.active {
  border-bottom: 2px solid #23587b;
  color: #23587b;
}

.settings-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  width: 200px;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
}

.settings-nav button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.settings-nav button.active {
  background: rgba(35, 88, 123, 0.1);
  color: #23587b;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.settings-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  height: 60px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}
</style>
```

**测试要点**：
- Tab 切换正常
- 分类导航正常
- 对话框打开/关闭动画流畅

---

### 2.3 在 AppHeader 添加设置入口

**文件**：`src/components/layout/AppHeader.vue`

**修改内容**：
在用户按钮右侧添加设置按钮：

```vue
<template>
  <!-- 现有代码 -->
  <div class="header-right">
    <!-- 用户按钮 -->
    <button class="header-button user-button">
      <User :size="20" />
      <span>{{ username }}</span>
    </button>
    
    <!-- 新增：设置按钮 -->
    <button class="header-button settings-button" @click="showSettings = true">
      <Settings :size="20" />
      <span>设置</span>
    </button>
    
    <!-- GitHub 图标 -->
    <a href="https://github.com/..." class="header-button">
      <Github :size="20" />
    </a>
  </div>

  <!-- 设置对话框 -->
  <UnifiedSettingsDialog v-model:visible="showSettings" @save="handleSaveSettings" />
</template>

<script setup>
import { ref } from 'vue'
import { Settings } from 'lucide-vue-next'
import UnifiedSettingsDialog from '@/components/settings/UnifiedSettingsDialog.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'

const showSettings = ref(false)
const { saveToLocalStorage } = useGlobalSettings()

const handleSaveSettings = () => {
  saveToLocalStorage()
  // TODO: 云端同步逻辑
}
</script>
```

**测试要点**：
- 按钮显示正确
- 点击打开对话框
- 样式与其他按钮一致

---

## 三、阶段 2：全局设置面板（第 2 周）

### 3.1 云端同步设置面板

**文件**：`src/components/settings/panels/GlobalSyncPanel.vue`

**实现内容**：
- WebDAV 服务器地址输入
- 用户名/密码输入
- 自动同步开关
- 同步间隔选择
- 连接测试按钮
- 同步状态显示

**UI 元素**：
- Text input（服务器地址、用户名）
- Password input（密码）
- Toggle switch（自动同步）
- Select dropdown（同步间隔）
- Button（测试连接）
- Status indicator（同步状态）

---

### 3.2 界面偏好设置面板

**文件**：`src/components/settings/panels/GlobalUIPanel.vue`

**实现内容**：
- 语言选择（中文/English）
- 主题色选择器
- 默认缩放比例滑块
- 动画效果开关
- 紧凑模式开关

**实时预览**：
- 主题色更改立即应用到对话框
- 缩放比例实时显示数值

---

### 3.3 编辑器行为设置面板

**文件**：`src/components/settings/panels/GlobalEditorPanel.vue`

**实现内容**：
- 自动保存间隔选择
- 默认文件格式选择
- 撤销历史记录数量
- 拖拽灵敏度滑块
- 双击行为选择

---

## 四、阶段 3：工作区设置整合（第 3 周）

### 4.1 工作区信息面板

**文件**：`src/components/settings/panels/WorkspaceInfoPanel.vue`

**实现内容**：
- 工作区名称（可编辑）
- 创建时间（只读）
- 最后修改时间（只读）
- 备注说明（可编辑）

---

### 4.2 座位表配置面板

**文件**：`src/components/settings/panels/WorkspaceSeatPanel.vue`

**实现内容**：
复用 SidebarPanel 中的座位表配置逻辑：
- 大组数量
- 每组列数
- 每列座位数
- 讲台位置
- 座位对齐方式
- 每大组独立配置

**数据绑定**：
```javascript
import { useSeatChart } from '@/composables/useSeatChart'

const { config, updateConfig } = useSeatChart()
```

---

### 4.3 自动轮换配置面板

**文件**：`src/components/settings/panels/WorkspaceRotationPanel.vue`

**实现内容**：
- 位移轮换参数（行偏移、列直移、溢出列移）
- 选区轮换组管理
- 轮换历史查看

---

### 4.4 智能排位配置面板

**文件**：`src/components/settings/panels/WorkspaceAssignmentPanel.vue`

**实现内容**：
- 退火强度/迭代次数
- 算法选择（SA/EXHAUSTIVE）

---

### 4.5 导出配置面板

**文件**：`src/components/settings/panels/WorkspaceExportPanel.vue`

**实现内容**：
- 图片导出配置（标题、字号、颜色等）
- Excel 导出配置（单元格模板、样式等）
- WebDAV 导出路径

---

## 五、阶段 4：云端同步实现（第 4 周）

### 5.1 热铁盒 API 集成

**文件**：`src/api/userSettings.js`

**实现内容**：
```javascript
import { apiClient } from './client'

export async function getUserSettings() {
  try {
    const response = await apiClient.get('/user-settings')
    return response.data
  } catch (error) {
    console.error('Failed to fetch user settings:', error)
    return null
  }
}

export async function saveUserSettings(settings) {
  try {
    const response = await apiClient.post('/user-settings', settings)
    return response.data
  } catch (error) {
    console.error('Failed to save user settings:', error)
    throw error
  }
}
```

---

### 5.2 WebDAV 同步实现

**文件**：`src/api/webdavSettings.js`

**实现内容**：
```javascript
import { useWebDav } from '@/composables/useWebDav'

export async function loadSettingsFromWebDAV() {
  const { readFile } = useWebDav()
  try {
    const content = await readFile('/.sce-settings.json')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to load settings from WebDAV:', error)
    return null
  }
}

export async function saveSettingsToWebDAV(settings) {
  const { writeFile } = useWebDav()
  try {
    await writeFile('/.sce-settings.json', JSON.stringify(settings, null, 2))
  } catch (error) {
    console.error('Failed to save settings to WebDAV:', error)
    throw error
  }
}
```

---

### 5.3 同步逻辑整合

**修改文件**：`src/composables/useGlobalSettings.js`

**新增方法**：
```javascript
import { useAuth } from './useAuth'
import { getUserSettings, saveUserSettings } from '@/api/userSettings'
import { loadSettingsFromWebDAV, saveSettingsToWebDAV } from '@/api/webdavSettings'

// 启动时加载
const loadSettings = async () => {
  const { isLoggedIn, authType } = useAuth()
  
  if (isLoggedIn.value && authType.value === 'retiehe') {
    const cloudSettings = await getUserSettings()
    if (cloudSettings) {
      globalSettings.value = { ...defaultSettings, ...cloudSettings }
      saveToLocalStorage()
      return
    }
  } else if (isLoggedIn.value && authType.value === 'webdav') {
    const webdavSettings = await loadSettingsFromWebDAV()
    if (webdavSettings) {
      globalSettings.value = { ...defaultSettings, ...webdavSettings }
      saveToLocalStorage()
      return
    }
  }
  
  loadFromLocalStorage()
}

// 保存时同步
const saveSettings = async () => {
  const { isLoggedIn, authType } = useAuth()
  
  saveToLocalStorage()
  
  if (isLoggedIn.value && authType.value === 'retiehe') {
    await saveUserSettings(globalSettings.value)
  } else if (isLoggedIn.value && authType.value === 'webdav') {
    await saveSettingsToWebDAV(globalSettings.value)
  }
}
```

---

### 5.4 同步状态显示

**文件**：`src/components/settings/SyncStatus.vue`

**实现内容**：
- 显示同步状态（未登录/已同步/同步中/失败）
- 显示最后同步时间
- 提供手动同步按钮

---

## 六、阶段 5：UI 优化（第 5 周）

### 6.1 响应式适配

**移动端（<768px）**：
- 对话框全屏显示
- 左侧导航改为顶部横向 Tab
- 底部操作栏固定

**平板端（768px-1024px）**：
- 对话框宽度 90vw
- 保持左侧导航布局

---

### 6.2 动画优化

- 对话框淡入动画（200ms）
- Tab 切换动画（150ms）
- 保存成功提示动画

---

### 6.3 无障碍优化

- 语义化 HTML
- ARIA 标签
- 键盘导航支持
- 焦点管理

---

## 七、阶段 6：测试与文档（第 6 周）

### 7.1 单元测试

**测试文件**：
- `src/composables/__tests__/useGlobalSettings.test.js`
- `src/components/settings/__tests__/UnifiedSettingsDialog.test.js`

**测试覆盖**：
- Composable 逻辑
- 组件渲染
- 用户交互
- 数据持久化
- 同步逻辑

---

### 7.2 集成测试

**测试场景**：
- 完整设置流程
- 跨 Tab 切换
- 云端同步流程
- 响应式布局

---

### 7.3 用户文档

**文档文件**：`docs/user-guide/settings.md`

**内容**：
- 设置菜单使用指南
- 全局设置说明
- 工作区设置说明
- 云端同步配置
- 常见问题

---

## 八、技术风险与缓解

### 8.1 localStorage 容量限制
**风险**：设置数据可能超出 5-10MB 限制
**缓解**：压缩 JSON、监控使用量、必要时使用 IndexedDB

### 8.2 云端同步冲突
**风险**：多设备同时修改导致冲突
**缓解**：基于时间戳的冲突检测、手动解决选项

### 8.3 WebDAV 兼容性
**风险**：不同服务器实现不一致
**缓解**：测试主流服务、降级方案、详细错误信息

### 8.4 性能问题
**风险**：大量设置项导致渲染慢
**缓解**：虚拟滚动、懒加载、优化响应式更新

---

## 九、成功标准

1. **功能完整性**：所有设计规范功能已实现
2. **用户体验**：界面直观、响应快（<100ms）
3. **代码质量**：测试覆盖率 >80%、无 lint 错误
4. **兼容性**：支持主流浏览器和移动端

---

## 十、文件清单

### 新增文件
- `src/composables/useGlobalSettings.js`
- `src/components/settings/UnifiedSettingsDialog.vue`
- `src/components/settings/SyncStatus.vue`
- `src/components/settings/panels/GlobalSyncPanel.vue`
- `src/components/settings/panels/GlobalUIPanel.vue`
- `src/components/settings/panels/GlobalEditorPanel.vue`
- `src/components/settings/panels/WorkspaceInfoPanel.vue`
- `src/components/settings/panels/WorkspaceSeatPanel.vue`
- `src/components/settings/panels/WorkspaceRotationPanel.vue`
- `src/components/settings/panels/WorkspaceAssignmentPanel.vue`
- `src/components/settings/panels/WorkspaceExportPanel.vue`
- `src/api/userSettings.js`
- `src/api/webdavSettings.js`

### 修改文件
- `src/components/layout/AppHeader.vue`

---

## 十一、总结

本实现计划基于设计规范，分 6 个阶段完成统一设置菜单的开发。每个阶段都有明确的目标和可测试的交付物，确保项目按时高质量完成。
