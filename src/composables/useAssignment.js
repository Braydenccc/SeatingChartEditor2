import { ref } from 'vue'
import { useStudentData } from './useStudentData'
import { useSeatChart } from './useSeatChart'
import { useZoneData } from './useZoneData'
import { useSeatRelation } from './useSeatRelation'
import { RelationType, getRelationPriority } from '../constants/relationTypes.js'

export function useAssignment() {
  const { students } = useStudentData()
  const {
    seats,
    clearAllSeats,
    assignStudent,
    areDeskmates,
    getAvailableSeats,
    getEmptySeats,
    getSeatDistance,
    getAdjacentSeats,
    validateRepulsion
  } = useSeatChart()
  const { zones, getZoneForSeat } = useZoneData()

  const isAssigning = ref(false)

  // ==================== 随机工具 ====================

  // Fisher-Yates 洗牌
  const shuffleArray = (array) => {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  // 从数组中随机选一个
  const pickRandom = (array) => {
    if (array.length === 0) return null
    return array[Math.floor(Math.random() * array.length)]
  }

  // 从数组中随机选一对（返回 [a, b]）
  const pickRandomPair = (array) => {
    if (array.length < 2) return null
    const shuffled = shuffleArray(array)
    return [shuffled[0], shuffled[1]]
  }

  // ==================== 座位查找策略 ====================

  // 获取当前空闲座位
  const getFreeSeats = (allSeats, assignedSeatIds) =>
    allSeats.filter(s => !assignedSeatIds.has(s.id))

  /**
   * 查找吸引关系座位对
   * 优先级: 同桌 → 相邻 → 同组 → fallback
   * 每个优先级内随机选取
   */
  const findAttractionSeats = (allSeats, assignedSeatIds, allowAdjacent = true) => {
    const free = getFreeSeats(allSeats, assignedSeatIds)
    if (free.length < 2) return null

    // 收集所有同桌对
    const deskmatesPairs = []
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (areDeskmates(free[i].id, free[j].id)) {
          deskmatesPairs.push([free[i], free[j]])
        }
      }
    }
    if (deskmatesPairs.length > 0) {
      const pair = pickRandom(deskmatesPairs)
      return { seats: pair, distance: 0, type: 'deskmate' }
    }

    // 收集所有相邻对（距离 1）
    if (allowAdjacent) {
      const adjacentPairs = []
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) {
          const d = getSeatDistance(free[i].id, free[j].id)
          if (d === 1) {
            adjacentPairs.push([free[i], free[j]])
          }
        }
      }
      if (adjacentPairs.length > 0) {
        const pair = pickRandom(adjacentPairs)
        return { seats: pair, distance: 1, type: 'adjacent' }
      }
    }

    // 收集同组对（距离有限且 > 1）
    const sameGroupPairs = []
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const d = getSeatDistance(free[i].id, free[j].id)
        if (d > 1 && d !== Infinity) {
          sameGroupPairs.push({ pair: [free[i], free[j]], distance: d })
        }
      }
    }
    if (sameGroupPairs.length > 0) {
      // 按距离排序后从最近的几个中随机选
      sameGroupPairs.sort((a, b) => a.distance - b.distance)
      const minDist = sameGroupPairs[0].distance
      const closest = sameGroupPairs.filter(p => p.distance <= minDist + 1)
      const chosen = pickRandom(closest)
      return { seats: chosen.pair, distance: chosen.distance, type: 'same_group' }
    }

    // 降级：随机两个座位
    const pair = pickRandomPair(free)
    if (pair) {
      return {
        seats: pair,
        distance: getSeatDistance(pair[0].id, pair[1].id),
        type: 'fallback'
      }
    }

    return null
  }

  /**
   * 查找排斥关系座位对
   * 优先级: 跨大组 → 同组满足 minDistance → fallback
   * 每个优先级内随机选取
   */
  const findRepulsionSeats = (allSeats, assignedSeatIds, minDistance = 2) => {
    const free = getFreeSeats(allSeats, assignedSeatIds)
    if (free.length < 2) return null

    // 收集所有跨组对
    const crossGroupPairs = []
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (free[i].groupIndex !== free[j].groupIndex) {
          crossGroupPairs.push([free[i], free[j]])
        }
      }
    }
    if (crossGroupPairs.length > 0) {
      const pair = pickRandom(crossGroupPairs)
      return { seats: pair, distance: Infinity, type: 'repulsion_cross_group' }
    }

    // 收集所有满足 minDistance 的同组对
    const distantPairs = []
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const d = getSeatDistance(free[i].id, free[j].id)
        if (d >= minDistance) {
          distantPairs.push({ pair: [free[i], free[j]], distance: d })
        }
      }
    }
    if (distantPairs.length > 0) {
      // 从最远的几个中随机选
      distantPairs.sort((a, b) => b.distance - a.distance)
      const maxDist = distantPairs[0].distance
      const farthest = distantPairs.filter(p => p.distance >= maxDist - 1)
      const chosen = pickRandom(farthest)
      return { seats: chosen.pair, distance: chosen.distance, type: 'repulsion_satisfied' }
    }

    return null
  }

  /**
   * 同桌绑定：必须找到同桌座位对，从候选中随机
   */
  const findSeatmateBindingSeats = (allSeats, assignedSeatIds) => {
    const free = getFreeSeats(allSeats, assignedSeatIds)
    const pairs = []

    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (areDeskmates(free[i].id, free[j].id)) {
          pairs.push([free[i], free[j]])
        }
      }
    }

    if (pairs.length > 0) {
      const pair = pickRandom(pairs)
      return { seats: pair, distance: 0, type: 'seatmate_binding' }
    }

    return null
  }

  /**
   * 同桌排斥：禁止同桌，随机选非同桌对
   */
  const findSeatmateRepulsionSeats = (allSeats, assignedSeatIds) => {
    const free = getFreeSeats(allSeats, assignedSeatIds)
    const pairs = []

    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (!areDeskmates(free[i].id, free[j].id)) {
          pairs.push([free[i], free[j]])
        }
      }
    }

    if (pairs.length > 0) {
      const pair = pickRandom(pairs)
      const distance = getSeatDistance(pair[0].id, pair[1].id)
      return { seats: pair, distance, type: 'seatmate_repulsion' }
    }

    return null
  }

  // ==================== 主排位算法 ====================

  const runAssignment = async (useRelations = false) => {
    if (isAssigning.value) {
      return { success: false, message: '正在排位中,请稍候...' }
    }

    isAssigning.value = true

    try {
      clearAllSeats()

      const allStudents = shuffleArray(students.value.map(s => ({ ...s })))
      const allSeats = shuffleArray(getAvailableSeats()) // 座位也打乱

      const allZones = zones.value || []

      // 按选区分组座位
      const zoneSeatMap = new Map()
      const nonZoneSeats = []

      allSeats.forEach(seat => {
        const zone = getZoneForSeat(seat.id)
        if (zone) {
          if (!zoneSeatMap.has(zone.id)) {
            zoneSeatMap.set(zone.id, [])
          }
          zoneSeatMap.get(zone.id).push(seat)
        } else {
          nonZoneSeats.push(seat)
        }
      })

      // 获取并排序联系关系
      let relationPairs = []
      let satisfiedRelations = 0
      let totalRelations = 0

      if (useRelations) {
        const { getSortedRelationsByPriority } = useSeatRelation()
        const sortedRelations = getSortedRelationsByPriority()

        relationPairs = sortedRelations.map(r => ({
          relation: r,
          student1: allStudents.find(s => s.id === r.studentId1),
          student2: allStudents.find(s => s.id === r.studentId2)
        })).filter(p => p.student1 && p.student2)

        totalRelations = relationPairs.length
      }

      const assignments = []
      const assignedStudentIds = new Set()
      const assignedSeatIds = new Set()

      const assignToSeat = (student, seat) => {
        assignments.push({ studentId: student.id, seatId: seat.id })
        assignedStudentIds.add(student.id)
        assignedSeatIds.add(seat.id)
        assignStudent(seat.id, student.id)
      }

      // 随机分配单个学生到一个随机空闲座位
      const assignStudentRandomly = (student, candidateSeats) => {
        const free = shuffleArray(candidateSeats.filter(s => !assignedSeatIds.has(s.id)))
        if (free.length > 0) {
          assignToSeat(student, free[0])
          return true
        }
        return false
      }

      // ========== 策略0：处理联系关系 ==========
      if (useRelations && relationPairs.length > 0) {
        for (const pair of relationPairs) {
          const { relation, student1, student2 } = pair

          if (assignedStudentIds.has(student1.id) || assignedStudentIds.has(student2.id)) {
            continue
          }

          let result = null

          if (relation.relationType === RelationType.ATTRACTION) {
            const allowAdjacent = relation.metadata?.allowAdjacent ?? true
            result = findAttractionSeats(allSeats, assignedSeatIds, allowAdjacent)
          } else if (relation.relationType === RelationType.REPULSION) {
            const minDistance = relation.metadata?.minDistance ?? 2
            result = findRepulsionSeats(allSeats, assignedSeatIds, minDistance)
          } else if (relation.relationType === RelationType.SEATMATE_BINDING) {
            result = findSeatmateBindingSeats(allSeats, assignedSeatIds)
          } else if (relation.relationType === RelationType.SEATMATE_REPULSION) {
            result = findSeatmateRepulsionSeats(allSeats, assignedSeatIds)
          }

          if (result && result.seats.length === 2) {
            // 随机决定 student1/student2 分别坐哪个座位
            if (Math.random() < 0.5) {
              assignToSeat(student1, result.seats[0])
              assignToSeat(student2, result.seats[1])
            } else {
              assignToSeat(student1, result.seats[1])
              assignToSeat(student2, result.seats[0])
            }
            satisfiedRelations++
          }
        }
      }

      // ========== 策略1：选区约束 ==========
      const shuffledZoneEntries = shuffleArray([...zoneSeatMap.entries()])
      for (const [zoneId, zoneSeats] of shuffledZoneEntries) {
        const zone = allZones.find(z => z.id === zoneId)
        if (!zone || !zone.tagIds || zone.tagIds.length === 0) continue

        const eligibleStudents = shuffleArray(
          allStudents.filter(student => {
            if (assignedStudentIds.has(student.id)) return false
            if (!student.tags || student.tags.length === 0) return false
            return student.tags.some(tagId => zone.tagIds.includes(tagId))
          })
        )

        const availableZoneSeats = shuffleArray(
          zoneSeats.filter(s => !assignedSeatIds.has(s.id))
        )

        const count = Math.min(eligibleStudents.length, availableZoneSeats.length)
        for (let i = 0; i < count; i++) {
          assignToSeat(eligibleStudents[i], availableZoneSeats[i])
        }
      }

      // ========== 策略2：剩余学生 → 剩余座位（全局） ==========
      // 合并所有剩余座位（包括选区中未被占用的）
      const finalUnassigned = shuffleArray(
        allStudents.filter(s => !assignedStudentIds.has(s.id))
      )
      const finalAvailableSeats = shuffleArray(
        allSeats.filter(s => !assignedSeatIds.has(s.id))
      )

      const finalCount = Math.min(finalUnassigned.length, finalAvailableSeats.length)
      for (let i = 0; i < finalCount; i++) {
        assignToSeat(finalUnassigned[i], finalAvailableSeats[i])
      }

      // ========== 统计结果 ==========
      const unassigned = allStudents.filter(s => !assignedStudentIds.has(s.id))

      let message = `成功分配 ${assignments.length} 个学生`
      if (useRelations && totalRelations > 0) {
        message += `\n联系关系: ${satisfiedRelations}/${totalRelations} 满足`
      }

      if (unassigned.length > 0) {
        return {
          success: false,
          message: `部分学生无法分配\n成功分配: ${assignments.length}/${allStudents.length}\n${useRelations && totalRelations > 0 ? `联系关系: ${satisfiedRelations}/${totalRelations} 满足\n` : ''}未分配学生: ${unassigned.map(s => s.name || '未命名').join(', ')}`,
          assigned: assignments.length,
          total: allStudents.length,
          unassigned,
          relationStats: { satisfied: satisfiedRelations, total: totalRelations }
        }
      }

      return {
        success: true,
        message,
        assigned: assignments.length,
        total: allStudents.length,
        relationStats: { satisfied: satisfiedRelations, total: totalRelations }
      }

    } catch (error) {
      return {
        success: false,
        message: `排位失败: ${error.message}`
      }
    } finally {
      isAssigning.value = false
    }
  }

  // 简化版随机排位（纯随机）
  const runRandomAssignment = () => {
    clearAllSeats()

    const allStudents = shuffleArray(students.value.map(s => ({ ...s })))
    const allSeats = shuffleArray(getAvailableSeats())

    const count = Math.min(allStudents.length, allSeats.length)
    for (let i = 0; i < count; i++) {
      assignStudent(allSeats[i].id, allStudents[i].id)
    }

    return {
      success: true,
      message: `随机分配 ${count} 个学生`,
      assigned: count,
      total: allStudents.length
    }
  }

  return {
    isAssigning,
    runAssignment,
    runRandomAssignment
  }
}
