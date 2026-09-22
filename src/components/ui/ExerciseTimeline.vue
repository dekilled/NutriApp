<script setup lang="ts">
import { Footprints, PersonStanding, Pause } from 'lucide-vue-next'
import { computed } from 'vue'

export interface TimelineSegment {
  type: 'walk' | 'run' | 'idle'
  startedAt: string
  durationS: number
}

const props = defineProps<{ segments: TimelineSegment[] }>()

const SEGMENT_META = {
  walk: { label: 'Cam.', color: 'var(--color-accent-blue)', icon: Footprints },
  run: { label: 'Corr.', color: 'var(--color-accent-orange)', icon: PersonStanding },
  idle: { label: 'Par.', color: 'var(--color-accent-gray)', icon: Pause },
} as const

const totalDuration = computed(() =>
  Math.max(
    1,
    props.segments.reduce((sum, segment) => sum + segment.durationS, 0),
  ),
)

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="segments.length" class="w-full">
    <div class="flex w-full items-end gap-[2px]">
      <div
        v-for="(segment, index) in segments"
        :key="index"
        class="flex min-w-0 flex-col items-center"
        :style="{ flexGrow: segment.durationS / totalDuration, flexBasis: 0 }"
      >
        <span class="mb-1 flex items-center gap-0.5 truncate text-[10px] font-medium text-text-muted">
          <component :is="SEGMENT_META[segment.type].icon" :size="12" :stroke-width="2.25" />
          {{ SEGMENT_META[segment.type].label }}
        </span>
        <div
          class="h-2 w-full rounded-full"
          :style="{ backgroundColor: SEGMENT_META[segment.type].color }"
        />
        <span class="mt-1 truncate text-[10px] text-text-muted">{{ formatTime(segment.startedAt) }}</span>
      </div>
    </div>
  </div>
  <p v-else class="text-sm text-text-muted">Sem segmentos registrados.</p>
</template>
