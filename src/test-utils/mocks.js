import { vi } from 'vitest'

export function createMockSeatChart(overrides = {}) {
  return {
    seats: { value: [] },
    seatConfig: { value: { groupCount: 4, columnsPerGroup: 2, seatsPerColumn: 7 } },
    organizedSeats: { value: [] },
    seatMap: new Map(),
    assignStudent: vi.fn(),
    clearSeat: vi.fn(),
    swapSeats: vi.fn(),
    toggleEmpty: vi.fn(),
    getStudentAtSeat: vi.fn(),
    areDeskmates: vi.fn(),
    getSeatDistance: vi.fn(),
    isInRowRange: vi.fn(),
    getColumnType: vi.fn(),
    clearAllSeats: vi.fn(),
    ...overrides
  }
}

export function createMockStudentData(overrides = {}) {
  return {
    students: { value: [] },
    selectedStudentId: { value: null },
    sortedStudents: { value: [] },
    getSelectedStudent: { value: null },
    addStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn(),
    selectStudent: vi.fn(),
    clearSelection: vi.fn(),
    setStudentCount: vi.fn(),
    addTagToStudents: vi.fn(),
    removeTagFromStudent: vi.fn(),
    removeTagFromStudents: vi.fn(),
    clearAllStudents: vi.fn(),
    ...overrides
  }
}

export function createMockTagData(overrides = {}) {
  return {
    tags: { value: [] },
    addTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    getTagById: vi.fn(),
    clearAllTags: vi.fn(),
    ...overrides
  }
}

export function createMockZoneData(overrides = {}) {
  return {
    zones: { value: [] },
    addZone: vi.fn(),
    updateZone: vi.fn(),
    deleteZone: vi.fn(),
    getZoneForSeat: vi.fn(),
    addSeatToZone: vi.fn(),
    removeSeatFromZone: vi.fn(),
    clearAllZones: vi.fn(),
    cleanupInvalidSeats: vi.fn(),
    ...overrides
  }
}

export function createMockSeatRules(overrides = {}) {
  return {
    rules: { value: [] },
    addRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    toggleRule: vi.fn(),
    getActiveRules: vi.fn(),
    clearAllRules: vi.fn(),
    ...overrides
  }
}

export function createMockUndo(overrides = {}) {
  return {
    canUndo: { value: false },
    canRedo: { value: false },
    recordAssign: vi.fn(),
    recordClear: vi.fn(),
    recordSwap: vi.fn(),
    recordToggleEmpty: vi.fn(),
    recordBatch: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    clear: vi.fn(),
    createSnapshot: vi.fn(() => []),
    ...overrides
  }
}

export function createMockEditMode(overrides = {}) {
  return {
    currentMode: { value: 'NORMAL' },
    setMode: vi.fn(),
    isMode: vi.fn(),
    resetMode: vi.fn(),
    ...overrides
  }
}

export function createMockAssignment(overrides = {}) {
  return {
    autoAssign: vi.fn(),
    calculateScore: vi.fn(),
    isValidAssignment: vi.fn(),
    ...overrides
  }
}
