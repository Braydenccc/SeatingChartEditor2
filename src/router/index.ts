import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/editor' },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('@/views/EditorView.vue')
    },
    {
      path: '/files',
      name: 'files',
      component: () => import('@/views/FilesView.vue')
    },
    {
      path: '/user',
      name: 'user',
      component: () => import('@/views/UserView.vue')
    },
    {
      path: '/students',
      name: 'students',
      component: () => import('@/views/StudentsView.vue')
    },
    {
      path: '/export',
      name: 'export',
      component: () => import('@/views/ExportView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/editor' }
  ]
})

export default router
