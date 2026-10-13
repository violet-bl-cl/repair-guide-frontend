import DevicePartList from '@/views/DevicePartList.vue'
import { createRouter, createWebHistory } from 'vue-router'
import AboutRepair from '../views/AboutRepair.vue'
import DeviceScanner from '../views/DeviceScan.vue'
import DashBoard from '@/views/DashBoard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/part-repair',
      name: 'repair',
      component: AboutRepair,
    },
    {
      path: '/part-scan',
      name: 'device-scanner',
      component: DeviceScanner,
    },
    {
      path: '/part-list',
      name: 'century-parts',
      component: DevicePartList,
    },
    {
      path: '/',
      name: 'main',
      component: DashBoard,
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
