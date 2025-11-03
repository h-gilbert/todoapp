import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import { useAppStore } from '../stores/app'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/projects',
      name: 'projects',
      component: ProjectsView,
      meta: { requiresAuth: true }
    }
  ]
})

// Navigation guard to check authentication
router.beforeEach((to, from, next) => {
  const store = useAppStore()
  const isAuthenticated = !!store.user

  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect to login if trying to access protected route without auth
    next({ name: 'login' })
  } else if (to.meta.requiresGuest && isAuthenticated) {
    // Redirect to projects if trying to access login while already authenticated
    next({ name: 'projects' })
  } else {
    next()
  }
})

export default router
