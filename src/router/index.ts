import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Nutri Routine' },
  },
  {
    path: '/products',
    name: 'products',
    component: () => import('@/views/ProductsView.vue'),
    meta: { title: 'Produtos' },
  },
  {
    path: '/exercises',
    name: 'exercises',
    component: () => import('@/views/ExercisesView.vue'),
    meta: { title: 'Exercícios' },
  },
  {
    path: '/exercises/new',
    name: 'exercise-new',
    component: () => import('@/views/exercise/NewExerciseView.vue'),
    meta: { title: 'Novo exercício' },
  },
  {
    path: '/exercises/active',
    name: 'exercise-active',
    component: () => import('@/views/exercise/ActiveSessionView.vue'),
    meta: { title: 'Exercício em andamento' },
  },
  {
    path: '/exercises/summary',
    name: 'exercise-summary',
    component: () => import('@/views/exercise/SessionSummaryView.vue'),
    meta: { title: 'Resumo do exercício' },
  },
  {
    path: '/daily-log',
    name: 'daily-log',
    component: () => import('@/views/DailyLogView.vue'),
    meta: { title: 'Registro diário' },
  },
  {
    path: '/plans',
    name: 'plans',
    component: () => import('@/views/PlansView.vue'),
    meta: { title: 'Planos' },
  },
  {
    path: '/plans/:id',
    name: 'plan-detail',
    component: () => import('@/views/PlanDetailView.vue'),
    meta: { title: 'Detalhes do plano' },
    props: true,
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Configurações' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
