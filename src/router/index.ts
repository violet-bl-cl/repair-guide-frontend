import { createRouter, createWebHistory } from 'vue-router'
import AboutRepair from '../views/AboutRepair.vue'
import DeviceScanner from '../views/DeviceScan.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'repair',
      component: AboutRepair,
    },
    {
      path: '/scan',
      name: 'device-scanner',
      component: DeviceScanner,
    },
    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/AboutView.vue'),
    // },
  ],
})

export default router
