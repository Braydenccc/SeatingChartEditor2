import { ref } from 'vue'

const isRouteLoading = ref(false)

export function useRouteLoading() {
  return {
    isRouteLoading
  }
}
