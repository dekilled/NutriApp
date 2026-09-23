<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import ExerciseProgressBar from '@/components/ExerciseProgressBar.vue'
import { useActivityStore } from '@/stores/useActivityStore'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // Se o app foi relançado (processo morto em background) com uma sessão
  // de exercício restaurada do localStorage, leva o usuário direto pra
  // tela dela em vez de deixar rodando escondida em background.
  const activity = useActivityStore()
  const hasRestoredSession = activity.status === 'active' || activity.status === 'paused'
  if (hasRestoredSession && route.name !== 'exercise-active') {
    router.replace({ name: 'exercise-active' })
  }
})
</script>

<template>
  <div class="flex h-full flex-col bg-bg text-text">
    <AppHeader />
    <ExerciseProgressBar />
    <main class="flex-1 overflow-y-auto pb-24">
      <RouterView />
    </main>
    <div class="fixed inset-x-0 bottom-0 z-20">
      <BottomNav />
    </div>
  </div>
</template>
