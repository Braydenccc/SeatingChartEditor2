import { describe, expect, it } from 'vitest'
import { normalizeExportSettings, useExportSettings } from '../useExportSettings'

describe('useExportSettings', () => {
  it('should migrate legacy image reverseOrder to flipVertical', () => {
    const settings = normalizeExportSettings({ reverseOrder: true })

    expect(settings.flipVertical).toBe(true)
    expect(settings.reverseOrder).toBe(true)
  })

  it('should migrate legacy excelReverseOrder to excelFlipVertical', () => {
    const settings = normalizeExportSettings({ excelReverseOrder: true })

    expect(settings.excelFlipVertical).toBe(true)
    expect(settings.excelReverseOrder).toBe(true)
  })

  it('should let new flip fields take precedence over legacy fields', () => {
    const settings = normalizeExportSettings({
      flipVertical: false,
      reverseOrder: true,
      excelFlipVertical: false,
      excelReverseOrder: true
    })

    expect(settings.flipVertical).toBe(false)
    expect(settings.excelFlipVertical).toBe(false)
  })

  it('should apply legacy workspace settings before default fields mask them', () => {
    const { exportSettings, resetExportSettings, applyExportSettings } = useExportSettings()

    resetExportSettings()
    applyExportSettings({
      reverseOrder: true,
      excelReverseOrder: true
    })

    expect(exportSettings.value.flipVertical).toBe(true)
    expect(exportSettings.value.excelFlipVertical).toBe(true)
  })
})
