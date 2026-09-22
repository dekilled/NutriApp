<script setup lang="ts">
export interface WeeklyBar {
  label: string
  percent: number
}

defineProps<{ bars: WeeklyBar[] }>()

const CHART_HEIGHT = 56

function clampedPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}
</script>

<template>
  <div class="grid grid-cols-7 items-end gap-2" :style="{ height: `${CHART_HEIGHT}px` }">
    <div
      v-for="bar in bars"
      :key="bar.label"
      class="flex h-full items-end justify-center"
      :title="`${bar.label}: ${Math.round(bar.percent)}%`"
    >
      <div
        class="w-2.5 rounded-full transition-[height] duration-300"
        :class="bar.percent >= 100 ? 'bg-primary' : 'bg-accent-blue'"
        :style="{
          height: `${Math.max(3, clampedPercent(bar.percent))}%`,
          opacity: bar.percent === 0 ? 0.25 : 1,
        }"
      />
    </div>
  </div>
  <div class="mt-1 grid grid-cols-7 gap-2">
    <span v-for="bar in bars" :key="bar.label" class="text-center text-[10px] text-text-muted">
      {{ bar.label }}
    </span>
  </div>
</template>
