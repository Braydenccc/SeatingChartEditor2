import { useWorkspace } from './useWorkspace'
import { generateGuardSeatId, generateSeatId } from '@/utils/seatHelpers'
import proxyConfig from '../../fuckseats-proxy.config.json'

const proxyEndpoint = '/api/fuckseats-proxy'
const defaultBaseUrls = proxyConfig.defaultBaseUrls || []

const scoreAttributeDefinition = {
  id: 'score',
  name: '成绩',
  unit: '分',
  min: 0,
  max: 150,
  precision: 1,
  enabled: true,
  showInEditor: true,
  builtInKey: 'score' as const,
  createdFrom: 'default' as const
}

export interface FuckSeatsClassroomSummary {
  id: number
  name: string
  baseUrl: string
  href: string
  gridLabel: string
  studentCount: number | null
  seatCount: number | null
}

interface FuckSeatsStudentProfile {
  id?: number | string
  name?: string
  student_id?: string
  score?: number | string
  score_display?: number | string
  tags?: FuckSeatsTag[]
}

interface FuckSeatsSeat {
  row?: number
  col?: number
  cell_type?: string
  student?: FuckSeatsStudentProfile | null
}

interface FuckSeatsTag {
  id?: number | string
  name?: string
  color?: string
}

interface FuckSeatsStatePayload {
  seats?: FuckSeatsSeat[]
  unseated?: FuckSeatsStudentProfile[]
  tags?: FuckSeatsTag[]
  podium_guards?: Record<string, FuckSeatsStudentProfile | null>
}

interface ImportResult {
  students: number
  tags: number
  assignedSeats: number
  emptySeats: number
}

interface DiscoveryAvailableResult {
  available: true
  baseUrl: string
  classrooms: FuckSeatsClassroomSummary[]
}

interface DiscoveryUnavailableResult {
  available: false
  baseUrl: string
  classrooms: FuckSeatsClassroomSummary[]
  errors: string[]
}

type DiscoveryResult = DiscoveryAvailableResult | DiscoveryUnavailableResult

const unique = <T>(items: T[]): T[] => [...new Set(items)]

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const normalizeBaseUrl = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return trimTrailingSlash(raw)
}

const getConfiguredBaseUrls = (): string[] => {
  const env = (import.meta as any).env || {}
  return unique([
    normalizeBaseUrl(env.VITE_FUCKSEATS_BASE_URL),
    ...defaultBaseUrls
  ].filter(Boolean))
}

const getAbsoluteTarget = (baseUrl: string, path: string): string => {
  const normalizedBase = `${trimTrailingSlash(baseUrl)}/`
  return new URL(path.replace(/^\/+/, ''), normalizedBase).toString()
}

const fetchThroughProxy = async (
  targetUrl: string,
  options: { responseType?: 'json' | 'text'; timeoutMs?: number } = {}
) => {
  const responseType = options.responseType || 'json'
  const timeoutMs = options.timeoutMs || 4500
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${proxyEndpoint}?target=${encodeURIComponent(targetUrl)}`, {
      method: 'GET',
      headers: {
        Accept: responseType === 'json'
          ? 'application/json, text/plain, */*'
          : 'text/html, text/plain, */*'
      },
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`)
    }
    return responseType === 'json' ? response.json() : response.text()
  } finally {
    window.clearTimeout(timer)
  }
}

const stripHtml = (value: string): string => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

const parseNumberText = (value: unknown): number | null => {
  const matched = String(value || '').match(/-?\d+(?:\.\d+)?/)
  if (!matched) return null
  const parsed = Number(matched[0])
  return Number.isFinite(parsed) ? parsed : null
}

const parseGridText = (value: unknown): string => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  const matched = text.match(/(\d+)\s*[×xX*]\s*(\d+)/)
  return matched ? `${matched[1]} × ${matched[2]}` : ''
}

const createSummaryFromAnchor = (anchor: Element, baseUrl: string): FuckSeatsClassroomSummary | null => {
  const href = anchor.getAttribute('href') || ''
  const matched = href.match(/\/classroom\/(\d+)\/?/)
  if (!matched) return null

  const metrics = Array.from(anchor.querySelectorAll('.classroom-metrics strong'))
    .map(item => item.textContent || '')
  const title = anchor.querySelector('h3')?.textContent || anchor.textContent || ''

  return {
    id: Number(matched[1]),
    name: title.trim() || `班级 ${matched[1]}`,
    baseUrl,
    href,
    gridLabel: parseGridText(metrics[0]),
    studentCount: parseNumberText(metrics[1]),
    seatCount: parseNumberText(metrics[2])
  }
}

const parseClassroomsWithRegex = (html: string, baseUrl: string): FuckSeatsClassroomSummary[] => {
  const items: FuckSeatsClassroomSummary[] = []
  const linkPattern = /<a\b[^>]*href=(["'])([^"']*\/classroom\/(\d+)\/?[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(html))) {
    const body = match[4] || ''
    const titleMatch = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
    const strongMatches = Array.from(body.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi))
      .map(item => stripHtml(item[1] || ''))

    items.push({
      id: Number(match[3]),
      name: stripHtml(titleMatch?.[1] || '') || `班级 ${match[3]}`,
      baseUrl,
      href: match[2],
      gridLabel: parseGridText(strongMatches[0]),
      studentCount: parseNumberText(strongMatches[1]),
      seatCount: parseNumberText(strongMatches[2])
    })
  }

  return items
}

export const parseClassroomsFromIndexHtml = (html: string, baseUrl: string): FuckSeatsClassroomSummary[] => {
  const seen = new Set<number>()
  let parsed: FuckSeatsClassroomSummary[] = []

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    parsed = Array.from(doc.querySelectorAll('a[href*="/classroom/"]'))
      .map(anchor => createSummaryFromAnchor(anchor, baseUrl))
      .filter((item): item is FuckSeatsClassroomSummary => !!item)
  } else {
    parsed = parseClassroomsWithRegex(html, baseUrl)
  }

  return parsed.filter(item => {
    if (!Number.isFinite(item.id) || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const looksLikeFuckSeats = (html: string): boolean => {
  const text = String(html || '')
  return text.includes('不想排座位') ||
    text.includes('班级列表') ||
    text.includes('classroom-card') ||
    text.includes('新建班级')
}

export const discoverLocalFuckSeats = async (): Promise<DiscoveryResult> => {
  const baseUrls = getConfiguredBaseUrls()
  const errors: string[] = []
  let firstAvailable: DiscoveryAvailableResult | null = null

  for (const baseUrl of baseUrls) {
    try {
      const html = await fetchThroughProxy(getAbsoluteTarget(baseUrl, '/'), {
        responseType: 'text',
        timeoutMs: 2800
      }) as string
      if (!looksLikeFuckSeats(html)) continue
      const classrooms = parseClassroomsFromIndexHtml(html, baseUrl)
      const result = {
        available: true as const,
        baseUrl,
        classrooms
      }
      if (!firstAvailable) firstAvailable = result
      if (classrooms.length > 0) return result
    } catch (error) {
      errors.push(`${baseUrl}: ${(error as Error).message}`)
    }
  }

  if (firstAvailable) {
    return firstAvailable
  }

  return {
    available: false,
    baseUrl: '',
    classrooms: [],
    errors
  } satisfies DiscoveryUnavailableResult
}

const normalizeTagColor = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) return raw
  return '#0a59f7'
}

const normalizeSourceId = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const normalizeStudentNumber = (value: unknown): number | null => {
  const text = String(value || '').trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeScore = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const addTagToMap = (tagMap: Map<number, any>, tag: FuckSeatsTag | undefined | null) => {
  const id = normalizeSourceId(tag?.id)
  const name = String(tag?.name || '').trim()
  if (!id || !name || tagMap.has(id)) return
  tagMap.set(id, {
    id,
    name,
    color: normalizeTagColor(tag?.color),
    showInSeatChart: true
  })
}

const getStudentTagIds = (student: FuckSeatsStudentProfile | undefined | null, tagMap: Map<number, any>) => {
  const ids: number[] = []
  ;(student?.tags || []).forEach(tag => {
    addTagToMap(tagMap, tag)
    const id = normalizeSourceId(tag.id)
    if (id) ids.push(id)
  })
  return unique(ids)
}

const normalizeSeatPosition = (seat: FuckSeatsSeat) => {
  const row = Number(seat.row)
  const col = Number(seat.col)
  if (!Number.isInteger(row) || row <= 0 || !Number.isInteger(col) || col <= 0) {
    throw new Error('不想排座位座位坐标无效')
  }
  return {
    rowIndex: row - 1,
    colIndex: col - 1
  }
}

const createEmptySeatItem = (colIndex: number, rowIndex: number) => ({
  id: generateSeatId(0, colIndex, rowIndex),
  kind: 'regular',
  group: 0,
  col: colIndex,
  row: rowIndex,
  studentId: null,
  empty: true
})

export const buildWorkspaceFromFuckSeatsState = (
  classroom: FuckSeatsClassroomSummary,
  state: FuckSeatsStatePayload
) => {
  if (!state || typeof state !== 'object') {
    throw new Error('不想排座位班级数据格式不正确')
  }

  const seats = Array.isArray(state.seats) ? state.seats : []
  const tagMap = new Map<number, any>()
  const students = new Map<number, any>()
  const physicalSeatByStudentId = new Map<number, boolean>()

  ;(state.tags || []).forEach(tag => addTagToMap(tagMap, tag))

  const addStudent = (student: FuckSeatsStudentProfile | undefined | null) => {
    const sourceId = normalizeSourceId(student?.id)
    const name = String(student?.name || '').trim()
    if (!sourceId || !name) return null

    const existing = students.get(sourceId)
    const tagIds = getStudentTagIds(student, tagMap)
    const score = normalizeScore(student?.score ?? student?.score_display)
    const next = existing || {
      id: sourceId,
      name,
      studentNumber: normalizeStudentNumber(student?.student_id),
      tags: [],
      numericAttributes: {}
    }

    next.name = next.name || name
    next.studentNumber = next.studentNumber ?? normalizeStudentNumber(student?.student_id)
    next.tags = unique([...(next.tags || []), ...tagIds])
    if (score !== null) {
      next.numericAttributes = {
        ...(next.numericAttributes || {}),
        score
      }
    }
    students.set(sourceId, next)
    return next
  }

  const positions = seats.map(normalizeSeatPosition)
  const maxRow = Math.max(1, ...positions.map(position => position.rowIndex + 1))
  const maxCol = Math.max(1, ...positions.map(position => position.colIndex + 1))
  const seatItems: any[] = []
  const seenPositions = new Set<string>()

  seats.forEach((seat, index) => {
    const { rowIndex, colIndex } = positions[index]
    const positionKey = `${colIndex}:${rowIndex}`
    if (seenPositions.has(positionKey)) {
      throw new Error(`不想排座位座位坐标重复：第 ${rowIndex + 1} 行第 ${colIndex + 1} 列`)
    }
    seenPositions.add(positionKey)
    const student = addStudent(seat.student)
    const isSeatCell = seat.cell_type === 'seat'
    const studentId = isSeatCell ? (student?.id ?? null) : null
    if (studentId !== null) physicalSeatByStudentId.set(studentId, true)

    seatItems.push({
      id: generateSeatId(0, colIndex, rowIndex),
      kind: 'regular',
      group: 0,
      col: colIndex,
      row: rowIndex,
      studentId,
      empty: !isSeatCell
    })
  })

  for (let colIndex = 0; colIndex < maxCol; colIndex++) {
    for (let rowIndex = 0; rowIndex < maxRow; rowIndex++) {
      const positionKey = `${colIndex}:${rowIndex}`
      if (!seenPositions.has(positionKey)) {
        seatItems.push(createEmptySeatItem(colIndex, rowIndex))
      }
    }
  }

  ;(state.unseated || []).forEach(student => addStudent(student))

  const podiumGuards = state.podium_guards || {}
  ;(['left', 'right'] as const).forEach(side => {
    const student = addStudent(podiumGuards[side])
    if (!student || physicalSeatByStudentId.has(student.id)) return
    seatItems.push({
      id: generateGuardSeatId(side),
      kind: 'guard',
      guardSide: side,
      group: -1,
      col: side === 'left' ? -1 : 1,
      row: -1,
      studentId: student.id,
      empty: false
    })
  })

  return {
    meta: {
      version: '2.2',
      app: 'SeatingChartEditor',
      createdAt: new Date().toISOString(),
      source: 'fuckseats',
      sourceClassroomId: classroom.id,
      sourceBaseUrl: classroom.baseUrl
    },
    students: Array.from(students.values()),
    studentAttributeDefinitions: [scoreAttributeDefinition],
    studentAttributeSettings: {
      showNumericAttributesInEditor: true
    },
    tags: Array.from(tagMap.values()),
    tagSettings: {
      showTagsInSeatChart: true,
      tagDisplayMode: 'dot'
    },
    layout: {
      config: {
        groupCount: 1,
        columnsPerGroup: maxCol,
        seatsPerColumn: maxRow,
        groups: [{ columns: maxCol, rows: maxRow }],
        shiftDistance: 4,
        podiumPosition: 'bottom',
        guardSeats: {
          enabled: true,
          leftEnabled: true,
          rightEnabled: true,
          includeInAutoAssignment: false,
          hideEmptyOnExport: true
        }
      },
      seats: seatItems
    },
    zones: [],
    rules: [],
    exportSettings: {}
  }
}

export function useFuckSeatsImport() {
  const { applyWorkspaceData, saveLastWorkspace } = useWorkspace()

  const fetchClassroomState = async (classroom: FuckSeatsClassroomSummary) => {
    return fetchThroughProxy(
      getAbsoluteTarget(classroom.baseUrl, `/classroom/${classroom.id}/state/`),
      { responseType: 'json', timeoutMs: 6500 }
    ) as Promise<FuckSeatsStatePayload>
  }

  const importClassroom = async (classroom: FuckSeatsClassroomSummary): Promise<ImportResult> => {
    const state = await fetchClassroomState(classroom)
    const workspace = buildWorkspaceFromFuckSeatsState(classroom, state)
    const imported = await applyWorkspaceData(workspace)
    if (!imported) {
      throw new Error('不想排座位班级数据导入失败')
    }

    saveLastWorkspace({
      type: 'fuckseats',
      name: classroom.name,
      baseUrl: classroom.baseUrl,
      classroomId: classroom.id
    })

    return {
      students: workspace.students.length,
      tags: workspace.tags.length,
      assignedSeats: workspace.layout.seats.filter((seat: any) => seat.studentId != null).length,
      emptySeats: workspace.layout.seats.filter((seat: any) => seat.empty).length
    }
  }

  return {
    discoverLocalFuckSeats,
    fetchClassroomState,
    importClassroom
  }
}
