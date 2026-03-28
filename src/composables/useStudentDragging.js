import { ref, unref, onUnmounted } from 'vue'
import { onLongPress, useEventListener } from '@vueuse/core'
import { useEditMode } from '@/composables/useEditMode'

export function useStudentDragging(studentRef, studentDataProp, options = {}) {
  const { onStartDrag, onEndDrag } = options
  const isStudentDragging = ref(false)
  const lastPointerWasTouch = ref(false)
  const { currentMode, EditMode } = useEditMode()

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
  const handlePointerDown = (e) => {
    lastPointerWasTouch.value = e.pointerType === 'touch'
  }

  // ============== Mouse Dragging ==============
  const handleDragStart = (e) => {
    if (!canHtmlDrag()) {
      e.preventDefault()
      return
    }
    isStudentDragging.value = true
    if (onStartDrag) onStartDrag()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'student',
      studentId: unref(studentDataProp).id
    }))
  }

  const handleDragEnd = () => {
    isStudentDragging.value = false
    if (onEndDrag) onEndDrag()
  }

  // ============== Touch Dragging (using VueUse) ==============
  let touchPreviewEl = null
  let touchMoveRafId = null

  const cleanupVisuals = () => {
    if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
    if (touchPreviewEl) { touchPreviewEl.remove(); touchPreviewEl = null }
    document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
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

      isStudentDragging.value = true
      if (onStartDrag) onStartDrag()
      
      const touch = e.touches ? e.touches[0] : e
      const startX = touch.clientX || touch.x
      const startY = touch.clientY || touch.y
      
      touchPreviewEl = document.createElement('div')
      touchPreviewEl.className = 'touch-drag-preview'
      touchPreviewEl.textContent = unref(studentDataProp).name || '未命名'
      touchPreviewEl.style.cssText = `
        position: fixed;
        left: ${startX - 40}px;
        top: ${startY - 25}px;
        min-width: 80px;
        padding: 8px 16px;
        background: rgba(35, 88, 123, 0.92);
        color: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        pointer-events: none;
        z-index: 9999;
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        transform: scale(0.8);
        opacity: 0;
        will-change: transform, left, top;
        transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s ease;
      `
      document.body.appendChild(touchPreviewEl)
      
      requestAnimationFrame(() => {
        if (touchPreviewEl) {
          touchPreviewEl.style.transform = 'scale(1)'
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

    const touch = e.touches[0]
    const cx = touch.clientX
    const cy = touch.clientY

    if (touchMoveRafId) cancelAnimationFrame(touchMoveRafId)
    touchMoveRafId = requestAnimationFrame(() => {
      touchMoveRafId = null
      if (touchPreviewEl) {
        touchPreviewEl.style.transition = 'none'
        touchPreviewEl.style.left = `${cx - 40}px`
        touchPreviewEl.style.top = `${cy - 25}px`
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

    const touch = e.changedTouches[0]
    if (touchPreviewEl) touchPreviewEl.style.display = 'none'
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
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
    cleanupVisuals()
  })

  return {
    isStudentDragging,
    canHtmlDrag,
    handlePointerDown,
    handleDragStart,
    handleDragEnd
  }
}
