import { ref, nextTick } from 'vue'

const MIN_SCALE = 0.2
const MAX_SCALE = 3.0
const STEP = 0.1

const scale = ref(1.0)
const panX = ref(0)
const panY = ref(0)

let viewportEl = null
let chartEl = null
let isFitting = false
let hasPendingFit = false

export function useZoom() {
    const zoomIn = () => {
        scale.value = Math.min(MAX_SCALE, Math.round((scale.value + STEP) * 10) / 10)
    }

    const zoomOut = () => {
        scale.value = Math.max(MIN_SCALE, Math.round((scale.value - STEP) * 10) / 10)
    }

    const resetZoom = () => {
        scale.value = 1.0
        panX.value = 0
        panY.value = 0
    }

    const setScale = (value) => {
        if (!Number.isFinite(value)) return
        scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(value * 100) / 100))
    }

    const setPan = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        panX.value = x
        panY.value = y
    }

    const registerViewport = (vp, chart) => {
        viewportEl = vp
        chartEl = chart
    }

    const fitToViewport = async () => {
        if (!viewportEl || !chartEl) return
        if (isFitting) {
            hasPendingFit = true
            return
        }

        isFitting = true
        const currentChartEl = chartEl
        const prevTransform = currentChartEl.style.transform

        try {
            currentChartEl.style.transform = 'none'

            await nextTick()

            if (!viewportEl || !chartEl || chartEl !== currentChartEl) return

            const vpRect = viewportEl.getBoundingClientRect()
            const chartRect = currentChartEl.getBoundingClientRect()

            if (chartRect.width === 0 || chartRect.height === 0) return

            const padH = 40
            const padV = 30
            const availW = vpRect.width - padH
            const availH = vpRect.height - padV
            if (availW <= 0 || availH <= 0) return

            const fitScale = Math.min(
                availW / chartRect.width,
                availH / chartRect.height,
                1.0
            )
            if (!Number.isFinite(fitScale)) return

            setScale(Math.max(MIN_SCALE, fitScale))
            setPan(0, 0)
        } finally {
            currentChartEl.style.transform = prevTransform
            isFitting = false
            const shouldRefit = hasPendingFit
            hasPendingFit = false
            if (shouldRefit) {
                await fitToViewport()
            }
        }
    }

    return {
        scale,
        panX,
        panY,
        zoomIn,
        zoomOut,
        resetZoom,
        setScale,
        setPan,
        MIN_SCALE,
        MAX_SCALE,
        registerViewport,
        fitToViewport,
    }
}
