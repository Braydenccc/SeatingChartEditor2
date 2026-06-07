import { ref, unref, onUnmounted } from 'vue'
import { onLongPress, useEventListener } from '@vueuse/core'
import { useEditMode } from '@/composables/useEditMode'

export function useStudentDragging(studentRef, studentDataProp, options = {}) {
  const { onStartDrag, onEndDrag } = options
  const isStudentDragging = ref(false)
  const lastPointerWasTouch = ref(false)
  const { currentMode, EditMode } = useEditMode()
  let dragEndClassTimer = null
  let candidateBodyClassActive = false

  const shouldUseCandidateBodyClass = () => {
    if (lastPointerWasTouch.value) return false
    return typeof window === 'undefined' ||
      !window.matchMedia?.('(hover: none) and (pointer: coarse)').matches
  }

  const setCandidateDragClass = (active) => {
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
    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) return false
    if (lastPointerWasTouch.value) return false
    return canTouchDrag()
  }

  // 记录指针类型
  const handlePointerDown = (e) => {
    lastPointerWasTouch.value = e.pointerType === 'touch'
  }

  const handleTouchStart = () => {
    lastPointerWasTouch.value = true
  }

  const getEventPoint = (e) => {
    const point = e?.touches?.[0] || e?.changedTouches?.[0] || e
    const clientX = point?.clientX ?? point?.x
    const clientY = point?.clientY ?? point?.y
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null
    return { clientX, clientY }
  }

  // ============== Mouse Dragging ==============
  let htmlDragImageEl = null

  const createCardClone = () => {
    const sourceEl = unref(studentRef)
    if (!sourceEl) return null

    const rect = sourceEl.getBoundingClientRect()
    const clone = sourceEl.cloneNode(true)
    clone.classList.remove('dragging')
    clone.classList.add('touch-drag-preview-card')
    clone.removeAttribute('draggable')
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.margin = '0'
    clone.style.opacity = '1'
    clone.style.transform = 'none'
    clone.style.pointerEvents = 'none'

    return { clone, rect }
  }

  const cleanupHtmlDragImage = () => {
    if (htmlDragImageEl) {
      htmlDragImageEl.remove()
      htmlDragImageEl = null
    }
  }

  const setHtmlDragImage = (e) => {
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

  const handleDragStart = (e) => {
    if (!canHtmlDrag()) {
      e.preventDefault()
      return
    }
    setHtmlDragImage(e)
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
    if (onEndDrag) onEndDrag()
  }

  // ============== Touch Dragging (using VueUse) ==============
  let touchPreviewEl = null
  let touchMoveRafId = null

  const cleanupVisuals = () => {
    if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
    if (touchPreviewEl) { touchPreviewEl.remove(); touchPreviewEl = null }
    cleanupHtmlDragImage()
    document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
    setCandidateDragClass(false)
    if (isStudentDragging.value) {
      isStudentDragging.value = false
      if (onEndDrag) onEndDrag()
    }
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
        let cur = el
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
    let cur = targetEl
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
    document.body?.classList.remove('student-dragging-from-candidate', 'student-drag-ended-from-candidate')
    cleanupVisuals()
  })

  return {
    isStudentDragging,
    canHtmlDrag,
    handlePointerDown,
    handleTouchStart,
    handleDragStart,
    handleDragEnd
  }
}
