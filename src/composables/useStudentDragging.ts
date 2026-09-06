import { ref, unref, onUnmounted } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { onLongPress, useEventListener } from '@vueuse/core'
import { useEditMode } from '@/composables/useEditMode'
import { useDragState } from '@/composables/useDragState'
import type { Student } from '@/types/models'

interface StudentDraggingOptions {
  onStartDrag?: () => void
  onEndDrag?: () => void
}

export function useStudentDragging(
  studentRef: Ref<HTMLElement | null>,
  studentDataProp: Ref<Student> | ComputedRef<Student>,
  options: StudentDraggingOptions = {}
) {
  const { onStartDrag, onEndDrag } = options
  const isStudentDragging = ref(false)
  const lastPointerWasTouch = ref(false)
  const { currentMode, EditMode } = useEditMode()
  const { requestDragCleanup } = useDragState()
  let dragEndClassTimer: ReturnType<typeof setTimeout> | null = null
  let candidateBodyClassActive = false
  let suppressNextClick = false
  let suppressClickTimer: ReturnType<typeof setTimeout> | null = null

  const isTouchLikePointer = (e: PointerEvent) => {
    return e.pointerType === 'touch' || e.pointerType === 'pen'
  }

  const shouldUseCandidateBodyClass = () => {
    return !lastPointerWasTouch.value
  }

  const setCandidateDragClass = (active: boolean) => {
    if (!document.body) return
    if (active) {
      if (!shouldUseCandidateBodyClass()) return
      if (dragEndClassTimer) {
        clearTimeout(dragEndClassTimer)
        dragEndClassTimer = null
      }
      candidateBodyClassActive = true
      document.body.classList.add('student-dragging-from-candidate')
      document.body.classList.remove('student-drag-ended-from-candidate')
      return
    }
    document.body.classList.remove('student-dragging-from-candidate')
    if (!candidateBodyClassActive) return
    candidateBodyClassActive = false
    document.body.classList.add('student-drag-ended-from-candidate')
    dragEndClassTimer = setTimeout(() => {
      document.body?.classList.remove('student-drag-ended-from-candidate')
      dragEndClassTimer = null
    }, 400)
  }

  // 触摸拖拽激活条件
  const canTouchDrag = () => {
    return currentMode.value === EditMode.NORMAL
  }

  // HTML5 draggable 属性：触摸操作时禁用，防止幽灵图
  const canHtmlDrag = () => {
    if (lastPointerWasTouch.value) return false
    return canTouchDrag()
  }

  // 记录指针类型
  const handlePointerDown = (e: PointerEvent) => {
    lastPointerWasTouch.value = isTouchLikePointer(e)
  }

  const handleTouchStart = () => {
    lastPointerWasTouch.value = true
  }

  const getEventPoint = (e: TouchEvent | MouseEvent | PointerEvent) => {
    const touch = 'touches' in e
      ? e.touches.item(0) ?? e.changedTouches.item(0)
      : null
    const clientX = touch?.clientX ?? ('clientX' in e ? e.clientX : Number.NaN)
    const clientY = touch?.clientY ?? ('clientY' in e ? e.clientY : Number.NaN)
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null
    return { clientX, clientY }
  }

  // ============== Mouse Dragging ==============
  let htmlDragImageEl: HTMLElement | null = null

  const createCardClone = () => {
    const sourceEl = unref(studentRef)
    if (!sourceEl) return null

    const rect = sourceEl.getBoundingClientRect()
    const previewSize = { width: rect.width, height: rect.height }
    const clone = sourceEl.cloneNode(true)
    if (!(clone instanceof HTMLElement)) return null
    clone.classList.remove('dragging')
    clone.classList.add('touch-drag-preview-card')
    clone.removeAttribute('draggable')
    clone.style.width = `${previewSize.width}px`
    clone.style.height = `${previewSize.height}px`
    clone.style.margin = '0'
    clone.style.opacity = '1'
    clone.style.transform = 'none'
    clone.style.pointerEvents = 'none'
    clone.style.boxSizing = 'border-box'

    return { clone, rect: previewSize }
  }

  const cleanupHtmlDragImage = () => {
    if (htmlDragImageEl) {
      htmlDragImageEl.remove()
      htmlDragImageEl = null
    }
  }

  const setHtmlDragImage = (e: DragEvent) => {
    if (!e.dataTransfer) return
    cleanupHtmlDragImage()
    const preview = createCardClone()
    if (!preview) return

    htmlDragImageEl = preview.clone
    htmlDragImageEl.style.position = 'fixed'
    htmlDragImageEl.style.left = `${Math.max(0, e.clientX - preview.rect.width / 2)}px`
    htmlDragImageEl.style.top = `${Math.max(0, e.clientY - preview.rect.height / 2)}px`
    htmlDragImageEl.style.zIndex = '9999'
    document.body.appendChild(htmlDragImageEl)
    e.dataTransfer.setDragImage(htmlDragImageEl, preview.rect.width / 2, preview.rect.height / 2)

    requestAnimationFrame(() => {
      if (htmlDragImageEl) {
        htmlDragImageEl.style.visibility = 'hidden'
      }
    })
  }

  const handleDragStart = (e: DragEvent) => {
    if (!canHtmlDrag()) {
      e.preventDefault()
      return
    }
    setHtmlDragImage(e)
    if (!e.dataTransfer) return
    isStudentDragging.value = true
    setCandidateDragClass(true)
    if (onStartDrag) onStartDrag()
    e.dataTransfer.effectAllowed = 'move'
    const dragData = JSON.stringify({
      type: 'student',
      studentId: unref(studentDataProp).id
    })
    e.dataTransfer.setData('application/json', dragData)
    e.dataTransfer.setData('text/plain', dragData)
  }

  const handleDragEnd = () => {
    isStudentDragging.value = false
    setCandidateDragClass(false)
    cleanupHtmlDragImage()
    requestDragCleanup()
    if (onEndDrag) onEndDrag()
  }

  // ============== Touch Dragging (using VueUse) ==============
  let touchPreviewEl: HTMLElement | null = null
  let touchMoveRafId: number | null = null

  const cleanupVisuals = () => {
    if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
    if (touchPreviewEl) { touchPreviewEl.remove(); touchPreviewEl = null }
    cleanupHtmlDragImage()
    document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
    document.querySelectorAll('.student-items.drag-over').forEach(s => s.classList.remove('drag-over'))
    requestDragCleanup()
    setCandidateDragClass(false)
    if (isStudentDragging.value) {
      suppressNextClick = true
      if (suppressClickTimer) {
        clearTimeout(suppressClickTimer)
        suppressClickTimer = null
      }
      suppressClickTimer = setTimeout(() => {
        suppressNextClick = false
        suppressClickTimer = null
      }, 450)
      isStudentDragging.value = false
      if (onEndDrag) onEndDrag()
    }
  }

  const consumeSuppressedClick = () => {
    if (!suppressNextClick) return false
    suppressNextClick = false
    if (suppressClickTimer) {
      clearTimeout(suppressClickTimer)
      suppressClickTimer = null
    }
    return true
  }

  // 核心优化：使用 VueUse 的 onLongPress 替代原生 setTimeout 与距离防抖计算
  onLongPress(
    studentRef,
    (e) => {
      // 仅在指定模式下激活触摸拖拽
      if (!canTouchDrag() || !lastPointerWasTouch.value) return

      const preview = createCardClone()
      if (!preview) return

      const startPoint = getEventPoint(e)
      if (!startPoint) return

      isStudentDragging.value = true
      setCandidateDragClass(true)
      if (onStartDrag) onStartDrag()

      touchPreviewEl = document.createElement('div')
      touchPreviewEl.className = 'touch-drag-preview'
      touchPreviewEl.appendChild(preview.clone)
      touchPreviewEl.style.cssText = `
        left: ${startPoint.clientX}px;
        top: ${startPoint.clientY}px;
        transform: translate(-50%, -50%) scale(0.92);
        opacity: 0;
      `
      document.body.appendChild(touchPreviewEl)

      requestAnimationFrame(() => {
        if (touchPreviewEl) {
          touchPreviewEl.style.transform = 'translate(-50%, -50%) scale(1)'
          touchPreviewEl.style.opacity = '1'
        }
      })

      if (navigator.vibrate) navigator.vibrate(30)
    },
    { delay: 300, distanceThreshold: 8 }
  )

  // 使用 VueUse 的生命周期安全版事件监听
  useEventListener(document, 'touchmove', (e) => {
    if (!unref(isStudentDragging) || !touchPreviewEl || !lastPointerWasTouch.value) return

    // 拖拽激活后接管滚动，防止屏幕滑动
    e.preventDefault()

    const point = getEventPoint(e)
    if (!point) return
    const cx = point.clientX
    const cy = point.clientY

    if (touchMoveRafId) cancelAnimationFrame(touchMoveRafId)
    touchMoveRafId = requestAnimationFrame(() => {
      touchMoveRafId = null
      if (touchPreviewEl) {
        touchPreviewEl.style.transition = 'none'
        touchPreviewEl.style.left = `${cx}px`
        touchPreviewEl.style.top = `${cy}px`
      }

      const el = document.elementFromPoint(cx, cy)
      document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
      if (el) {
        let cur: HTMLElement | null = el instanceof HTMLElement ? el : el.parentElement
        while (cur && !cur.dataset?.seatId) cur = cur.parentElement
        if (cur) cur.classList.add('drag-over')
      }
    })
  }, { passive: false })

  useEventListener(document, 'touchend', (e) => {
    if (!unref(isStudentDragging) || !lastPointerWasTouch.value) {
      cleanupVisuals()
      return
    }

    const point = getEventPoint(e)
    if (!point) {
      cleanupVisuals()
      return
    }
    if (touchPreviewEl) touchPreviewEl.style.display = 'none'
    const targetEl = document.elementFromPoint(point.clientX, point.clientY)
    cleanupVisuals()

    if (!targetEl) return
    let cur: HTMLElement | null = targetEl instanceof HTMLElement ? targetEl : targetEl.parentElement
    while (cur && !cur.dataset?.seatId) cur = cur.parentElement
    if (!cur) return

    const event = new CustomEvent('touch-student-drop', {
      bubbles: true,
      detail: { studentId: unref(studentDataProp).id, targetSeatId: cur.dataset.seatId }
    })
    cur.dispatchEvent(event)
  })

  useEventListener(document, 'touchcancel', () => {
    cleanupVisuals()
  })

  onUnmounted(() => {
    if (dragEndClassTimer) {
      clearTimeout(dragEndClassTimer)
      dragEndClassTimer = null
    }
    if (suppressClickTimer) {
      clearTimeout(suppressClickTimer)
      suppressClickTimer = null
    }
    document.body?.classList.remove('student-dragging-from-candidate', 'student-drag-ended-from-candidate')
    cleanupVisuals()
  })

  return {
    isStudentDragging,
    lastPointerWasTouch,
    canHtmlDrag,
    consumeSuppressedClick,
    handlePointerDown,
    handleTouchStart,
    handleDragStart,
    handleDragEnd
  }
}
