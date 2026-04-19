import { ref, computed } from 'vue'
import { vi } from 'vitest'

export const createMockUseUndo = () => ({
  undoStack: ref([]),
  redoStack: ref([]),
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
  undo: vi.fn(),
  redo: vi.fn(),
  recordAssign: vi.fn(),
  recordClear: vi.fn(),
  recordSwap: vi.fn(),
  recordToggleEmpty: vi.fn(),
  recordBatch: vi.fn(),
  clearHistory: vi.fn(),
  createSnapshot: vi.fn(() => []),
  highlightedSeats: ref(new Set()),
  isHighlighted: vi.fn(() => false)
})

export const createMockUseZoneData = () => ({
  zones: ref([]),
  selectedZoneId: ref(null),
  addZone: vi.fn(),
  updateZone: vi.fn(),
  deleteZone: vi.fn(),
  addTagToZone: vi.fn(),
  removeTagFromZone: vi.fn(),
  addSeatToZone: vi.fn(),
  removeSeatFromZone: vi.fn(),
  toggleSeatInZone: vi.fn(),
  getZoneForSeat: vi.fn(() => null),
  getZoneColor: vi.fn(() => '#E0E0E0'),
  selectZone: vi.fn(),
  clearZoneSelection: vi.fn(),
  toggleZoneVisible: vi.fn(),
  visibleZoneSeats: computed(() => new Map()),
  removeTagFromAllZones: vi.fn(),
  cleanupInvalidSeats: vi.fn(),
  clearAllZones: vi.fn()
})

export const createMockUseLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn()
})
