<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AppCard from '@/components/ui/AppCard.vue'
import ExerciseTimeline from '@/components/ui/ExerciseTimeline.vue'
import { listRecentSessions, type SessionWithSegments } from '@/services/activityService'
import { useSettings } from '@/composables/useSettings'
import { estimateAverageSpeedKmh } from '@/utils/speed'

const { settings } = useSettings()
const sessions = ref<SessionWithSegments[]>([])
const loading = ref(true)

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatMinutes(totalMinutes: number | null): string {
  if (!totalMinutes) return '0min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`
}

function averageSpeed(session: SessionWithSegments): string {
  return estimateAverageSpeedKmh(session.segments, settings.walkMaxSpeedKmh, settings.runMinSpeedKmh)
    .toFixed(1)
    .replace('.', ',')
}

onMounted(async () => {
  try {
    sessions.value = await listRecentSessions(50)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <p v-if="!loading && !sessions.length" class="text-sm text-text-muted">
      Nenhuma sessão de exercício registrada ainda.
    </p>

    <AppCard v-for="session in sessions" :key="session.id">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-text">{{ formatDateTime(session.started_at) }}</p>
          <p class="text-xs text-text-muted">
            {{ formatTime(session.started_at) }} – {{ formatTime(session.ended_at) }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-text">{{ formatMinutes(session.total_minutes) }}</p>
          <p class="text-xs text-text-muted">Média {{ averageSpeed(session) }} km/h</p>
        </div>
      </div>

      <ExerciseTimeline
        :segments="
          session.segments.map((s) => ({
            type: (s.type as 'walk' | 'run' | 'idle'),
            startedAt: s.started_at,
            durationS: s.duration_s ?? 0,
          }))
        "
      />
    </AppCard>
  </div>
</template>
