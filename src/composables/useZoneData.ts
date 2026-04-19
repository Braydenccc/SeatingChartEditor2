import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Zone, UseZoneDataReturn } from '@/types'
import { useTagData } from './useTagData'

// 选区数据管理
const zones = ref<Zone[]>([])
let nextZoneId: number = 1

// 当前选中的选区ID
const selectedZoneId = ref<number | null>(null)

export function useZoneData(): UseZoneDataReturn {
  const { tags } = useTagData()

  // 添加选区
  const addZone = (): number => {
    const newId = nextZoneId++
    const newZone: Zone = {
      id: newId,
      name: '',
      tagIds: [],
      seatIds: [],
      visible: false
    }
    zones.value.push(newZone)
    return newId
  }

  // 更新选区
  const updateZone = (zoneId: number, updates: Partial<Zone>): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone) {
      if (updates.name !== undefined) {
        zone.name = updates.name.trim()
      }
      if (updates.tagIds !== undefined) zone.tagIds = updates.tagIds
      if (updates.seatIds !== undefined) zone.seatIds = updates.seatIds
      if (updates.visible !== undefined) zone.visible = updates.visible
    }
  }

  // 删除选区
  const deleteZone = (zoneId: number): void => {
    zones.value = zones.value.filter(z => z.id !== zoneId)
    if (selectedZoneId.value === zoneId) {
      selectedZoneId.value = null
    }
  }

  // 为选区添加标签
  const addTagToZone = (zoneId: number, tagId: number): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone && !zone.tagIds.includes(tagId)) {
      zone.tagIds.push(tagId)
    }
  }

  // 从选区移除标签
  const removeTagFromZone = (zoneId: number, tagId: number): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone) {
      zone.tagIds = zone.tagIds.filter(tid => tid !== tagId)
    }
  }

  // 为选区添加座位
  const addSeatToZone = (zoneId: number, seatId: string): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone && !zone.seatIds.includes(seatId)) {
      zone.seatIds.push(seatId)
    }
  }

  // 从选区移除座位
  const removeSeatFromZone = (zoneId: number, seatId: string): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone) {
      zone.seatIds = zone.seatIds.filter(sid => sid !== seatId)
    }
  }

  // 切换座位在选区中的状态(添加或移除)
  const toggleSeatInZone = (zoneId: number, seatId: string): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone) {
      if (zone.seatIds.includes(seatId)) {
        removeSeatFromZone(zoneId, seatId)
      } else {
        addSeatToZone(zoneId, seatId)
      }
    }
  }

  // 获取座位所属的选区
  const getZoneForSeat = (seatId: string): Zone | null => {
    return zones.value.find(z => z.seatIds.includes(seatId)) || null
  }

  // 获取选区颜色(取第一个标签的颜色)
  const getZoneColor = (zoneId: number): string => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (!zone || zone.tagIds.length === 0) {
      return '#E0E0E0' // 默认灰色
    }
    const firstTag = tags.value.find(t => t.id === zone.tagIds[0])
    return firstTag ? firstTag.color : '#E0E0E0'
  }

  // 选择选区
  const selectZone = (zoneId: number): void => {
    selectedZoneId.value = zoneId
  }

  // 清除选区选择
  const clearZoneSelection = (): void => {
    selectedZoneId.value = null
  }

  // 切换选区可见性
  const toggleZoneVisible = (zoneId: number): void => {
    const zone = zones.value.find(z => z.id === zoneId)
    if (zone) {
      zone.visible = !zone.visible
    }
  }

  // 获取所有可见的选区座位(用于高亮显示)
  const visibleZoneSeats: ComputedRef<Map<string, string>> = computed(() => {
    const seatMap = new Map<string, string>() // seatId -> zoneColor
    zones.value.forEach(zone => {
      if (zone.visible || zone.id === selectedZoneId.value) {
        const color = getZoneColor(zone.id)
        zone.seatIds.forEach(seatId => {
          seatMap.set(seatId, color)
        })
      }
    })
    return seatMap
  })

  // 当标签被删除时,清理选区中的标签引用
  const removeTagFromAllZones = (tagId: number): void => {
    zones.value.forEach(zone => {
      zone.tagIds = zone.tagIds.filter(tid => tid !== tagId)
    })
  }

  // 清理无效的座位ID(座位配置改变后)
  const cleanupInvalidSeats = (validSeatIds: string[]): void => {
    const validSet = new Set(validSeatIds)
    zones.value.forEach(zone => {
      zone.seatIds = zone.seatIds.filter(seatId => validSet.has(seatId))
    })
  }

  // 清空所有选区
  const clearAllZones = (): void => {
    zones.value = []
    selectedZoneId.value = null
    nextZoneId = 1
  }

  // 同步选区 ID 计数器（工作区加载后调用）
  const syncZoneIdCounter = (): void => {
    if (zones.value.length === 0) {
      nextZoneId = 1
      return
    }
    const maxId = Math.max(...zones.value.map(z => z.id))
    nextZoneId = maxId + 1
  }

  return {
    zones,
    selectedZoneId,
    addZone,
    updateZone,
    deleteZone,
    addTagToZone,
    removeTagFromZone,
    addSeatToZone,
    removeSeatFromZone,
    toggleSeatInZone,
    getZoneForSeat,
    getZoneColor,
    selectZone,
    clearZoneSelection,
    toggleZoneVisible,
    visibleZoneSeats,
    removeTagFromAllZones,
    cleanupInvalidSeats,
    clearAllZones,
    syncZoneIdCounter
  }
}
