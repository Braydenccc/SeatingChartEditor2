import { describe, expect, it } from 'vitest'
import {
  createReleaseVersionInfo,
  parseReleaseVersionTimestamp
} from '../../../scripts/set-release-version.js'

describe('timestamp release versions', () => {
  it('derives display, SemVer and MSI-safe versions from one UTC timestamp', () => {
    expect(createReleaseVersionInfo(new Date('2026-07-15T02:32:38Z'))).toEqual({
      buildTime: '2026-07-15T02:32:38Z',
      releaseVersion: 'v20260715-023238',
      packageVersion: '26.7.1502-3238',
      wixVersion: '26.7.1502.3238'
    })
  })

  it('parses the display version back to its UTC timestamp', () => {
    expect(parseReleaseVersionTimestamp('v20260715-023238')).toBe('2026-07-15T02:32:38Z')
  })
})
