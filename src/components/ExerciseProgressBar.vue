<script setup lang="ts">
import { Footprints, PersonStanding } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useExerciseSession } from '@/composables/useExerciseSession'

const router = useRouter()
const route = useRoute()
const { status, distanceKm, elapsedSeconds, goal, currentType } = useExerciseSession()

// Na tela da sessão ativa esses mesmos dados já aparecem em detalhe —
// a barrinha aqui seria redundante.
const visible = computed(
  () => (status.value === 'active' || status.value === 'paused') && route.name !== 'exercise-active',
)

// Sem meta (ou meta de tempo, que não se aplica à distância desta barra):
// janelas de 1km rolando a partir de 0 (0-1, 1-2, 2-3...). Com meta de
// distância: mostra 0 até a meta; ao bater a meta, passa a rolar em
// janelas de 1km a partir do valor da meta.
const range = computed(() => {
  const distance = distanceKm.value
  if (goal.value && goal.value.type === 'distance') {
    if (distance < goal.value.value) {
      return { start: 0, end: goal.value.value }
    }
    const over = distance - goal.value.value
    const rollStart = goal.value.value + Math.floor(over)
    return { start: rollStart, end: rollStart + 1 }
  }
  const rollStart = Math.floor(distance)
  return { start: rollStart, end: rollStart + 1 }
})

const percent = computed(() => {
  const { start, end } = range.value
  const span = end - start
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((distanceKm.value - start) / span) * 100))
})

const statusLabel = computed(() => {
  if (currentType.value === 'run') return 'Correndo'
  if (currentType.value === 'walk') return 'Caminhando'
  return 'Parado'
})

const statusIcon = computed(() => (currentType.value === 'run' ? PersonStanding : Footprints))

function formatKm(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const mm = m.toString().padStart(2, '0')
  const ss = s.toString().padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function goToActiveSession() {
  router.push({ name: 'exercise-active' })
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="flex w-full flex-col gap-1.5 bg-primary/15 px-4 py-2.5 text-left transition-colors active:bg-primary/25"
    @click="goToActiveSession"
  >
    <div class="flex items-center justify-between text-xs font-medium text-primary">
      <span class="flex items-center gap-1.5">
        <component :is="statusIcon" :size="14" :stroke-width="2" />
        {{ statusLabel }}
      </span>
      <span>{{ formatTime(elapsedSeconds) }} · {{ formatKm(distanceKm) }} km</span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-primary/20">
      <div class="h-full rounded-full bg-primary transition-[width] duration-300" :style="{ width: `${percent}%` }" />
    </div>
    <div class="flex items-center justify-between text-[10px] text-primary/70">
      <span>{{ formatKm(range.start) }} km</span>
      <span>{{ formatKm(range.end) }} km</span>
    </div>
  </button>
</template>
