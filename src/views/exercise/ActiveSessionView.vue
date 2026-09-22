<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppCard from '@/components/ui/AppCard.vue'
import ExerciseTimeline from '@/components/ui/ExerciseTimeline.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SpeedChart from '@/components/ui/SpeedChart.vue'
import { useExerciseSession } from '@/composables/useExerciseSession'
import { useSettingsStore } from '@/stores/useSettingsStore'

const router = useRouter()
const { settings } = useSettingsStore()
const {
  status,
  elapsedSeconds,
  distanceKm,
  currentSpeedKmh,
  avgSpeedKmh,
  speedHistory,
  liveSegments,
  currentType,
  goal,
  goalProgressPercent,
  pauseSession,
  resumeSession,
  finishSession,
} = useExerciseSession()

const confirmingFinish = ref(false)
const finishing = ref(false)

const TYPE_LABEL: Record<string, string> = { walk: 'Caminhando', run: 'Correndo', idle: 'Parado' }
const TYPE_COLOR: Record<string, string> = {
  walk: 'var(--color-accent-blue)',
  run: 'var(--color-accent-orange)',
  idle: 'var(--color-accent-gray)',
}

const elapsedFormatted = computed(() => {
  const h = Math.floor(elapsedSeconds.value / 3600)
  const m = Math.floor((elapsedSeconds.value % 3600) / 60)
  const s = elapsedSeconds.value % 60
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':')
})

const distanceFormatted = computed(() => distanceKm.value.toFixed(2).replace('.', ','))
const currentSpeedFormatted = computed(() => currentSpeedKmh.value.toFixed(1).replace('.', ','))
const avgSpeedFormatted = computed(() => avgSpeedKmh.value.toFixed(1).replace('.', ','))

const goalLabel = computed(() => {
  if (!goal.value) return ''
  if (goal.value.type === 'distance') {
    return `${distanceFormatted.value} / ${goal.value.value.toFixed(2).replace('.', ',')} km`
  }
  const currentMin = Math.floor(elapsedSeconds.value / 60)
  return `${currentMin}min / ${goal.value.value}min`
})

function togglePause() {
  if (status.value === 'active') pauseSession()
  else resumeSession()
}

async function confirmFinish() {
  finishing.value = true
  try {
    await finishSession()
    router.push({ name: 'exercise-summary' })
  } finally {
    finishing.value = false
    confirmingFinish.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <AppCard>
      <div class="mb-3 flex items-center justify-between">
        <span class="text-2xl font-bold tabular-nums text-text">{{ elapsedFormatted }}</span>
        <span
          class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          :style="{ backgroundColor: `color-mix(in srgb, ${TYPE_COLOR[currentType]} 15%, transparent)`, color: TYPE_COLOR[currentType] }"
        >
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: TYPE_COLOR[currentType] }" />
          {{ TYPE_LABEL[currentType] }}
        </span>
      </div>

      <p class="text-4xl font-bold text-text">{{ distanceFormatted }} km</p>
      <p class="mb-4 text-sm text-text-muted">distância</p>

      <div class="flex gap-6 text-sm">
        <span class="text-text-muted">Atual: <strong class="text-text">{{ currentSpeedFormatted }} km/h</strong></span>
        <span class="text-text-muted">Média: <strong class="text-text">{{ avgSpeedFormatted }} km/h</strong></span>
      </div>
    </AppCard>

    <AppCard v-if="goal" title="Meta">
      <ProgressBar :percent="goalProgressPercent" />
      <p class="mt-2 text-sm text-text-muted">{{ goalLabel }}</p>
    </AppCard>

    <AppCard title="Velocidade">
      <SpeedChart
        :points="speedHistory"
        :walk-max-speed-kmh="settings.walkMaxSpeedKmh"
        :run-min-speed-kmh="settings.runMinSpeedKmh"
      />
    </AppCard>

    <AppCard title="Segmentos">
      <ExerciseTimeline
        :segments="
          liveSegments.map((s) => ({ type: s.type, startedAt: s.startedAt, durationS: s.durationS }))
        "
      />
    </AppCard>

    <div class="grid grid-cols-2 gap-3">
      <button
        type="button"
        class="rounded-2xl border border-border py-3 text-sm font-semibold text-text"
        @click="togglePause"
      >
        {{ status === 'active' ? 'Pausar' : 'Retomar' }}
      </button>
      <button
        type="button"
        class="rounded-2xl bg-danger py-3 text-sm font-semibold text-white"
        @click="confirmingFinish = true"
      >
        Encerrar
      </button>
    </div>

    <div v-if="confirmingFinish" class="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm rounded-[20px] bg-surface p-5">
        <p class="mb-4 text-sm font-medium text-text">Encerrar a sessão de exercício?</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="rounded-xl border border-border py-2.5 text-sm font-medium text-text"
            @click="confirmingFinish = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-danger py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="finishing"
            @click="confirmFinish"
          >
            {{ finishing ? 'Encerrando…' : 'Encerrar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
