<script setup lang="ts">
import { Check, Circle, Dumbbell } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import AppCard from '@/components/ui/AppCard.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import WeeklyBarChart, { type WeeklyBar } from '@/components/ui/WeeklyBarChart.vue'
import { getAdherenceByDateRange, getOrCreateDailyLog, type DayAdherence } from '@/services/dailyLogService'
import { getActivePlan } from '@/services/planService'
import { listPlanSupplements, listSupplementLogs, type PlanSupplement } from '@/services/supplementService'
import { listRecentSessions, type SessionWithSegments } from '@/services/activityService'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { addDaysIso, startOfMonthIso, startOfWeekIso, todayIso, WEEKDAY_LABELS } from '@/utils/date'
import { estimateAverageSpeedKmh } from '@/utils/speed'

const { settings } = useSettingsStore()

const monthlyStats = ref<{ done: number; total: number }>({ done: 0, total: 0 })
const weeklyStats = ref<{ done: number; total: number }>({ done: 0, total: 0 })
const weeklyBars = ref<WeeklyBar[]>([])
const supplements = ref<PlanSupplement[]>([])
const supplementStatus = ref<Record<number, boolean>>({})
const recentSessions = ref<SessionWithSegments[]>([])
const loading = ref(true)

const monthlyPercent = computed(() =>
  monthlyStats.value.total > 0 ? (monthlyStats.value.done / monthlyStats.value.total) * 100 : 0,
)
const weeklyPercent = computed(() =>
  weeklyStats.value.total > 0 ? (weeklyStats.value.done / weeklyStats.value.total) * 100 : 0,
)

function sumAdherence(days: DayAdherence[]): { done: number; total: number } {
  return days.reduce(
    (acc, day) => ({ done: acc.done + day.done, total: acc.total + day.total }),
    { done: 0, total: 0 },
  )
}

function formatMinutes(totalMinutes: number | null): string {
  if (!totalMinutes) return '0min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function averageSpeed(session: SessionWithSegments): string {
  const speed =
    session.avg_speed_kmh ??
    estimateAverageSpeedKmh(session.segments, settings.walkMaxSpeedKmh, settings.runMinSpeedKmh)
  return speed.toFixed(1).replace('.', ',')
}

async function load() {
  loading.value = true
  try {
    const today = todayIso()
    const monthStart = startOfMonthIso(today)
    const weekStart = startOfWeekIso(today)

    const [monthDays, weekDays, activePlan, sessions] = await Promise.all([
      getAdherenceByDateRange(monthStart, today),
      getAdherenceByDateRange(weekStart, addDaysIso(weekStart, 6)),
      getActivePlan(),
      listRecentSessions(3),
    ])

    monthlyStats.value = sumAdherence(monthDays)
    weeklyStats.value = sumAdherence(weekDays)

    weeklyBars.value = WEEKDAY_LABELS.map((label, index) => {
      const dateIso = addDaysIso(weekStart, index)
      const day = weekDays.find((d) => d.log_date === dateIso)
      const percent = day && day.total > 0 ? (day.done / day.total) * 100 : 0
      return { label, percent }
    })

    recentSessions.value = sessions

    if (activePlan) {
      supplements.value = await listPlanSupplements(activePlan.id)
      const dailyLog = await getOrCreateDailyLog(today, activePlan.id)
      const logs = await listSupplementLogs(dailyLog.id)
      supplementStatus.value = Object.fromEntries(
        logs.map((log) => [log.plan_supplement_id, log.status === 'done']),
      )
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <AppCard title="Este mês">
      <p class="text-3xl font-bold text-text">{{ Math.round(monthlyPercent) }}%</p>
      <p class="mb-3 text-sm text-text-muted">de adesão ao plano</p>
      <ProgressBar :percent="monthlyPercent" />
      <p class="mt-2 text-xs text-text-muted">
        {{ monthlyStats.done }} de {{ monthlyStats.total }} refeições realizadas
      </p>
    </AppCard>

    <AppCard title="Esta semana">
      <p class="text-3xl font-bold text-text">{{ Math.round(weeklyPercent) }}%</p>
      <p class="mb-3 text-sm text-text-muted">
        {{ weeklyStats.done }} de {{ weeklyStats.total }} refeições
      </p>
      <WeeklyBarChart :bars="weeklyBars" />
    </AppCard>

    <AppCard title="Suplementos de hoje">
      <p v-if="!supplements.length" class="text-sm text-text-muted">Nenhum plano ativo com suplementos.</p>
      <ul v-else class="divide-y divide-divider">
        <li
          v-for="supplement in supplements"
          :key="supplement.id"
          class="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
        >
          <div>
            <p class="text-sm font-medium text-text">{{ supplement.name }}</p>
            <p class="text-xs text-text-muted">{{ supplement.dose ?? '—' }}</p>
          </div>
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full"
            :class="supplementStatus[supplement.id] ? 'bg-primary/15 text-primary' : 'text-text-muted'"
          >
            <Check v-if="supplementStatus[supplement.id]" :size="18" :stroke-width="2.5" />
            <Circle v-else :size="18" :stroke-width="1.75" />
          </span>
        </li>
      </ul>
    </AppCard>

    <AppCard title="Exercícios recentes">
      <p v-if="!recentSessions.length" class="text-sm text-text-muted">Nenhuma sessão registrada ainda.</p>
      <ul v-else class="divide-y divide-divider">
        <li
          v-for="session in recentSessions"
          :key="session.id"
          class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-alt text-primary">
            <Dumbbell :size="18" :stroke-width="1.75" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-text">{{ formatDate(session.started_at) }}</p>
            <p class="text-xs text-text-muted">
              {{ formatMinutes(session.total_minutes) }} ·
              Média {{ averageSpeed(session) }} km/h
            </p>
          </div>
        </li>
      </ul>
    </AppCard>
  </div>
</template>
