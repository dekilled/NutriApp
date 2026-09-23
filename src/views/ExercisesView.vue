<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppCard from '@/components/ui/AppCard.vue'
import ExerciseTimeline from '@/components/ui/ExerciseTimeline.vue'
import { listRecentSessions, type SessionWithSegments } from '@/services/activityService'
import { useActivityStore } from '@/stores/useActivityStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { estimateAverageSpeedKmh } from '@/utils/speed'

const router = useRouter()
const activity = useActivityStore()
const { settings } = useSettingsStore()
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
  const speed =
    session.avg_speed_kmh ??
    estimateAverageSpeedKmh(session.segments, settings.walkMaxSpeedKmh, settings.runMinSpeedKmh)
  return speed.toFixed(1).replace('.', ',')
}

function distance(session: SessionWithSegments): string | null {
  if (session.distance_km === null) return null
  return session.distance_km.toFixed(2).replace('.', ',')
}

function startNewSession() {
  router.push({ name: 'exercise-new' })
}

onMounted(async () => {
  // Já tem uma sessão rodando (ou pausada)? Não faz sentido mostrar a
  // lista — volta direto pra ela, já que não existe outro link na UI
  // pra chegar lá de novo.
  if (activity.status === 'active' || activity.status === 'paused') {
    router.replace({ name: 'exercise-active' })
    return
  }

  try {
    sessions.value = await listRecentSessions(50)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-border py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-alt"
      @click="startNewSession"
    >
      <Plus :size="18" :stroke-width="2" />
      Novo exercício
    </button>

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
          <p class="text-xs text-text-muted">
            <template v-if="distance(session)">{{ distance(session) }} km · </template>
            Média {{ averageSpeed(session) }} km/h
          </p>
        </div>
      </div>

      <ExerciseTimeline
        :segments="
          session.segments.map((s) => ({
            type: s.type,
            startedAt: s.started_at,
            durationS: s.duration_s ?? 0,
          }))
        "
      />
    </AppCard>
  </div>
</template>
