import { ref } from 'vue'
import type { RotationGroup } from '@/types/models'

export const rotGroups = ref<RotationGroup[]>([])

export const pruneRotationSeatIds = (validSeatIds: Iterable<string>) => {
  const validSet = new Set(validSeatIds)
  for (const group of rotGroups.value) {
    for (const zone of group.zones) {
      zone.seatIds = zone.seatIds.filter(seatId => validSet.has(seatId))
    }
  }
}
