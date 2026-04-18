import { ref } from 'vue'
import { useSeatChart } from './useSeatChart'

/**
 * 选区轮换（重构 v2）
 * - 选区嵌入组内，无全局列表
 * - editingZoneId：当前正在编辑（选座）的选区 ID
 * - 高亮仅在编辑任意选区时显示，且显示所有区
 * - applyZoneRotation 按座位坐标排序，消除点击顺序影响
 */

const rotGroups = ref([])
let nextGroupId = 1
let nextZoneId = 1   // 全局递增，避免选区名重复

const editingZoneId = ref(null)

// ——— 调色板 ———
const PALETTE = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#14B8A6'
]

// ——— 座位坐标解析与排序 ———
const parseSeatPos = (seatId) => {
  const p = seatId.split('-').map(Number)
  return { g: p[1], c: p[2], r: p[3] }
}

/** 按座位在表中的物理位置（组→列→行）排序 */
const sortedBySeatPos = (seatIds) =>
  [...seatIds].sort((a, b) => {
    const pa = parseSeatPos(a), pb = parseSeatPos(b)
    return pa.g - pb.g || pa.c - pb.c || pa.r - pb.r
  })

// ——— 颜色辅助 ———
/** 获取某个 zone 的颜色（按跨组全局索引） */
const getZoneColor = (groupId, zoneId) => {
  let idx = 0
  for (const g of rotGroups.value) {
    for (const z of g.zones) {
      if (g.id === groupId && z.id === zoneId) return PALETTE[idx % PALETTE.length]
      idx++
    }
  }
  return '#ccc'
}

/** 获取所有 zone 的颜色 Map：zoneId → color */
const buildZoneColorMap = () => {
  const map = new Map()
  let idx = 0
  for (const g of rotGroups.value) {
    for (const z of g.zones) {
      map.set(z.id, PALETTE[idx++ % PALETTE.length])
    }
  }
  return map
}

export function useZoneRotation() {
  const { batchUpdateSeats } = useSeatChart()

  // ==================== 轮换组 ====================

  const addRotGroup = (type = 'cycle') => {
    const group = {
      id: nextGroupId++,
      name: `轮换组 ${nextGroupId - 1}`,
      type,
      zones: []
    }
    rotGroups.value.push(group)
    return group
  }

  const deleteRotGroup = (groupId) => {
    const g = rotGroups.value.find(x => x.id === groupId)
    if (g?.zones.some(z => z.id === editingZoneId.value)) editingZoneId.value = null
    rotGroups.value = rotGroups.value.filter(x => x.id !== groupId)
  }

  const updateRotGroup = (groupId, updates) => {
    const g = rotGroups.value.find(x => x.id === groupId)
    if (g) Object.assign(g, updates)
  }

  // ==================== 组内选区 ====================

  const addZoneToGroup = (groupId) => {
    const group = rotGroups.value.find(g => g.id === groupId)
    if (!group) return null
    const id = nextZoneId++
    // 同组内避免重名：用全局 id 作名称尾缀
    const zone = { id, name: `选区 ${id}`, seatIds: [] }
    group.zones.push(zone)
    editingZoneId.value = id
    return zone
  }

  const deleteZoneFromGroup = (groupId, zoneId) => {
    const g = rotGroups.value.find(x => x.id === groupId)
    if (g) g.zones = g.zones.filter(z => z.id !== zoneId)
    if (editingZoneId.value === zoneId) editingZoneId.value = null
  }

  const selectEditingZone = (zoneId) => {
    editingZoneId.value = editingZoneId.value === zoneId ? null : zoneId
  }

  const clearEditingZone = () => { editingZoneId.value = null }

  const toggleSeatInEditingZone = (seatId) => {
    if (!editingZoneId.value) return
    for (const g of rotGroups.value) {
      const z = g.zones.find(z => z.id === editingZoneId.value)
      if (!z) continue
      const idx = z.seatIds.indexOf(seatId)
      if (idx >= 0) z.seatIds.splice(idx, 1)
      else z.seatIds.push(seatId)
      return
    }
  }

  // ==================== 高亮 ====================

  /**
   * 返回 seatId → color 的 Map。
   * - 不在编辑任何选区时：返回空 Map（隐藏所有图案）
   * - 编辑任意选区时：显示所有组内所有选区
   */
  const getRotZoneHighlights = () => {
    const map = new Map()
    if (!editingZoneId.value) return map   // 非编辑状态不显示
    const colorMap = buildZoneColorMap()
    for (const g of rotGroups.value) {
      for (const z of g.zones) {
        const color = colorMap.get(z.id) ?? '#ccc'
        z.seatIds.forEach(sid => map.set(sid, color))
      }
    }
    return map
  }

  // ==================== 校验 ====================

  const validateGroup = (group) => {
    if (group.type === 'swap') {
      if (group.zones.length !== 2) return { valid: false, error: '互换模式需要恰好 2 个选区' }
    } else {
      if (group.zones.length < 2) return { valid: false, error: '循环模式至少需要 2 个选区' }
    }
    const sizes = group.zones.map(z => z.seatIds.length)
    if (sizes.some(s => s !== sizes[0])) {
      return { valid: false, error: `选区大小不一致（${sizes.join(' / ')} 座）` }
    }
    if (sizes[0] === 0) return { valid: false, error: '选区中没有座位' }
    return { valid: true, error: '' }
  }

  // ==================== 执行 ====================

  const applyZoneRotation = (seatMap) => {
    const errors = []
    let moved = 0
    const updates = []

    for (const group of rotGroups.value) {
      const { valid, error } = validateGroup(group)
      if (!valid) { errors.push(`[${group.name}] ${error}`); continue }

      if (group.type === 'swap') {
        // 互换：先按位置排序再配对，消除点击顺序影响
        const zA = group.zones[0], zB = group.zones[1]
        const idsA = sortedBySeatPos(zA.seatIds)
        const idsB = sortedBySeatPos(zB.seatIds)
        const snapA = idsA.map(sid => seatMap.get(sid)?.studentId ?? null)
        const snapB = idsB.map(sid => seatMap.get(sid)?.studentId ?? null)
        idsA.forEach((sid, i) => {
          const seat = seatMap.get(sid)
          if (seat && !seat.isEmpty) {
            if (seat.studentId !== snapB[i]) {
              updates.push({ seatId: sid, studentId: snapB[i] })
              moved++
            }
          }
        })
        idsB.forEach((sid, i) => {
          const seat = seatMap.get(sid)
          if (seat && !seat.isEmpty) {
            if (seat.studentId !== snapA[i]) {
              updates.push({ seatId: sid, studentId: snapA[i] })
              moved++
            }
          }
        })
      } else {
        // 循环：zone[i] 的学生来自 zone[i-1]，按位置排序配对
        const zoneSortedIds = group.zones.map(z => sortedBySeatPos(z.seatIds))
        const snaps = zoneSortedIds.map(ids =>
          ids.map(sid => seatMap.get(sid)?.studentId ?? null)
        )
        zoneSortedIds.forEach((ids, idx) => {
          const src = snaps[(idx - 1 + group.zones.length) % group.zones.length]
          ids.forEach((sid, i) => {
            const seat = seatMap.get(sid)
            if (seat && !seat.isEmpty) {
              if (seat.studentId !== src[i]) {
                updates.push({ seatId: sid, studentId: src[i] })
                moved++
              }
            }
          })
        })
      }
    }

    // 使用统一接口批量更新座位，recordUndo=false 因为外层已使用 recordBatch
    if (updates.length > 0) {
      batchUpdateSeats(updates, false)
    }

    return { moved, errors }
  }

  const cleanupInvalidRotSeats = (validSeatIds) => {
    const validSet = new Set(validSeatIds)
    for (const g of rotGroups.value) {
      for (const z of g.zones) {
        z.seatIds = z.seatIds.filter(sid => validSet.has(sid))
      }
    }
  }

  const clearAllRotData = () => {
    rotGroups.value = []
    editingZoneId.value = null
    nextGroupId = 1
    nextZoneId = 1
  }

  return {
    rotGroups,
    editingZoneId,
    addRotGroup,
    deleteRotGroup,
    updateRotGroup,
    addZoneToGroup,
    deleteZoneFromGroup,
    selectEditingZone,
    clearEditingZone,
    toggleSeatInEditingZone,
    getRotZoneHighlights,
    getZoneColor,
    buildZoneColorMap,
    validateGroup,
    applyZoneRotation,
    cleanupInvalidRotSeats,
    clearAllRotData,
    parseSeatPos,
    PALETTE,
  }
}
