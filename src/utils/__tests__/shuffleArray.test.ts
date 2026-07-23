import { describe, expect, it } from 'vitest'
import { shuffleArray } from '../shuffleArray'

describe('shuffleArray', () => {
  it('uses Fisher-Yates without mutating the input', () => {
    const input = [1, 2, 3, 4]
    const randomValues = [0, 0.5, 0.25]
    let index = 0

    const result = shuffleArray(input, () => randomValues[index++] ?? 0)

    expect(input).toEqual([1, 2, 3, 4])
    expect(result).toEqual([3, 4, 2, 1])
    expect([...result].sort()).toEqual(input)
  })

  it('can randomize ties before a stable primary-key sort', () => {
    const values = [
      { id: 'a', rank: 1 },
      { id: 'b', rank: 1 },
      { id: 'c', rank: 2 }
    ]

    const sorted = shuffleArray(values, () => 0).sort((a, b) => a.rank - b.rank)

    expect(sorted.map(item => item.rank)).toEqual([1, 1, 2])
    expect(sorted.filter(item => item.rank === 1).map(item => item.id)).toEqual(['b', 'a'])
  })
})
