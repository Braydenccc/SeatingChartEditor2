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
const CURRENT_VERSION = '2.1'

export function useWorkspace() {
  const { students, addStudent, updateStudent, clearAllStudents } = useStudentData()
  const { tags, addTag, clearAllTags, showTagsInSeatChart, tagDisplayMode, setShowTagsInSeatChart, setTagDisplayMode } = useTagData()
  const { seatConfig, seats, updateConfig, clearAllSeats, batchUpdateSeats } = useSeatChart()
  const { exportSettings } = useExportSettings()
  const { zones, clearAllZones, addZone, updateZone } = useZoneData()
  const { rules, clearAllRules, addRule } = useSeatRules()
  const { success, warning, error } = useLogger()

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
          color: t.color,
          showInSeatChart: t.showInSeatChart
        })),
        tagSettings: {
          showTagsInSeatChart: showTagsInSeatChart.value,
          tagDisplayMode: tagDisplayMode.value
        },
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
          subjects: [...(r.subjects || [])],
          // 兼容导出旧字段
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
          addTag({ 
            name: tag.name, 
            color: tag.color, 
            showInSeatChart: tag.showInSeatChart !== false 
          })
          const added = tags.value.find(t => t.name === tag.name && t.color === tag.color)
          if (added) oldTagIdToNewId[tag.id] = added.id
        })

        // 恢复标签显示设置
        if (workspace.tagSettings) {
          if (workspace.tagSettings.showTagsInSeatChart !== undefined) {
            setShowTagsInSeatChart(workspace.tagSettings.showTagsInSeatChart)
          }
          if (workspace.tagSettings.tagDisplayMode) {
            setTagDisplayMode(workspace.tagSettings.tagDisplayMode)
          }
        }

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
          const updates = workspace.layout.seats.map(sw => {
            const match = seats.value.find(st =>
              st.groupIndex === sw.group && st.columnIndex === sw.col && st.rowIndex === sw.row
            )
            if (!match) return null
            return {
              seatId: match.id,
              isEmpty: !!sw.empty,
              studentId: sw.studentId != null ? (oldStudentIdToNewId[sw.studentId] || null) : null
            }
          }).filter(Boolean)

          if (updates.length > 0) {
            batchUpdateSeats(updates, false)  // recordUndo=false，历史数据恢复不记录
          }
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
          if (Array.isArray(rule.subjects)) {
            return { subjects: (rule.subjects || []).map(item => ({ ...item })) }
          }
          if (rule.subjectMode === 'single' || rule.subjectMode === 'dual') {
            const subjectsA = (rule.subjectsA || []).map(item => ({ ...item }))
            const subjectsB = (rule.subjectsB || []).map(item => ({ ...item }))
            return {
              subjects: [...subjectsA, ...subjectsB]
            }
          }
          const subject = rule.subject || {}
          if (subject.kind === 'student') {
            return { subjects: [{ type: 'person', id: subject.id }] }
          }
          if (subject.kind === 'tag') {
            return { subjects: [{ type: 'tag', id: subject.tagId }] }
          }
          if (subject.kind === 'pair') {
            return { subjects: [{ type: 'person', id: subject.id1 }, { type: 'person', id: subject.id2 }] }
          }
          if (subject.kind === 'tag_pair') {
            return { subjects: [{ type: 'tag', id: subject.tagId1 }, { type: 'tag', id: subject.tagId2 }] }
          }
          return { subjects: [] }
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
          let totalDroppedSubjects = 0
          let totalDroppedRules = 0

          workspace.rules.forEach(r => {
            const normalized = normalizeRule(r)

            const remappedSubjects = normalized.subjects.map(entry => remapEntry(entry, oldStudentIdToNewId, oldTagIdToNewId))
            const subjects = remappedSubjects.filter(e => !!e?.id)
            const dropped = remappedSubjects.length - subjects.length
            if (dropped > 0) {
              totalDroppedSubjects += dropped
              warning('Workspace rule subject remap dropped entries', {
                rule: r,
                dropped
              })
            }

            const newParams = { ...r.params }
            if (newParams.tagId) newParams.tagId = oldTagIdToNewId[newParams.tagId]
            if (newParams.zoneId) newParams.zoneId = oldZoneIdToNewId[newParams.zoneId]

            const hasValidSubjects = subjects.length > 0
            if (hasValidSubjects) {
              const result = addRule({
                enabled: r.enabled ?? true,
                priority: r.priority,
                subjects,
                predicate: r.predicate,
                params: newParams,
                description: r.description || ''
              })
              if (!result?.success) {
                totalDroppedRules += 1
                warning('Workspace rule skipped due to validation failure', {
                  rule: r,
                  warnings: result?.warnings || []
                })
              }
            } else {
              totalDroppedRules += 1
            }
          })

          if (totalDroppedSubjects > 0 || totalDroppedRules > 0) {
            warning(
              `工作区规则迁移时丢失了 ${totalDroppedSubjects} 个对象条目，跳过了 ${totalDroppedRules} 条无效规则，请检查规则配置。`
            )
          }
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

    // v2.0 → v2.2：添加 groups 数组支持每大组独立配置
    if (version.startsWith('2.') && ws.layout?.config && !ws.layout.config.groups) {
      const config = ws.layout.config
      const groupCount = config.groupCount || 4
      config.groups = []
      for (let i = 0; i < groupCount; i++) {
        config.groups.push({
          columns: config.columnsPerGroup || 2,
          rows: config.seatsPerColumn || 7
        })
      }
    }

    // v2.x → v2.3：将单一的 alignment 配置拆分为 podiumPosition 和 seatAlignment
    if (ws.layout?.config?.alignment && !ws.layout.config.podiumPosition) {
      ws.layout.config.podiumPosition = ws.layout.config.alignment
      ws.layout.config.seatAlignment = ws.layout.config.alignment
      delete ws.layout.config.alignment
    }

    // 确保默认值
    if (ws.layout?.config) {
      if (!ws.layout.config.podiumPosition) ws.layout.config.podiumPosition = 'bottom'
      if (!ws.layout.config.seatAlignment) ws.layout.config.seatAlignment = 'bottom'
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
