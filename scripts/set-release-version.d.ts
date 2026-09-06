export interface ReleaseVersionInfo {
  buildTime: string
  releaseVersion: string
  packageVersion: string
  wixVersion: string
}

export function createReleaseVersionInfo(
  timestamp?: Date | string | number
): ReleaseVersionInfo

export function parseReleaseVersionTimestamp(releaseVersion: unknown): string

export function updateReleaseVersions(
  versionInfo: ReleaseVersionInfo,
  options?: { check?: boolean }
): string[]
