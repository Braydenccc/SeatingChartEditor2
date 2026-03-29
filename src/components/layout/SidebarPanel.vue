<template>
  <!-- 移动端遮罩 -->
  <Transition name="overlay-fade">
    <div v-if="mobileMenuOpen" class="mobile-overlay" @click="closeMobileMenu"></div>
  </Transition>

  <div class="sidebar-panel" :class="{ 'mobile-menu-open': mobileMenuOpen }">
    <div class="sidebar-main">
      <div class="tabs-bar">
        <button v-for="tab in tabs" :key="tab.id" class="tab-button" :class="{ active: activeTab === tab.id }"
          @click="setActiveTab(tab.id)">
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
      <div class="options-bar">
        <!-- 文件管理 -->
        <div class="option-content" :class="{ active: activeTab === 1 }">
          <div class="tab-header">
            <h3>工作区管理</h3>
          </div>
          <div class="options-group">
            <input ref="workspaceInput" type="file" accept=".sce,.bydsce.json" style="display: none"
              @change="handleLoadWorkspace" />
            <button class="option-button" @click="$refs.workspaceInput.click()">
              <span>📂 加载本地</span>
            </button>
            <button class="option-button" @click="handleSaveWorkspace">
              <span>💾 保存到本地</span>
            </button>
            <button class="option-button" @click="handleCloudLoad">
              <span>☁️ 从云端加载</span>
            </button>
            <button class="option-button primary" @click="handleCloudSave">
              <span>☁️ 保存至云端</span>
            </button>
          </div>

          <div class="tab-header">
            <h3>名单管理</h3>
          </div>
          <div class="options-group">
            <button class="option-button" @click="handleDownloadTemplate">
              <span>下载名单模板</span>
            </button>
            <input ref="excelInput" type="file" accept=".xlsx,.xls" style="display: none" @change="handleImportExcel" />
            <button class="option-button" @click="$refs.excelInput.click()">
              <span>从Excel导入名单</span>
            </button>
            <button class="option-button" @click="handleExportExcel">
              <span>导出名单到Excel</span>
            </button>
          </div>
        </div>

        <!-- 对座位进行局部编辑 -->
        <div class="option-content" :class="{ active: activeTab === 2 }">
          <div class="tab-header">
            <h3>座位表配置</h3>
          </div>
          <div class="options-group">
            <div class="input-group">
              <label for="groupCount">大组数量:</label>
              <input id="groupCount" v-model.number="configForm.groupCount" type="number" min="1" max="10" />
            </div>
            <div class="input-group">
              <label for="columnsPerGroup">每组列数:</label>
              <input id="columnsPerGroup" v-model.number="configForm.columnsPerGroup" type="number" min="1" max="5" />
            </div>
            <div class="input-group">
              <label for="seatsPerColumn">每列座位数:</label>
              <input id="seatsPerColumn" v-model.number="configForm.seatsPerColumn" type="number" min="1" max="10" />
            </div>
            <button class="option-button primary" @click="applyConfig">
              <span>应用配置</span>
            </button>
          </div>

          <div class="tab-header">
            <h3>座位编辑</h3>
          </div>
          <div class="options-group">
            <button id="swapSeat" class="option-button" :class="{ active: currentMode === EditMode.SWAP }"
              @click="toggleSwapMode">
              <span>交换座位</span>
            </button>
            <button id="clearSeat" class="option-button" :class="{ active: currentMode === EditMode.CLEAR }"
              @click="toggleClearMode">
              <span>清空座位</span>
            </button>
            <button id="emptySeat" class="option-button" :class="{ active: currentMode === EditMode.EMPTY_EDIT }"
              @click="toggleEmptyEditMode">
              <span>空置座位</span>
            </button>
          </div>
          <div class="tab-header">
            <div class="tab-header-row">
              <h3>自动轮换</h3>
              <div class="shift-mode-tabs">
                <button class="shift-mode-tab" :class="{ active: shiftMode === 'shift' }" @click="shiftMode = 'shift'">位移</button>
                <button class="shift-mode-tab" :class="{ active: shiftMode === 'zone' }" @click="shiftMode = 'zone'">选区</button>
              </div>
            </div>
          </div>

          <!-- 位移轮换面板 -->
          <template v-if="shiftMode === 'shift'">
            <div class="options-group">
              <div class="shift-diagram">
                <div class="diagram-center">
                  <button class="diagram-row-btn" :class="{ active: configForm.shiftDistance < 0 }"
                    @click="configForm.shiftDistance = -Math.abs(configForm.shiftDistance || 4)">
                    ▲ 向前（行）
                  </button>
                  <div class="diagram-grid-row">
                    <button class="diagram-col-btn" :class="{ active: configForm.shiftColShift < 0 }"
                      @click="configForm.shiftColShift = -Math.abs(configForm.shiftColShift || 1)">◀ 左</button>
                    <div class="diagram-grid-9">
                      <div v-for="row in 9" :key="row" class="diagram-row-9">
                        <div v-for="col in 9" :key="col" class="diagram-cell-sm"
                          :class="getDiagramCellClass(col - 1, row - 1)"
                          @click="handleDiagramClick(col - 1, row - 1)"></div>
                      </div>
                    </div>
                    <button class="diagram-col-btn" :class="{ active: configForm.shiftColShift > 0 }"
                      @click="configForm.shiftColShift = Math.abs(configForm.shiftColShift || 1)">右 ▶</button>
                  </div>
                  <button class="diagram-row-btn" :class="{ active: configForm.shiftDistance > 0 }"
                    @click="configForm.shiftDistance = Math.abs(configForm.shiftDistance || 4)">
                    ▼ 向后（行）
                  </button>
                </div>
                <div class="diagram-status-bar">
                  <span class="dot dot-red"></span> 当前
                  <span class="dot dot-green"></span> 目标
                  <span class="diagram-status-hint">· {{ getDiagramStatusText() }}</span>
                </div>
              </div>
              <div class="shift-inputs-row">
                <div class="input-group-compact">
                  <label for="shiftDistance">行偏移</label>
                  <input id="shiftDistance" v-model.number="configForm.shiftDistance" type="number"/>
                </div>
                <div class="input-group-compact">
                  <label for="shiftColShift">列直移</label>
                  <input id="shiftColShift" v-model.number="configForm.shiftColShift" type="number"/>
                </div>
                <div class="input-group-compact">
                  <label for="shiftDirection" title="行溢出边界时额外偏移的列数（正=左，负=右）">溢出列移</label>
                  <input id="shiftDirection" v-model.number="configForm.shiftDirection" type="number"/>
                </div>
              </div>
              <button id="shiftSeat" class="option-button primary" @click="applySeatShift">
                <span>应用轮换</span>
              </button>
            </div>
          </template>

          <!-- 选区轮换面板 -->
          <template v-if="shiftMode === 'zone'">
            <!-- 编辑状态提示 -->
            <div v-if="editingZoneId" class="zone-rot-editing-hint">
              ✏ 正在编辑选区，请在座位表上点击座位以选入/取消
              <button class="zone-rot-hint-close" @click="handleStopEditing">完成</button>
            </div>

            <div class="options-group">
              <div class="zone-rot-section-header">
                <span class="zone-rot-section-title">轮换组</span>
                <div style="display:flex;gap:4px">
                  <button class="zone-rot-add-btn" @click="handleAddGroup('cycle')">＋ 循环</button>
                  <button class="zone-rot-add-btn" @click="handleAddGroup('swap')">＋ 互换</button>
                </div>
              </div>

              <div v-if="rotGroups.length === 0" class="zone-rot-empty">
                暂无轮换组，点击「＋ 循环」或「＋ 互换」新建
              </div>

              <div v-for="group in rotGroups" :key="group.id" class="zone-rot-group">
                <!-- 组标题：inline 重命名 input -->
                <div class="zone-rot-group-header">
                  <span class="zone-rot-type-badge" :class="group.type">
                    {{ group.type === 'cycle' ? '循环' : '互换' }}
                  </span>
                  <input class="zone-rot-name-input" v-model="group.name"
                    @click.stop title="点击修改组名" />
                  <button class="zone-rot-del" @click="handleDeleteGroup(group.id)">✕</button>
                </div>

                <!-- 组内选区列表 -->
                <div class="zone-rot-group-zones">
                  <div v-for="(zone, idx) in group.zones" :key="zone.id"
                    class="zone-rot-group-zone-row"
                    :class="{ editing: editingZoneId === zone.id }">
                    <!-- 颜色点：点击切换编辑此选区 -->
                    <span class="zone-rot-dot zone-rot-dot-btn"
                      :style="{ background: getZoneColor(group.id, zone.id) }"
                      @click="handleSelectEditingZone(zone.id)"
                      :title="editingZoneId === zone.id ? '点击停止编辑' : '点击开始编辑此选区'">
                    </span>
                    <!-- 选区名：inline input 重命名 -->
                    <input class="zone-rot-zone-name-input" v-model="zone.name" @click.stop/>
                    <!-- 循环箭头 -->
                    <span v-if="group.type === 'cycle'" class="zone-rot-arrow">
                      {{ idx < group.zones.length - 1 ? '→' : '↩' }}
                    </span>
                    <!-- 互换箭头 -->
                    <span v-if="group.type === 'swap' && idx === 0" class="zone-rot-arrow">⇄</span>
                    <span class="zone-rot-count">{{ zone.seatIds.length }}座</span>
                    <button class="zone-rot-del" @click.stop="handleDeleteZoneFromGroup(group.id, zone.id)">✕</button>
                  </div>

                  <!-- 添加选区按钮（在组内） -->
                  <button class="zone-rot-add-zone-btn" @click="handleAddZoneToGroup(group.id)">
                    ＋ 添加选区
                  </button>

                  <!-- 校验错误 -->
                  <div v-if="getGroupError(group)" class="zone-rot-group-error">⚠ {{ getGroupError(group) }}</div>
                </div>
              </div>
            </div>

            <button class="option-button primary" @click="handleApplyZoneRotation">
              <span>应用选区轮换</span>
            </button>
          </template>



        </div>

        <!-- 自动调位、随机排位、座位选区、座位绑定 -->
        <div class="option-content" :class="{ active: activeTab === 3 }">
          <div class="tab-header">
            <h3>智能排位</h3>
          </div>

          <!-- 选区列表 -->
          <ZoneList />

          <!-- 规则快捷管理 -->
          <div class="options-group assign-rule-group">
            <button class="option-button rule-shortcut-btn" @click="showRuleEditor = true">
              <span class="rule-shortcut-icon">📋</span>
              <span class="rule-shortcut-text">规则管理</span>
              <span v-if="ruleCount > 0" class="rule-badge">{{ ruleCount }}</span>
            </button>
          </div>

          <!-- 进度条 -->
          <div v-if="isAssigning" class="assign-progress-wrap">
            <div class="assign-progress-bar" :style="{ width: assignmentProgress + '%' }"></div>
            <span class="assign-progress-text">{{ assignmentProgress }}%</span>
          </div>



          <div class="options-group">
            <button id="applyAssign" class="option-button primary" :disabled="isAssigning" @click="handleRunAssignment">
              <span>{{ isAssigning ? '排位中...' : '🚀 智能排位' }}</span>
            </button>
          </div>

          <!-- 排位报告内联显示 -->
          <AssignmentInlineReport 
            v-if="lastAssignmentReport !== null && !isAssigning"
            :report="lastAssignmentReport" 
            :duration="lastAssignmentDuration" 
          />
        </div>

        <!-- 导出座位表图片 -->
        <div class="option-content" :class="{ active: activeTab === 4 }">
          <div class="tab-header">
            <h3>导出图片</h3>
          </div>
          <div class="options-group">
            <button class="option-button" @click="showExportDialog = true">
              <span>导出设置</span>
            </button>
          </div>

          <div class="options-group" v-if="lastExportUrl">
            <p class="preview-label">上次导出预览</p>
            <div class="export-thumbnail-wrap">
              <img :src="lastExportUrl" alt="上次导出" class="export-thumbnail" @click="showExportDialog = true" />
            </div>
          </div>

          <div class="options-group">
            <button class="option-button primary" :disabled="isExporting" @click="handleQuickExport">
              <span>{{ isExporting ? '正在生成...' : '导出' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 日志区域 -->
    <div class="log-area">
      <div class="log-header">
        <span class="log-title">日志</span>
        <button class="log-clear-btn" @click="handleClearLogs" v-if="logs.length > 0">
          清空
        </button>
      </div>
      <div class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-item" :class="`log-${log.type}`">
          <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">
          暂无日志
        </div>
      </div>
    </div>
  </div>

  <!-- 导出设置弹窗 -->
  <ExportDialog :visible="showExportDialog" @close="showExportDialog = false" @exported="onExported" />

  <!-- 云端工作区弹窗 -->
  <CloudWorkspaceDialog 
    :visible="showCloudDialog" 
    :mode="cloudDialogMode" 
    @update:visible="showCloudDialog = $event" 
    @success="handleCloudSuccess"
  />

  <!-- 座位规则编辑器模态框 -->
  <SeatRuleEditor :visible="showRuleEditor" initialTab="rules" @close="showRuleEditor = false" />


</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useSidebar } from '@/composables/useSidebar'
import { useSeatChart } from '@/composables/useSeatChart'
import { useEditMode } from '@/composables/useEditMode'
import { useAssignment } from '@/composables/useAssignment'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useExportSettings } from '@/composables/useExportSettings'
import { useImageExport } from '@/composables/useImageExport'
import { useExcelData } from '@/composables/useExcelData'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useSeatRules } from '@/composables/useSeatRules'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'
import ZoneList from '../zone/ZoneList.vue'
import SeatRuleEditor from '../relation/SeatRuleEditor.vue'
import AssignmentInlineReport from '../rule/AssignmentInlineReport.vue'
import ExportDialog from './ExportPreview.vue'
import CloudWorkspaceDialog from '../workspace/CloudWorkspaceDialog.vue'
import { useAuth } from '@/composables/useAuth'

const { activeTab, mobileMenuOpen, setActiveTab, closeMobileMenu } = useSidebar()
const { seatConfig, updateConfig, clearAllSeats, seats, shiftSeats } = useSeatChart()
const { currentMode, setMode, toggleEmptyEditMode, EditMode } = useEditMode()
const { isAssigning, assignmentProgress, runSmartAssignment } = useAssignment()
const { tags, addTag, clearAllTags } = useTagData()
const { students, addStudent, updateStudent, clearAllStudents } = useStudentData()
const { exportSettings } = useExportSettings()
const { exportToImage } = useImageExport()
const { downloadTemplate, importFromExcel, exportToExcel } = useExcelData()
const { saveWorkspace, loadWorkspace, applyWorkspaceData } = useWorkspace()
const { logs, success, warning, error, clearLogs } = useLogger()
const { requestConfirm, isConfirming } = useConfirmAction()
const { ruleCount } = useSeatRules()
const { isLoggedIn, isLoginDialogVisible } = useAuth()

// ==================== 选区轮换 ====================
const {
  rotGroups,
  editingZoneId,
  addRotGroup,
  deleteRotGroup,
  addZoneToGroup,
  deleteZoneFromGroup,
  selectEditingZone,
  clearEditingZone,
  getZoneColor,
  validateGroup,
  applyZoneRotation,
} = useZoneRotation()

// 轮换面板 Tab（'shift' | 'zone'）
const shiftMode = ref('shift')

// ——— 轮换组 handlers ———
const handleAddGroup = (type) => addRotGroup(type)
const handleDeleteGroup = (groupId) => {
  deleteRotGroup(groupId)
  // 若删除后已无编辑选区，退出 ZONE_EDIT 模式
  if (editingZoneId.value === null) setMode(EditMode.NORMAL)
}

// ——— 组内选区 handlers ———
const handleAddZoneToGroup = (groupId) => {
  addZoneToGroup(groupId)  // 自动设置 editingZoneId
  setMode(EditMode.ZONE_EDIT)
}

const handleDeleteZoneFromGroup = (groupId, zoneId) => {
  deleteZoneFromGroup(groupId, zoneId)
  if (editingZoneId.value === null) setMode(EditMode.NORMAL)
}

const handleSelectEditingZone = (zoneId) => {
  const wasEditing = editingZoneId.value === zoneId
  selectEditingZone(zoneId)
  setMode(wasEditing ? EditMode.NORMAL : EditMode.ZONE_EDIT)
}

const handleStopEditing = () => {
  clearEditingZone()
  setMode(EditMode.NORMAL)
}

/** 获取轮换组的校验错误信息 */
const getGroupError = (group) => {
  const { valid, error } = validateGroup(group)
  return valid ? '' : error
}

/** 执行选区轮换 */
const handleApplyZoneRotation = () => {
  if (rotGroups.value.length === 0) {
    warning('请先创建轮换组')
    return
  }
  const seatMapArg = new Map(seats.value.map(s => [s.id, s]))
  const { moved, errors } = applyZoneRotation(seatMapArg)
  errors.forEach(e => warning(e))
  if (moved > 0) {
    success(`选区轮换完成，已移动 ${moved} 个座位的学生`)
  } else if (errors.length === 0) {
    warning('没有学生被移动，请检查选区是否包含学生')
  }
}

const tabs = [
  { id: 1, label: '文件', icon: '📁' },
  { id: 2, label: '编辑', icon: '✏️' },
  { id: 3, label: '排位', icon: '🔀' },
  { id: 4, label: '导出', icon: '📤' }
]

// 座位配置表单
const configForm = ref({
  groupCount: 4,
  columnsPerGroup: 2,
  seatsPerColumn: 7,
  shiftDistance: 4,
  shiftColShift: 0,
  shiftDirection: -1,
})

// 规则编辑器显示状态
const showRuleEditor = ref(false)

// 排位结果状态
const lastAssignmentReport = ref(null)
const lastAssignmentDuration = ref(0)

// 打开联系编辑器并跳转到指定 Tab
const openRelationEditorTab = (tab) => {
  relationEditorTab.value = tab
  showRelationEditor.value = true
}

// 文件输入引用
const workspaceInput = ref(null)
const excelInput = ref(null)

// 标签设置本地副本
const tagSettingsLocal = ref({})

// 导出弹窗状态
const showExportDialog = ref(false)
const lastExportUrl = ref('')
const isExporting = ref(false)

// 导出完成回调
const onExported = (url) => {
  lastExportUrl.value = url
}

// 工作区管理 (云端)
const showCloudDialog = ref(false)
const cloudDialogMode = ref('load')

const handleCloudLoad = () => {
  if (!isLoggedIn.value) {
    isLoginDialogVisible.value = true
    return
  }
  cloudDialogMode.value = 'load'
  showCloudDialog.value = true
}

const handleCloudSave = () => {
  if (!isLoggedIn.value) {
    isLoginDialogVisible.value = true
    return
  }
  cloudDialogMode.value = 'save'
  showCloudDialog.value = true
}

const handleCloudSuccess = () => {
  // 可以根据需要执行刷新动作，当前弹窗内部已经 handled messages
}

// 工作区管理 (本地)
const handleSaveWorkspace = () => {
  const isSuccess = saveWorkspace()
  if (isSuccess) {
    success('工作区已成功保存到本地！')
  } else {
    error('工作区保存到本地失败，请查看控制台了解详情')
  }
}

const handleLoadWorkspace = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    // 直接加载并解析为JS对象
    const workspace = await loadWorkspace(file)

    // 验证返回值
    if (!workspace || !workspace.students || !workspace.tags) {
      error('工作区文件内容不完整或格式不正确')
      event.target.value = ''
      return
    }

    try {
      const isSuccess = await applyWorkspaceData(workspace)
      if (isSuccess) {
        success('工作区加载并恢复成功！')
      }
    } catch (err) {
      error('恢复工作区时发生错误: ' + (err.message || err))
    }
  } catch (err) {
    error(`加载失败: ${err.message}`)
  } finally {
    event.target.value = ''
  }
}

// Excel操作
const handleDownloadTemplate = () => {
  downloadTemplate()
}

const handleImportExcel = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await importFromExcel(file)

    // 检查是否有警告（学生或标签数量过多）
    if (result.warning) {
      warning(result.warning + '，请减少数据量后重试')
      event.target.value = ''
      return
    }

    // 直接导入，覆盖现有数据
    // 清除现有数据
    clearAllStudents()
    clearAllTags()

    // 预定义颜色列表
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788']

    // 创建所有标签并建立名称到ID的映射
    const tagNameToId = {}
    result.tagNames.forEach((tagName, index) => {
      const color = colors[index % colors.length]
      addTag({ name: tagName, color })

      // 直接从tags数组中找到刚添加的标签
      const foundTag = tags.value.find(t => t.name === tagName)
      if (foundTag) {
        tagNameToId[tagName] = foundTag.id
      }
    })

    // 导入所有学生
    result.students.forEach(studentData => {
      // 将标签名称转换为标签ID
      const studentTags = studentData.tagNames
        .map(tagName => tagNameToId[tagName])
        .filter(id => id != null)

      const newStudentId = addStudent()
      updateStudent(newStudentId, {
        name: studentData.name,
        studentNumber: studentData.studentNumber,
        tags: studentTags
      })
    })

    success(`成功导入 ${result.students.length} 个学生，${result.tagNames.length} 个标签`)
    event.target.value = ''
  } catch (err) {
    error(`导入失败: ${err.message}`)
    event.target.value = ''
  }
}

const handleExportExcel = () => {
  try {
    exportToExcel(students.value, tags.value)
    success('Excel导出成功！')
  } catch (err) {
    error(`导出失败: ${err.message}`)
  }
}

const applySeatShift = () => {
  const shiftDistance = configForm.value.shiftDistance || 0
  const shiftColShift = configForm.value.shiftColShift || 0
  const shiftDirection = configForm.value.shiftDirection || 0
  if (shiftDistance === 0 && shiftColShift === 0) {
    warning('行偏移和列偏移不能同时为 0')
    return
  }
  shiftSeats(shiftDistance, shiftDirection, shiftColShift)
  const parts = []
  if (shiftDistance !== 0) parts.push(`向${shiftDistance > 0 ? '后' : '前'} ${Math.abs(shiftDistance)} 行`)
  if (shiftColShift !== 0) parts.push(`向${shiftColShift > 0 ? '右' : '左'} ${Math.abs(shiftColShift)} 列`)
  if (shiftDirection !== 0) parts.push(`溢出时向${shiftDirection > 0 ? '左' : '右'}偏 ${Math.abs(shiftDirection)} 列`)
  success(`座位轮换完成：${parts.join('，')}`)
}

// 初始化时从 seatConfig 读取当前配置（只合并座位结构字段，保留轮换专属字段）
onMounted(() => {
  configForm.value = { ...configForm.value, ...seatConfig.value }
})

// ==================== 示意图辅助函数 ====================
const DIAGRAM_SIZE = 9
const DIAGRAM_CENTER = 4 // 0-indexed 中心 (4, 4)

/**
 * 计算示意图目标格子位置（正向公式）
 * 考虑行偏移 distance、直接列偏移 colShift、溢出方向 direction
 */
const getDiagramTarget = () => {
  const distance = configForm.value.shiftDistance || 0
  const colShift = configForm.value.shiftColShift || 0
  const direction = configForm.value.shiftDirection || 0
  // 行方向
  const dstRow_raw = DIAGRAM_CENTER + distance
  const overflow = Math.floor(dstRow_raw / DIAGRAM_SIZE)
  const dstRow = ((dstRow_raw % DIAGRAM_SIZE) + DIAGRAM_SIZE) % DIAGRAM_SIZE
  // 列方向 = 直接列偏移 + 溢出换列
  const dstCol = ((DIAGRAM_CENTER + colShift + overflow * direction) % DIAGRAM_SIZE + DIAGRAM_SIZE) % DIAGRAM_SIZE
  return { dstRow, dstCol, overflow }
}

/**
 * 路径格子集合：仅在纯行移动（无列偏移、无列溢出）时显示连线
 */
const getDiagramPathSet = () => {
  const distance = configForm.value.shiftDistance || 0
  const colShift = configForm.value.shiftColShift || 0
  if (distance === 0 || colShift !== 0) return new Set()
  const { dstRow, dstCol, overflow } = getDiagramTarget()
  if (overflow !== 0 || dstCol !== DIAGRAM_CENTER) return new Set()
  const pathSet = new Set()
  const rowMin = Math.min(DIAGRAM_CENTER, dstRow)
  const rowMax = Math.max(DIAGRAM_CENTER, dstRow)
  for (let r = rowMin + 1; r < rowMax; r++) {
    pathSet.add(`${DIAGRAM_CENTER},${r}`)
  }
  return pathSet
}

/** 返回格子的 CSS class */
const getDiagramCellClass = (col, row) => {
  const distance = configForm.value.shiftDistance || 0
  const colShift = configForm.value.shiftColShift || 0
  if (col === DIAGRAM_CENTER && row === DIAGRAM_CENTER) return 'cell-current'
  if (distance === 0 && colShift === 0) return ''
  const { dstRow, dstCol } = getDiagramTarget()
  if (col === dstCol && row === dstRow) return 'cell-target'
  const pathSet = getDiagramPathSet()
  if (pathSet.has(`${col},${row}`)) return 'cell-path'
  return ''
}

/**
 * 点击格子：直接设置行偏移 + 列偏移
 * 不再从点击位置推断 direction（direction 由专设输入控制）
 */
const handleDiagramClick = (col, row) => {
  configForm.value.shiftDistance = row - DIAGRAM_CENTER
  configForm.value.shiftColShift = col - DIAGRAM_CENTER
}

/** 状态说明文字 */
const getDiagramStatusText = () => {
  const d = configForm.value.shiftDistance || 0
  const c = configForm.value.shiftColShift || 0
  const dir = configForm.value.shiftDirection || 0
  if (d === 0 && c === 0) return '点击格子选择位移目标'
  const { overflow } = getDiagramTarget()
  const parts = []
  if (d !== 0) parts.push(`${d > 0 ? '↓' : '↑'}${Math.abs(d)}行`)
  if (c !== 0) parts.push(`${c > 0 ? '→' : '←'}${Math.abs(c)}列`)
  if (overflow !== 0 && dir !== 0) parts.push(`溢出→${dir > 0 ? '←' : '→'}${Math.abs(overflow * dir)}列`)
  return parts.join(' + ')
}


// 快速导出（侧边栏按钮）
const handleQuickExport = async () => {
  if (!seatConfig.value || seatConfig.value.groupCount === 0) {
    warning('请先配置座位表')
    return
  }

  isExporting.value = true
  try {
    const dataUrl = await exportToImage()
    lastExportUrl.value = dataUrl

    // 自动下载
    const link = document.createElement('a')
    link.href = dataUrl
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    link.download = `座位表_${ts}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    success('图片导出成功！')
  } catch (err) {
    error(`导出失败: ${err.message || '未知错误'}`)
  } finally {
    isExporting.value = false
  }
}

// 应用配置
const applyConfig = () => {
  const confirmed = requestConfirm('applyConfig', () => {
    updateConfig(configForm.value)
    clearAllSeats()
    success('座位配置已更新')
  })

  if (!confirmed) {
    warning('再次点击"应用配置"按钮以确认清空所有座位')
  }
}

// 切换交换模式
const toggleSwapMode = () => {
  if (currentMode.value === EditMode.SWAP) {
    setMode(EditMode.NORMAL)
  } else {
    setMode(EditMode.SWAP)
  }
}

// 切换清空模式
const toggleClearMode = () => {
  if (currentMode.value === EditMode.CLEAR) {
    setMode(EditMode.NORMAL)
  } else {
    setMode(EditMode.CLEAR)
  }
}

// 运行排位
const handleRunAssignment = async () => {
  if (isAssigning.value) return

  const result = await runSmartAssignment({
    useRules: true
  })

  if (result.success) {
    success(result.message)
    // 存储审计报告
    lastAssignmentReport.value = result.report ?? null
    lastAssignmentDuration.value = result.duration ?? 0
  } else {
    error(result.message)
  }
}

// 日志相关方法
const handleClearLogs = () => {
  clearLogs()
}

const formatLogTime = (timestamp) => {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

</script>

<style scoped>
.sidebar-panel {
  width: 20%;
  background: #f8f9fa;
  color: var(--color-primary);
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.05);
}

/* 响应式设计 - 中等屏幕 */
@media (max-width: 1400px) {
  .sidebar-panel {
    width: 25%;
  }
}

/* 响应式设计 - 平板 */
@media (max-width: 1024px) {
  .sidebar-panel {
    width: 100%;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  }
}

.sidebar-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 响应式设计 - 平板和移动设备 */
@media (max-width: 1024px) {
  .sidebar-main {
    flex-direction: column;
    flex: 1;
    min-height: 300px;
    overflow-y: auto;
  }
}

.tabs-bar {
  display: flex;
  justify-content: space-around;
  flex-direction: column;
  align-items: stretch;
  width: 20%;
  height: 100%;
  background: #e8eef2;
  border-right: 1px solid #d0d7dc;
}

/* 响应式设计 - 平板和移动设备 */
@media (max-width: 1024px) {
  .tabs-bar {
    width: 100%;
    height: auto;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid #d0d7dc;
  }
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 500;
  width: 100%;
  height: 25%;
  background: transparent;
  border: none;
  border-bottom: 1px solid #d0d7dc;
  cursor: pointer;
  color: #5a7a8f;
  transition: all 0.3s ease;
  position: relative;
}

/* 响应式设计 - 平板和移动设备 */
@media (max-width: 1024px) {
  .tab-button {
    flex: 1;
    height: 60px;
    border-bottom: none;
    border-right: 1px solid #d0d7dc;
    font-size: 14px;
  }

  .tab-button:last-child {
    border-right: none;
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .tab-button {
    height: 50px;
    font-size: 13px;
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .tab-button {
    font-size: 12px;
    padding: 5px;
  }
}

.tab-button::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 0;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
  transition: height 0.3s ease;
}

/* 响应式设计 - 平板和移动设备 */
@media (max-width: 1024px) {
  .tab-button::before {
    left: 50%;
    top: auto;
    bottom: 0;
    transform: translateX(-50%);
    width: 0;
    height: 3px;
    border-radius: 2px 2px 0 0;
    transition: width 0.3s ease;
  }

  .tab-button.active::before {
    width: 60%;
    height: 3px;
  }
}

.tab-button:hover {
  background: rgba(35, 88, 123, 0.08);
  color: var(--color-primary);
}

.tab-button.active {
  background: rgba(35, 88, 123, 0.12);
  color: var(--color-primary);
  font-weight: 600;
}

.tab-button.active::before {
  height: 60%;
}

.tab-label {
  font-size: 15px;
}

@media (max-width: 768px) {
  .tab-label {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .tab-label {
    font-size: 12px;
  }
}

.options-bar {
  width: 80%;
  background: #ffffff;
  overflow-y: auto;
}

/* 响应式设计 - 平板和移动设备 */
@media (max-width: 1024px) {
  .options-bar {
    width: 100%;
  }
}

.options-bar::-webkit-scrollbar {
  width: 6px;
}

.options-bar::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.options-bar::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.options-bar::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.option-content {
  display: none;
  flex-direction: column;
  padding: 20px;
  height: 100%;
}

.option-content.active {
  display: flex;
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .option-content {
    padding: 15px;
  }

  .tab-header h3 {
    font-size: 16px;
  }

  .option-button {
    padding: 10px 14px;
    font-size: 13px;
  }

  .options-group {
    gap: 10px;
    margin-bottom: 18px;
    padding-bottom: 14px;
  }
}

@media (max-width: 480px) {
  .option-content {
    padding: 12px;
  }

  .tab-header h3 {
    font-size: 15px;
  }

  .option-button {
    padding: 9px 12px;
    font-size: 12px;
  }

  .input-group label {
    font-size: 12px;
  }

  .input-group input[type="number"],
  .input-group input[type="text"] {
    padding: 8px 10px;
    font-size: 13px;
  }

  .checkbox-label {
    padding: 8px 10px;
    font-size: 13px;
  }
}

.tab-header {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e8eef2;
}

.tab-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 18px;
  font-weight: 600;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.options-group:last-child {
  border-bottom: none;
}

.option-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.option-button:hover {
  background: #ffffff;
  border-color: var(--color-primary);
  box-shadow: 0 2px 6px rgba(35, 88, 123, 0.15);
  transform: translateX(2px);
}

.option-button.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  font-weight: 600;
}

.option-button.primary:hover {
  background: #1a4460;
  box-shadow: 0 4px 10px rgba(35, 88, 123, 0.3);
}

.option-button.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  box-shadow: 0 3px 10px rgba(35, 88, 123, 0.3);
}

.option-button.active:hover {
  background: #1a4460;
  box-shadow: 0 4px 12px rgba(35, 88, 123, 0.4);
}

.option-button.confirming {
  background: #FF9800 !important;
  color: white !important;
  border-color: #FF9800 !important;
  animation: pulse 0.8s ease-in-out infinite;
  box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.2);
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.2);
  }

  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 6px rgba(255, 152, 0, 0.3);
  }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.input-group input[type="number"] {
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.input-group input[type="text"] {
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.input-group input[type="number"]:focus,
.input-group input[type="text"]:focus {
  outline: none;
  border-color: var(--color-primary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
  transition: background 0.2s;
}

.checkbox-label:hover {
  background: #eef2f5;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* 标签设置列表 */
.tag-settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  padding: 12px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #e8eef2;
}

.tag-setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.tag-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}

.tag-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.tag-display-text-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.tag-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.tag-text-input {
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 13px;
  transition: border-color 0.3s;
  width: 100%;
}

.tag-text-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.tag-text-input::placeholder {
  color: #999;
}

/* 间距设置网格 */
.spacing-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.input-group.compact {
  gap: 4px;
}

.input-group.compact label {
  font-size: 12px;
}

.input-group.compact input[type="number"] {
  padding: 6px 8px;
  font-size: 13px;
}

/* 黑白/彩色切换 */
.color-mode-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.color-mode-label {
  font-size: 14px;
  color: #555;
  font-weight: 500;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
}

.radio-label input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* 日志区域样式 */
.log-area {
  border-top: 1px solid #e0e0e0;
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 200px;
  min-height: 200px;
  max-height: 200px;
}

/* 导出缩略图 */
.preview-label {
  font-size: 12px;
  color: #888;
  margin: 0 0 6px 0;
}

.export-thumbnail-wrap {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 10px;
  border: 1px solid #e8eef2;
  text-align: center;
}

.export-thumbnail {
  max-width: 100%;
  max-height: 180px;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.export-thumbnail:hover {
  opacity: 0.8;
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .log-area {
    height: 150px;
    min-height: 150px;
    max-height: 150px;
  }
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.log-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-primary);
}

.log-clear-btn {
  padding: 4px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.log-clear-btn:hover {
  background: #f5f5f5;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  border-left: 3px solid transparent;
  background: #f8f9fa;
}

.log-time {
  color: #999;
  font-family: monospace;
  flex-shrink: 0;
  font-size: 11px;
}

.log-message {
  color: #333;
  word-break: break-word;
}

.log-info {
  border-left-color: #4ECDC4;
}

.log-success {
  border-left-color: #52B788;
  background: #f0f9f4;
}

.log-warning {
  border-left-color: #F7DC6F;
  background: #fffbf0;
}

.log-error {
  border-left-color: #FF6B6B;
  background: #fff5f5;
}

.log-empty {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 13px;
}

/* ==================== tab-icon (desktop 隐藏) ==================== */
.tab-icon {
  display: none;
  font-size: 20px;
  line-height: 1;
}

/* ==================== 移动端遮罩 ==================== */
.mobile-overlay {
  display: none;
}

/* ==================== 移动端布局 ==================== */
@media (max-width: 768px) {
  /* 遮罩层 */
  .mobile-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 998;
    backdrop-filter: blur(2px);
  }

  /* Vue Transition 淡入淡出动画 */
  .overlay-fade-enter-active,
  .overlay-fade-leave-active {
    transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
  }

  .overlay-fade-enter-from,
  .overlay-fade-leave-to {
    opacity: 0;
    backdrop-filter: blur(0px);
  }

  /* 侧边栏整体：固定在底部 */
  .sidebar-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 999;
    flex-direction: column-reverse;
    box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.12);
    background: #fff;
    height: auto;
    max-height: 56px;
    overflow: hidden;
    transition: max-height 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
    will-change: max-height;
    contain: layout style;
  }

  .sidebar-panel.mobile-menu-open {
    max-height: 70vh;
  }

  /* sidebar-main flex 反转：tab 在下、内容在上 */
  .sidebar-main {
    display: flex;
    flex-direction: column-reverse;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* Tab 栏：底部固定行 */
  .tabs-bar {
    flex-direction: row;
    width: 100%;
    height: 56px;
    min-height: 56px;
    border-right: none;
    border-top: 1px solid #e0e7ec;
    background: #fff;
    padding: 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .tab-button {
    flex: 1;
    height: 56px;
    flex-direction: column;
    gap: 2px;
    border-bottom: none;
    border-right: none;
    padding: 6px 4px;
    font-size: 11px;
    color: #8a9caa;
    background: transparent;
    position: relative;
  }

  .tab-button::before {
    display: none;
  }

  .tab-button.active {
    color: var(--color-primary);
    background: rgba(35, 88, 123, 0.06);
    font-weight: 600;
  }

  .tab-button:hover {
    background: rgba(35, 88, 123, 0.04);
  }

  .tab-icon {
    display: block;
    font-size: 20px;
    line-height: 1;
  }

  .tab-label {
    font-size: 11px !important;
  }

  /* 内容面板：在 tab 上方展开。用 overflow-y: scroll 确保滚动条常驻，避免出现时压缩内容宽度（右位移） */
  .options-bar {
    width: 100%;
    flex: 1;
    overflow-y: scroll;
    scrollbar-gutter: stable;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid #e0e7ec;
  }

  .option-content {
    padding: 16px;
    min-height: 0;
    height: auto;
  }

  /* 日志区域在移动端隐藏（节省空间） */
  .log-area {
    display: none;
  }

  /* 选项按钮适配触摸 */
  .option-button {
    min-height: 44px;
    padding: 12px 14px;
    font-size: 14px;
    border-radius: 10px;
  }

  .option-button:hover {
    transform: none;
  }

  /* 输入组适配 */
  .input-group input[type="number"],
  .input-group input[type="text"] {
    min-height: 44px;
    padding: 10px 12px;
    font-size: 15px;
    border-radius: 8px;
  }

  .checkbox-label {
    min-height: 44px;
    padding: 10px 12px;
    font-size: 14px;
    border-radius: 8px;
  }

  /* tab-header 适配 */
  .tab-header {
    margin-bottom: 14px;
    padding-bottom: 10px;
  }

  .tab-header h3 {
    font-size: 16px;
  }

  .options-group {
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 14px;
  }

  /* 导出缩略图 */
  .export-thumbnail {
    max-height: 140px;
  }
}

/* ==================== 超小屏微调 ==================== */
@media (max-width: 380px) {
  .tab-button {
    height: 52px;
  }

  .tab-icon {
    font-size: 18px;
  }

  .tab-label {
    font-size: 10px !important;
  }

  .sidebar-panel {
    max-height: 52px;
  }

  .sidebar-panel.mobile-menu-open {
    max-height: 75vh;
  }

  .tabs-bar {
    height: 52px;
    min-height: 52px;
  }
}

/* ==================== 自动轮换示意图 ==================== */
.shift-diagram {
  background: #f0f4f8;
  border: 1px solid #d8e4ee;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  user-select: none;
}

/* 整体三栏布局：左侧方向 | 中间内容 | 右侧方向 */
.diagram-layout {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 左右列偏移按钮列 */
.diagram-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.diagram-dir-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
  border: 1.5px solid #b0c8dc;
  border-radius: 8px;
  background: #fff;
  color: #4a7a9b;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.2s;
  min-width: 36px;
  line-height: 1.2;
}

.diagram-dir-btn span {
  font-size: 10px;
  font-weight: 500;
  color: #7a9ab0;
}

.diagram-dir-btn:hover {
  background: #e8f0f7;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.diagram-dir-btn.active {
  background: var(--color-primary);
  color: #fff !important;
  border-color: #1a4460;
  box-shadow: 0 2px 6px rgba(35,88,123,0.35);
}

.diagram-dir-btn.active span {
  color: #ccdde8;
}

/* 中间：行方向按钮 + 格子 */
.diagram-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
}

/* 格子横排容器（左按钮 | 格子 | 右按钮） */
.diagram-grid-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 左/右列偏移按钮 */
.diagram-col-btn {
  padding: 4px 6px;
  border: 1.5px solid #b0c8dc;
  border-radius: 8px;
  background: #fff;
  color: #4a7a9b;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.diagram-col-btn:hover {
  background: #e8f0f7;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.diagram-col-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: #1a4460;
  box-shadow: 0 2px 6px rgba(35,88,123,0.3);
}

.diagram-row-btn {
  width: 100%;
  padding: 4px 8px;
  border: 1.5px solid #b0c8dc;
  border-radius: 8px;
  background: #fff;
  color: #4a7a9b;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.2s;
  text-align: center;
}

.diagram-row-btn:hover {
  background: #e8f0f7;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.diagram-row-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: #1a4460;
  box-shadow: 0 2px 6px rgba(35,88,123,0.3);
}

/* 9×9 格子容器 */
.diagram-grid-9 {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.diagram-row-9 {
  display: flex;
  gap: 2px;
}

.diagram-cell-sm {
  width: 18px;
  height: 18px;
  background: #dbe8f2;
  border: 1px solid #b8d0e4;
  border-radius: 3px;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  box-sizing: border-box;
}

.diagram-cell-sm:hover {
  background: #c2d8ed;
  border-color: var(--color-primary);
  transform: scale(1.15);
}

/* 当前位置（红色） */
.diagram-cell-sm.cell-current {
  background: #ef4444;
  border-color: #b91c1c;
  border-radius: 50%;
  transform: scale(1.1);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
}

/* 目标位置（绿色） */
.diagram-cell-sm.cell-target {
  background: #22c55e;
  border-color: #15803d;
  border-radius: 50%;
  transform: scale(1.1);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
  animation: target-pulse 1.4s ease-in-out infinite;
}

@keyframes target-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25); }
  50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12); }
}

/* 路径格子（同列无溢出时，起点到终点之间的格子） */
.diagram-cell-sm.cell-path {
  background: #a5d8ee;
  border-color: #38bdf8;
  opacity: 0.75;
}

/* 底部状态说明栏 */
.diagram-status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #5a7a8f;
  flex-wrap: wrap;
  padding: 2px 0;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-red {
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(239,68,68,0.2);
}

.dot-green {
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
}

.diagram-status-hint {
  color: #8aabb8;
  font-style: italic;
}

/* 并排输入框 */
.shift-inputs-row {
  display: flex;
  gap: 10px;
}

.input-group-compact {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group-compact label {
  font-size: 11px;
  font-weight: 600;
  color: #5a7a8f;
}

.input-group-compact input {
  width: 100%;
  padding: 6px 8px;
  border: 1.5px solid #cdd8e0;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-primary);
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.input-group-compact input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* ==================== 自动轮换 Tab 切换 ==================== */
.tab-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shift-mode-tabs {
  display: flex;
  gap: 2px;
  background: #e8eef2;
  border-radius: 8px;
  padding: 2px;
}

.shift-mode-tab {
  padding: 3px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #5a7a8f;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.shift-mode-tab.active {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 2px 4px rgba(35,88,123,0.2);
}

/* ==================== 选区轮换面板 ==================== */
.zone-rot-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.zone-rot-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.zone-rot-add-btn {
  padding: 4px 10px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.zone-rot-add-btn:hover {
  background: #1a4460;
  transform: translateY(-1px);
}

.zone-rot-empty {
  font-size: 12px;
  color: #aaa;
  text-align: center;
  padding: 10px 0;
}

.zone-rot-item {
  display: flex;
  flex-direction: column;
  padding: 7px 10px;
  border: 1.5px solid #e0e8ee;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.2s;
  background: #fff;
}

.zone-rot-item:hover {
  border-color: var(--color-primary);
  background: #f0f6fa;
}

.zone-rot-item.selected {
  border-color: var(--color-primary);
  background: rgba(35, 88, 123, 0.08);
  box-shadow: 0 0 0 2px rgba(35,88,123,0.15);
}

.zone-rot-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zone-rot-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.zone-rot-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-rot-count {
  font-size: 11px;
  color: #7a9ab0;
}

.zone-rot-del {
  background: none;
  border: none;
  color: #bbb;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.15s;
  flex-shrink: 0;
}

.zone-rot-del:hover { color: #e53e3e; }

/* 轮换组 */
.zone-rot-group {
  border: 1.5px solid #e0e8ee;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #fafcfe;
  overflow: hidden;
}

.zone-rot-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #f0f4f8;
  border-bottom: 1px solid #e0e8ee;
}

.zone-rot-type-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  flex-shrink: 0;
}

.zone-rot-type-badge.cycle {
  background: rgba(35,88,123,0.15);
  color: var(--color-primary);
}

.zone-rot-type-badge.swap {
  background: rgba(249,115,22,0.15);
  color: #c2410c;
}

.zone-rot-group-zones {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zone-rot-group-zone-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #555;
}

.zone-rot-zone-label {
  flex: 1;
}

.zone-rot-arrow {
  font-size: 13px;
  color: #7a9ab0;
  flex-shrink: 0;
}

.zone-rot-add-to-group {
  margin-top: 4px;
}

.zone-rot-select {
  width: 100%;
  padding: 5px 8px;
  border: 1.5px dashed #b0c8dc;
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-primary);
  background: #fff;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.zone-rot-select:focus {
  border-color: var(--color-primary);
}

.zone-rot-group-error {
  font-size: 11px;
  color: #e53e3e;
  padding: 3px 0;
}

/* 组内"添加选区"按钮 */
.zone-rot-add-zone-btn {
  width: 100%;
  margin-top: 6px;
  padding: 5px;
  border: 1.5px dashed #b0c8dc;
  border-radius: 6px;
  background: transparent;
  color: #4a7a9b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.zone-rot-add-zone-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: #f0f6fa;
}

/* 正在编辑（选座）的选区行高亮 */
.zone-rot-group-zone-row.editing {
  background: rgba(35,88,123,0.1);
  border-radius: 6px;
  outline: 2px solid rgba(35,88,123,0.3);
}

/* 编辑状态提示条 */
.zone-rot-editing-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  background: rgba(35,88,123,0.1);
  border: 1px solid rgba(35,88,123,0.25);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-primary);
  margin-bottom: 8px;
}

.zone-rot-hint-close {
  padding: 2px 8px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.zone-rot-hint-close:hover { background: #1a4460; }

/* 组 或 选区重命名 inline input */
.zone-rot-name-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  outline: none;
  padding: 0 2px;
  cursor: text;
  min-width: 0;
}
.zone-rot-name-input:focus {
  background: #fff;
  border-bottom: 1.5px solid var(--color-primary);
}

.zone-rot-zone-name-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #444;
  outline: none;
  padding: 0 2px;
  cursor: text;
  min-width: 0;
}
.zone-rot-zone-name-input:focus {
  background: #fff;
  border-bottom: 1px solid var(--color-primary);
}

/* 颜色点：可交互（切换编辑） */
.zone-rot-dot-btn {
  cursor: pointer;
  transition: transform 0.15s, filter 0.15s;
  flex-shrink: 0;
}
.zone-rot-dot-btn:hover {
  transform: scale(1.3);
  filter: brightness(0.85);
}

/* ==================== 智能排位快捷区 ==================== */
.assign-rule-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.rule-shortcut-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.rule-shortcut-btn:hover {
  border-color: #23587b;
  background: #eff6ff;
  color: #23587b;
}

.rule-shortcut-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.rule-shortcut-text {
  flex: 1;
  text-align: center;
}

.rule-badge {
  background: #23587b;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 9px;
  min-width: 16px;
  text-align: center;
  flex-shrink: 0;
}

/* ==================== 进度条 ==================== */
.assign-progress-wrap {
  position: relative;
  height: 24px;
  background: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  margin: 4px 0;
}

.assign-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #23587b, #3b82f6);
  border-radius: 12px;
  transition: width 0.3s ease;
}

.assign-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

/* ==================== 上次满足度 ==================== */
.last-sat-rate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  border: 1.5px solid transparent;
}

.last-sat-rate.sat-a {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.last-sat-rate.sat-b {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.last-sat-rate.sat-c {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.sat-icon { font-size: 14px; flex-shrink: 0; }

.last-sat-rate strong { font-weight: 700; }

.sat-detail-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.sat-detail-btn:hover { opacity: 1; }

</style>
