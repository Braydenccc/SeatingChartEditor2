import { describe, expect, it } from 'vitest'
import { convertGridToGroupedColumns, type GridToGroupedCell } from '../gridToGroupedColumns'

describe('convertGridToGroupedColumns limits', () => {
  it('accepts a grid exactly at the workspace seat limit', () => {
    const result = convertGridToGroupedColumns(100, 200, [])

    expect(result.seats).toHaveLength(20_000)
    expect(result.seatConfig.groups).toEqual([{ columns: 200, rows: 100 }])
  })

  it('rejects invalid dimensions and oversized cell collections before conversion', () => {
    expect(() => convertGridToGroupedColumns(1, 20_001, []))
      .toThrow('网格普通座位数不能超过 20000')
    expect(() => convertGridToGroupedColumns(Number.MAX_SAFE_INTEGER + 1, 1, []))
      .toThrow('网格 rows/columns 必须是正安全整数')
    expect(() => convertGridToGroupedColumns(1, 1, Array.from({ length: 20_001 }, () => ({
      x: 0,
      y: 0,
      kind: 'empty'
    }))))
      .toThrow('网格单元格数量不能超过 20000')
  })

  it('rejects inferred layouts with more than 50 groups before allocating seats', () => {
    const cells: GridToGroupedCell[] = Array.from({ length: 51 }, (_, index) => ({
      x: index * 2,
      y: 0,
      kind: 'seat'
    }))

    expect(() => convertGridToGroupedColumns(1, 101, cells))
      .toThrow('网格转换后的大组数不能超过 50')
  })
})
