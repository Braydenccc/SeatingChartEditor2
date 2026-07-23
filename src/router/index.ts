import { createRouter, createWebHashHistory } from 'vue-router'
import { nextTick } from 'vue'
import { useRouteLoading } from '@/composables/useRouteLoading'

export const shouldFocusRouteHeading = (
  to: { path: string },
  from: { path: string; matched: readonly unknown[] }
) => from.matched.length > 0 && to.path !== from.path

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/editor' },
    {
      path: '/editor',
      name: 'editor',
      meta: { title: '座位编辑' },
      component: () => import('@/views/EditorView.vue')
    },
    {
      path: '/files',
      name: 'files',
      meta: { title: '文件' },
      component: () => import('@/views/FilesView.vue')
    },
    {
      path: '/user',
      name: 'user',
      meta: { title: '账号中心' },
      component: () => import('@/views/UserView.vue')
    },
    {
      path: '/students',
      name: 'students',
      meta: { title: '学生' },
      component: () => import('@/views/StudentsView.vue')
    },
    {
      path: '/export',
      name: 'export',
      meta: { title: '导出' },
      component: () => import('@/views/ExportView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      meta: { title: '设置' },
      component: () => import('@/views/SettingsView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/editor' }
  ]
})

const { isRouteLoading } = useRouteLoading()

router.beforeEach((to, from) => {
  if (to.fullPath !== from.fullPath) {
    isRouteLoading.value = true
  }
})

router.afterEach(async (to, from) => {
  isRouteLoading.value = false

  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} - BraydenSCE V2` : 'BraydenSCE V2'

  if (!shouldFocusRouteHeading(to, from)) return
  await nextTick()
  document.querySelector<HTMLElement>('[data-route-heading]')?.focus({ preventScroll: true })
})

router.onError(() => {
  isRouteLoading.value = false
})

export default router
