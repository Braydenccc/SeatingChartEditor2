import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useSeatChart } from './useSeatChart'
import { useExportSettings } from './useExportSettings'
import { useZoneData } from './useZoneData'
import { useSeatRules } from './useSeatRules'
import { useLogger } from './useLogger'
import { setCookie, getCookie } from './useAuth'

const LAST_WORKSPACE_COOKIE = 'sce_last_workspace'

const FILE_EXT = '.sce'
const CURRENT_VERSION = '2.0'

export function useWorkspace() {
  const { students, addStudent, updateStudent, clearAllStudents } = useStudentData()
  const { tags, addTag, clearAllTags } = useTagData()
  const { seatConfig, seats, updateConfig, clearAllSeats } = useSeatChart()
  const { exportSettings } = useExportSettings()
  const { zones, clearAllZones, addZone, updateZone } = useZoneData()
  const { rules, clearAllRules, addRule } = useSeatRules()
  const { success, error } = useLogger()

  // 生成工作区 JSON 数据 (用于云端或本地保存)
  const getWorkspaceJson = () => {
    try {
      const workspace = {
        meta: {
          version: CURRENT_VERSION,
          app: 'SeatingChartEditor',
          createdAt: new Date().toISOString()
        },
        students: students.value.map(s => ({
          id: s.id,
          name: s.name,
          studentNumber: s.studentNumber,
          tags: s.tags
        })),
        tags: tags.value.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color
        })),
        layout: {
          config: { ...seatConfig.value },
          seats: seats.value.map(s => ({
            id: s.id,
            group: s.groupIndex,
            col: s.columnIndex,
            row: s.rowIndex,
            studentId: s.studentId,
            empty: s.isEmpty || false
          }))
        },
        zones: zones.value.map(z => ({
          id: z.id,
          name: z.name,
          tagIds: [...z.tagIds],
          seatIds: [...z.seatIds],
          visible: z.visible
        })),
        exportSettings: { ...exportSettings.value },
        rules: (rules.value || []).map(r => ({
          enabled: r.enabled,
          priority: r.priority,
          subjectMode: r.subjectMode,
          subjectsA: [...(r.subjectsA || [])],
          subjectsB: [...(r.subjectsB || [])],
          subject: r.subject ? { ...r.subject } : undefined,
          predicate: r.predicate,
          params: { ...r.params },
          description: r.description
        }))
      }
      return JSON.stringify(workspace, null, 2)
    } catch (e) {
      console.error(e)
      return null
    }
  }

  // 保存工作区 (本地下载)
  const saveWorkspace = () => {
    try {
      const json = getWorkspaceJson()
      if (!json) return false

      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      link.download = `座位表_${timestamp}${FILE_EXT}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return true
    } catch (error) {
      return false
    }
  }

  // 加载工作区
  const loadWorkspace = (file) => {
    return new Promise((resolve, reject) => {
      // 支持 .sce 和旧格式 .bydsce.json
      const name = file.name.toLowerCase()
      if (!name.endsWith(FILE_EXT) && !name.endsWith('.bydsce.json')) {
        reject(new Error(`请选择 ${FILE_EXT} 格式的工作区文件`))
        return
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const workspace = JSON.parse(e.target.result)

          // 验证基本结构
          if (!workspace.students || !workspace.tags) {
            reject(new Error('工作区文件格式不正确'))
            return
          }

          // 版本迁移
          const migrated = migrateWorkspace(workspace)

          resolve(migrated)
        } catch (error) {
          reject(new Error(`解析工作区文件失败: ${error.message}`))
        }
      }

      reader.onerror = () => {
        reject(new Error('读取文件失败'))
      }

      reader.readAsText(file)
    })
  }

  // 应用工作区数据 (云端或本地解析后共享的逻辑)
  const applyWorkspaceData = async (workspaceRaw) => {
    return new Promise((resolve) => {
      try {
        // 验证基本结构
        if (!workspaceRaw.students || !workspaceRaw.tags) {
          error('工作区文件内容不完整或格式不正确')
          resolve(false)
          return
        }

        // 版本迁移
        const workspace = migrateWorkspace(workspaceRaw)

        // 下发具体的写入将在外部处理 (现有的加载逻辑是在 SidebarPanel 里实现并注入组件的)
        // 这里我们进行集中恢复。

        // 清空现有数据
        clearAllStudents()
        clearAllTags()

        // 恢复标签并记录旧ID->新ID映射
        const oldTagIdToNewId = {}
        workspace.tags.forEach(tag => {
          addTag({ name: tag.name, color: tag.color })
          const added = tags.value.find(t => t.name === tag.name && t.color === tag.color)
          if (added) oldTagIdToNewId[tag.id] = added.id
        })

        // 恢复学生并记录旧ID->新ID映射
        const oldStudentIdToNewId = {}
        workspace.students.forEach(s => {
          const newId = addStudent()
          const mappedTags = (s.tags || []).map(tid => oldTagIdToNewId[tid]).filter(x => x != null)
          updateStudent(newId, {
            name: s.name,
            studentNumber: s.studentNumber,
            tags: mappedTags
          })
          oldStudentIdToNewId[s.id] = newId
        })

        // 恢复座位配置
        if (workspace.layout && workspace.layout.config) {
          updateConfig(workspace.layout.config)
        }

        // 清空所有分配
        clearAllSeats()

        if (workspace.layout && Array.isArray(workspace.layout.seats)) {
          workspace.layout.seats.forEach(sw => {
            const match = seats.value.find(st =>
              st.groupIndex === sw.group && st.columnIndex === sw.col && st.rowIndex === sw.row
            )
            if (match) {
              match.isEmpty = !!sw.empty
              match.studentId = sw.studentId != null ? (oldStudentIdToNewId[sw.studentId] || null) : null
            }
          })
        }

        // 恢复导出设置
        if (workspace.exportSettings) {
          Object.keys(workspace.exportSettings).forEach(k => {
            exportSettings.value[k] = workspace.exportSettings[k]
          })
        }

        // 注意：旧版的 relations (人际关系) 已被废弃，我们不再从存档中恢复它们。
        // 如有需要，用户应使用最新的 SeatRules (座位规则) 机制进行配置。

        // 恢复选区数据
        const oldZoneIdToNewId = {}
        if (workspace.zones && Array.isArray(workspace.zones)) {
          clearAllZones()

          workspace.zones.forEach(z => {
            const newZone = addZone()
            const mappedTagIds = (z.tagIds || [])
              .map(tid => oldTagIdToNewId[tid])
              .filter(id => id !== undefined)
            updateZone(newZone.id, {
              name: z.name,
              tagIds: mappedTagIds,
              seatIds: [...z.seatIds],
              visible: z.visible !== undefined ? z.visible : false
            })
            oldZoneIdToNewId[z.id] = newZone.id
          })
        }

        const normalizeRule = (rule) => {
          if (rule.subjectMode === 'single' || rule.subjectMode === 'dual') {
            return {
              subjectMode: rule.subjectMode,
              subjectsA: (rule.subjectsA || []).map(item => ({ ...item })),
              subjectsB: (rule.subjectsB || []).map(item => ({ ...item }))
            }
          }
          const subject = rule.subject || {}
          if (subject.kind === 'student') {
            return { subjectMode: 'single', subjectsA: [{ type: 'person', id: subject.id }], subjectsB: [] }
          }
          if (subject.kind === 'tag') {
            return { subjectMode: 'single', subjectsA: [{ type: 'tag', id: subject.tagId }], subjectsB: [] }
          }
          if (subject.kind === 'pair') {
            return {
              subjectMode: 'dual',
              subjectsA: [{ type: 'person', id: subject.id1 }],
              subjectsB: [{ type: 'person', id: subject.id2 }]
            }
          }
          if (subject.kind === 'tag_pair') {
            return {
              subjectMode: 'dual',
              subjectsA: [{ type: 'tag', id: subject.tagId1 }],
              subjectsB: [{ type: 'tag', id: subject.tagId2 }]
            }
          }
          return { subjectMode: 'single', subjectsA: [], subjectsB: [] }
        }

        const remapEntry = (entry, oldStudentIdToNewIdMap, oldTagIdToNewIdMap) => {
          if (!entry) return null
          if (entry.type === 'person') {
            return { ...entry, id: oldStudentIdToNewIdMap[entry.id] }
          }
          if (entry.type === 'tag') {
            return { ...entry, id: oldTagIdToNewIdMap[entry.id] }
          }
          return entry
        }

        // 恢复智能排位规则
        if (workspace.rules && Array.isArray(workspace.rules)) {
          clearAllRules()

          workspace.rules.forEach(r => {
            const normalized = normalizeRule(r)

            const remappedA = normalized.subjectsA.map(entry => remapEntry(entry, oldStudentIdToNewId, oldTagIdToNewId))
            const remappedB = normalized.subjectsB.map(entry => remapEntry(entry, oldStudentIdToNewId, oldTagIdToNewId))
            const subjectsA = remappedA.filter(e => !!e?.id)
            const subjectsB = remappedB.filter(e => !!e?.id)
            const droppedA = remappedA.length - subjectsA.length
            const droppedB = remappedB.length - subjectsB.length
            if (droppedA > 0 || droppedB > 0) {
              console.warn('Workspace rule subject remap dropped entries', {
                rule: r,
                droppedA,
                droppedB
              })
            }

            const newParams = { ...r.params }
            if (newParams.tagId) newParams.tagId = oldTagIdToNewId[newParams.tagId]
            if (newParams.zoneId) newParams.zoneId = oldZoneIdToNewId[newParams.zoneId]

            const hasValidSubjects = subjectsA.length > 0 && (normalized.subjectMode !== 'dual' || subjectsB.length > 0)
            if (hasValidSubjects) {
              addRule({
                enabled: r.enabled ?? true,
                priority: r.priority,
                subjectMode: normalized.subjectMode,
                subjectsA,
                subjectsB,
                predicate: r.predicate,
                params: newParams,
                description: r.description || ''
              })
            }
          })
        }

        resolve(true)
      } catch (err) {
        console.error('Apply Workspace Data failed:', err)
        error('恢复工作区时发生错误: ' + (err.message || err))
        resolve(false)
      }
    })
  }

  // 版本迁移
  function migrateWorkspace(ws) {
    const version = ws.meta?.version || ws.version || '1.0'

    // v1.0 → v1.1：bindings → relations (忽略)
    if (version === '1.0') {
      if (ws.bindings && Array.isArray(ws.bindings)) {
        delete ws.bindings
      }
    }

    // v1.x → v2.0：扁平结构 → 分组结构
    if (version.startsWith('1.')) {
      // 迁移 seats 到 layout.seats（字段重命名）
      const oldSeats = ws.seats || []
      ws.layout = {
        config: ws.seatConfig || {},
        seats: oldSeats.map(s => ({
          id: s.id,
          group: s.groupIndex,
          col: s.columnIndex,
          row: s.rowIndex,
          studentId: s.studentId,
          empty: s.isEmpty || false
        }))
      }
      delete ws.seatConfig
      delete ws.seats

      // 丢弃旧的 relations
      if (ws.relations) {
        delete ws.relations
      }

      // 添加 meta
      ws.meta = {
        version: CURRENT_VERSION,
        app: 'SeatingChartEditor',
        createdAt: ws.timestamp || new Date().toISOString()
      }
      delete ws.version
      delete ws.timestamp
    }

    // 确保默认值
    ws.zones = ws.zones || []
    ws.exportSettings = ws.exportSettings || {}

    return ws
  }

  const saveLastWorkspace = (info) => {
    try {
      if (!info) return
      setCookie(LAST_WORKSPACE_COOKIE, JSON.stringify(info), 30) // 30 days
    } catch (e) {
      console.error('Save last workspace failed:', e)
    }
  }

  const getLastWorkspace = () => {
    try {
      const saved = getCookie(LAST_WORKSPACE_COOKIE)
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  }

  return {
    saveLastWorkspace,
    getLastWorkspace,
    saveWorkspace,
    loadWorkspace,
    getWorkspaceJson,
    applyWorkspaceData
  }
}
