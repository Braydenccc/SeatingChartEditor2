import { computed, defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStudentDragging } from '../useStudentDragging'

vi.mock('@/composables/useEditMode', () => ({
  useEditMode: () => ({
    currentMode: ref('NORMAL'),
    EditMode: { NORMAL: 'NORMAL' }
  })
}))

const TestCandidate = defineComponent({
  props: {
    studentId: {
      type: Number,
      required: true
    }
  },
  setup(props) {
    const itemRef = ref(null)
    useStudentDragging(itemRef, computed(() => ({ id: props.studentId })))
    return { itemRef }
  },
  template: '<div ref="itemRef" class="candidate-item">学生</div>'
})

describe('useStudentDragging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not register document touch listeners for every mounted candidate', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    const wrappers = Array.from({ length: 20 }, (_, index) => (
      mount(TestCandidate, {
        props: { studentId: index + 1 },
        attachTo: document.body
      })
    ))

    const documentTouchListeners = addEventListenerSpy.mock.calls.filter(([type]) => (
      type === 'touchmove' || type === 'touchend' || type === 'touchcancel'
    ))

    expect(documentTouchListeners).toHaveLength(0)

    wrappers.forEach(wrapper => wrapper.unmount())
  })
})
