import { ref } from 'vue'
import { useSeatChart } from './useSeatChart'
import { isGuardSeatId, parseSeatId } from '@/utils/seatHelpers'
import type { RotationGroup, RotationZone, Seat } from '@/types/models'

/**
 * 选区轮换（重构 v2）
 * - 选区嵌入组内，无全局列表
 * - editingZoneId：当前正在编辑（选座）的选区 ID
 * - 高亮仅在编辑任意选区时显示，且显示所有区
 * - applyZoneRotation 按座位坐标排序，消除点击顺序影响
 */

const rotGroups = ref<RotationGroup[]>([])
let nextGroupId = 1
let nextZoneId = 1   // 全局递增，避免选区名重复

const editingZoneId = ref<number | null>(null)

const cloneRotationGroups = (groups: RotationGroup[]): RotationGroup[] => groups.map(group => ({
  id: group.id,
  name: group.name,
  type: group.type,
  zones: group.zones.map(zone => ({
    id: zone.id,
    name: zone.name,
    seatIds: [...zone.seatIds]
  }))
}))

const validateRotationDataShape = (groups: unknown) => {
  if (!Array.isArray(groups)) {
    return { valid: false, error: '轮换数据必须是数组' }
  }

  const groupIds = new Set<number>()
  const zoneIds = new Set<number>()

  for (const group of groups) {
    if (!group || typeof group !== 'object') {
      return { valid: false, error: '轮换组数据格式无效' }
    }
    const candidateGroup = group as Partial<RotationGroup>
    if (!Number.isInteger(candidateGroup.id) || (candidateGroup.id ?? 0) <= 0 || groupIds.has(candidateGroup.id as number)) {
      return { valid: false, error: '轮换组 ID 必须是唯一正整数' }
    }
    if (typeof candidateGroup.name !== 'string' || (candidateGroup.type !== 'cycle' && candidateGroup.type !== 'swap') || !Array.isArray(candidateGroup.zones)) {
      return { valid: false, error: `轮换组 ${candidateGroup.id} 的数据格式无效` }
    }
    groupIds.add(candidateGroup.id as number)

    for (const zone of candidateGroup.zones) {
      if (!zone || typeof zone !== 'object') {
        return { valid: false, error: '轮换选区数据格式无效' }
      }
      const candidateZone = zone as Partial<RotationZone>
      if (!Number.isInteger(candidateZone.id) || (candidateZone.id ?? 0) <= 0 || zoneIds.has(candidateZone.id as number)) {
        return { valid: false, error: '轮换选区 ID 必须是全局唯一正整数' }
      }
      if (typeof candidateZone.name !== 'string' || !Array.isArray(candidateZone.seatIds) || candidateZone.seatIds.some(seatId => typeof seatId !== 'string')) {
        return { valid: false, error: `轮换选区 ${candidateZone.id} 的数据格式无效` }
      }
      zoneIds.add(candidateZone.id as number)
    }
  }

  return { valid: true, error: '' }
}

// ——— 调色板 ———
const PALETTE = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#14B8A6'
]

/** 按座位在表中的物理位置（组→列→行）排序 */
const sortedBySeatPos = (seatIds: string[]) => {
  const parsed = seatIds.map(id => ({ id, pos: parseSeatId(id) }))
  parsed.sort((a, b) => {
    const pa = a.pos, pb = b.pos
    return pa.groupIndex - pb.groupIndex || pa.columnIndex - pb.columnIndex || pa.rowIndex - pb.rowIndex
  })
  return parsed.map(item => item.id)
}

// ——— 颜色辅助 ———
/** 获取某个 zone 的颜色（按跨组全局索引） */
const getZoneColor = (groupId: number, zoneId: number) => {
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
  const map = new Map<number, string>()
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

  const syncZoneRotationIdCounter = () => {
    let maxGroupId = 0
    let maxZoneId = 0
    for (const group of rotGroups.value) {
      if (group.id > maxGroupId) maxGroupId = group.id
      for (const zone of group.zones) {
        if (zone.id > maxZoneId) maxZoneId = zone.id
      }
    }
    nextGroupId = maxGroupId > 0 ? maxGroupId + 1 : 1
    nextZoneId = maxZoneId > 0 ? maxZoneId + 1 : 1
  }

  const getRotationData = () => cloneRotationGroups(rotGroups.value)

  const replaceRotationData = (groups: unknown) => {
    const validation = validateRotationDataShape(groups)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    rotGroups.value = cloneRotationGroups(groups as RotationGroup[])
    editingZoneId.value = null
    syncZoneRotationIdCounter()
    return { success: true, error: '' }
  }

  // ==================== 轮换组 ====================

  const addRotGroup = (type: RotationGroup['type'] = 'cycle') => {
    const group: RotationGroup = {
      id: nextGroupId++,
      name: `轮换组 ${nextGroupId - 1}`,
      type,
      zones: []
    }
    rotGroups.value.push(group)
    return group
  }

  const deleteRotGroup = (groupId: number) => {
    const g = rotGroups.value.find(x => x.id === groupId)
    if (g?.zones.some(z => z.id === editingZoneId.value)) editingZoneId.value = null
    rotGroups.value = rotGroups.value.filter(x => x.id !== groupId)
  }

  const updateRotGroup = (groupId: number, updates: Partial<Omit<RotationGroup, 'id' | 'zones'>>) => {
    const g = rotGroups.value.find(x => x.id === groupId)
    if (g) Object.assign(g, updates)
  }

  // ==================== 组内选区 ====================

  const addZoneToGroup = (groupId: number) => {
    const group = rotGroups.value.find(g => g.id === groupId)
    if (!group) return null
    const id = nextZoneId++
    // 同组内避免重名：用全局 id 作名称尾缀
    const zone: RotationZone = { id, name: `选区 ${id}`, seatIds: [] }
    group.zones.push(zone)
    editingZoneId.value = id
    return zone
  }

  const deleteZoneFromGroup = (groupId: number, zoneId: number) => {
    const g = rotGroups.value.find(x => x.id === groupId)
    if (g) g.zones = g.zones.filter(z => z.id !== zoneId)
    if (editingZoneId.value === zoneId) editingZoneId.value = null
  }

  const selectEditingZone = (zoneId: number) => {
    editingZoneId.value = editingZoneId.value === zoneId ? null : zoneId
  }

  const clearEditingZone = () => { editingZoneId.value = null }

  const toggleSeatInEditingZone = (seatId: string) => {
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
    const map = new Map<string, string>()
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

  const validateGroup = (group: RotationGroup) => {
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

  const applyZoneRotation = (seatMap: Map<string, Seat>) => {
    const errors: string[] = []
    const claimedSeatIds = new Map<string, string>()

    for (const group of rotGroups.value) {
      const { valid, error } = validateGroup(group)
      if (!valid) {
        errors.push(`[${group.name}] ${error}`)
        continue
      }

      for (const zone of group.zones) {
        for (const seatId of zone.seatIds) {
          const previousOwner = claimedSeatIds.get(seatId)
          if (previousOwner) {
            errors.push(`[${group.name}/${zone.name}] 座位 ${seatId} 与 ${previousOwner} 重叠`)
            continue
          }
          claimedSeatIds.set(seatId, `${group.name}/${zone.name}`)

          const seat = seatMap.get(seatId)
          if (!seat) {
            errors.push(`[${group.name}/${zone.name}] 座位 ${seatId} 不存在`)
          } else if (seat.isEmpty || seat.kind === 'guard' || isGuardSeatId(seat.id)) {
            errors.push(`[${group.name}/${zone.name}] 座位 ${seatId} 当前不可用于轮换`)
          }
        }
      }
    }

    if (errors.length > 0) return { moved: 0, errors }

    const finalStudentBySeatId = new Map<string, number | null>()

    for (const group of rotGroups.value) {
      if (group.type === 'swap') {
        // 互换：先按位置排序再配对，消除点击顺序影响
        const zA = group.zones[0], zB = group.zones[1]
        if (!zA || !zB) continue
        const idsA = sortedBySeatPos(zA.seatIds)
        const idsB = sortedBySeatPos(zB.seatIds)
        const snapA = idsA.map(sid => seatMap.get(sid)?.studentId ?? null)
        const snapB = idsB.map(sid => seatMap.get(sid)?.studentId ?? null)
        idsA.forEach((sid, i) => {
          finalStudentBySeatId.set(sid, snapB[i] ?? null)
        })
        idsB.forEach((sid, i) => {
          finalStudentBySeatId.set(sid, snapA[i] ?? null)
        })
      } else {
        // 循环：zone[i] 的学生来自 zone[i-1]，按位置排序配对
        const zoneSortedIds = group.zones.map(z => sortedBySeatPos(z.seatIds))
        const snaps = zoneSortedIds.map(ids =>
          ids.map(sid => seatMap.get(sid)?.studentId ?? null)
        )
        zoneSortedIds.forEach((ids, idx) => {
          const src = snaps[(idx - 1 + group.zones.length) % group.zones.length]
          if (!src) return
          ids.forEach((sid, i) => {
            finalStudentBySeatId.set(sid, src[i] ?? null)
          })
        })
      }
    }

    const buildStudentMultiset = (resolveStudentId: (seat: Seat) => number | null) => {
      const multiset = new Map<number, number>()
      for (const seat of seatMap.values()) {
        const studentId = resolveStudentId(seat)
        if (studentId === null) continue
        multiset.set(studentId, (multiset.get(studentId) ?? 0) + 1)
      }
      return multiset
    }
    const beforeMultiset = buildStudentMultiset(seat => seat.studentId)
    const afterMultiset = buildStudentMultiset(seat => (
      finalStudentBySeatId.has(seat.id) ? finalStudentBySeatId.get(seat.id) ?? null : seat.studentId
    ))
    const hasDuplicateStudent = [...afterMultiset.values()].some(count => count > 1)
    const preservesStudentMultiset = beforeMultiset.size === afterMultiset.size &&
      [...beforeMultiset].every(([studentId, count]) => afterMultiset.get(studentId) === count)

    if (hasDuplicateStudent || !preservesStudentMultiset) {
      return {
        moved: 0,
        errors: ['轮换结果未通过学生分配完整性校验，操作已取消']
      }
    }

    const updates: Array<{ seatId: string; studentId: number | null }> = []
    for (const [seatId, studentId] of finalStudentBySeatId) {
      if (seatMap.get(seatId)?.studentId !== studentId) {
        updates.push({ seatId, studentId })
      }
    }

    // 使用统一接口一次提交，recordUndo=false 因为外层已使用 recordBatch
    if (updates.length > 0) {
      batchUpdateSeats(updates, false)
    }

    return { moved: updates.length, errors }
  }

  const cleanupInvalidRotSeats = (validSeatIds: string[]) => {
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

  const resetRotationData = () => clearAllRotData()

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
    resetRotationData,
    getRotationData,
    replaceRotationData,
    syncZoneRotationIdCounter,
    sortedBySeatPos,
    PALETTE,
  }
}
