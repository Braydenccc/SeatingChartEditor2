import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useZoneData } from '../useZoneData'

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => ({
    seats: { value: [] }
  })
}))

describe('useZoneData', () => {
  let zoneData

  beforeEach(() => {
    zoneData = useZoneData()
    zoneData.zones.value = []
  })

  describe('addZone', () => {
    it('should add a new zone with default properties', () => {
      const id = zoneData.addZone()

      expect(zoneData.zones.value).toHaveLength(1)
      expect(zoneData.zones.value[0]).toMatchObject({
        id: expect.any(Number),
        name: '',
        seatIds: []
      })
    })

    it('should generate unique IDs for multiple zones', () => {
      const id1 = zoneData.addZone()
      const id2 = zoneData.addZone()

      expect(id1).not.toBe(id2)
      expect(zoneData.zones.value).toHaveLength(2)
    })
  })

  describe('updateZone', () => {
    it('should update zone properties', () => {
      const id = zoneData.addZone()

      zoneData.updateZone(id, {
        name: 'A区',
        seatIds: ['seat-0-0-0', 'seat-0-0-1']
      })

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.name).toBe('A区')
      expect(zone.seatIds).toEqual(['seat-0-0-0', 'seat-0-0-1'])
    })

    it('should trim whitespace from zone names', () => {
      const id = zoneData.addZone()
      zoneData.updateZone(id, { name: '  A区  ' })

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.name).toBe('A区')
    })
  })

  describe('deleteZone', () => {
    it('should remove zone from list', () => {
      const id = zoneData.addZone()
      expect(zoneData.zones.value).toHaveLength(1)

      zoneData.deleteZone(id)
      expect(zoneData.zones.value).toHaveLength(0)
    })
  })

  describe('getZoneForSeat', () => {
    it('should return zone containing the seat', () => {
      const id = zoneData.addZone()
      zoneData.updateZone(id, {
        name: 'A区',
        seatIds: ['seat-0-0-0', 'seat-0-0-1']
      })

      const zone = zoneData.getZoneForSeat('seat-0-0-0')
      expect(zone).toBeDefined()
      expect(zone.id).toBe(id)
    })

    it('should return null for seat not in any zone', () => {
      const zone = zoneData.getZoneForSeat('seat-999')
      expect(zone).toBeNull()
    })
  })

  describe('addSeatToZone', () => {
    it('should add seat to zone', () => {
      const id = zoneData.addZone()

      zoneData.addSeatToZone(id, 'seat-0-0-0')

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.seatIds).toContain('seat-0-0-0')
    })

    it('should not add duplicate seats', () => {
      const id = zoneData.addZone()

      zoneData.addSeatToZone(id, 'seat-0-0-0')
      zoneData.addSeatToZone(id, 'seat-0-0-0')

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.seatIds.filter(s => s === 'seat-0-0-0')).toHaveLength(1)
    })
  })

  describe('removeSeatFromZone', () => {
    it('should remove seat from zone', () => {
      const id = zoneData.addZone()
      zoneData.updateZone(id, {
        seatIds: ['seat-0-0-0', 'seat-0-0-1']
      })

      zoneData.removeSeatFromZone(id, 'seat-0-0-0')

      const zone = zoneData.zones.value.find(z => z.id === id)
      expect(zone.seatIds).not.toContain('seat-0-0-0')
      expect(zone.seatIds).toContain('seat-0-0-1')
    })
  })

  describe('clearAllZones', () => {
    it('should remove all zones', () => {
      zoneData.addZone()
      zoneData.addZone()

      expect(zoneData.zones.value).toHaveLength(2)

      zoneData.clearAllZones()
      expect(zoneData.zones.value).toHaveLength(0)
    })
  })
})
