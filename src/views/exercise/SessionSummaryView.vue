<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppCard from '@/components/ui/AppCard.vue'
import ExerciseTimeline from '@/components/ui/ExerciseTimeline.vue'
import SpeedChart from '@/components/ui/SpeedChart.vue'
import { useExerciseSession } from '@/composables/useExerciseSession'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { saveSession } from '@/services/activityService'

const router = useRouter()
const { settings } = useSettingsStore()
const { lastFinishedSession, speedHistory, resetSession } = useExerciseSession()

const saving = ref(false)
const session = lastFinishedSession

const durationFormatted = computed(() => {
  if (!session.value) return '--'
  const totalSeconds = Math.round(session.value.totalMinutes * 60)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0
    ? `${h}h${m.toString().padStart(2, '0')}min`
    : `${m}min${s.toString().padStart(2, '0')}s`
})

const distanceFormatted = computed(() => (session.value ? session.value.distanceKm.toFixed(2).replace('.', ',') : '0'))
const avgSpeedFormatted = computed(() =>
  session.value ? session.value.avgSpeedKmh.toFixed(1).replace('.', ',') : '0',
)
const caloriesFormatted = computed(() => (session.value ? Math.round(session.value.calories) : 0))

async function handleSave() {
  if (!session.value) return
  saving.value = true
  try {
    await saveSession(session.value)
    resetSession()
    router.push({ name: 'exercises' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="session" class="flex flex-col gap-4 p-4">
    <AppCard title="Resumo">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-text-muted">Duração</p>
          <p class="text-lg font-semibold text-text">{{ durationFormatted }}</p>
        </div>
        <div>
          <p class="text-xs text-text-muted">Distância</p>
          <p class="text-lg font-semibold text-text">{{ distanceFormatted }} km</p>
        </div>
        <div>
          <p class="text-xs text-text-muted">Velocidade média</p>
          <p class="text-lg font-semibold text-text">{{ avgSpeedFormatted }} km/h</p>
        </div>
        <div>
          <p class="text-xs text-text-muted">Calorias (estimado)</p>
          <p class="text-lg font-semibold text-text">{{ caloriesFormatted }} kcal</p>
        </div>
      </div>
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
        :segments="session.segments.map((s) => ({ type: s.type, startedAt: s.startedAt, durationS: s.durationS }))"
      />
    </AppCard>

    <button
      type="button"
      class="rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-contrast disabled:opacity-60"
      :disabled="saving"
      @click="handleSave"
    >
      {{ saving ? 'Salvando…' : 'Salvar' }}
    </button>
  </div>
  <p v-else class="p-4 text-sm text-text-muted">Nenhuma sessão para exibir.</p>
</template>
