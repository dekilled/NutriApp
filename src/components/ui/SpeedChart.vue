<script setup lang="ts">
import { computed } from 'vue'

import type { SpeedPoint } from '@/composables/useExerciseSession'

const props = withDefaults(
  defineProps<{
    points: SpeedPoint[]
    walkMaxSpeedKmh: number
    runMinSpeedKmh: number
    height?: number
  }>(),
  { height: 120 },
)

const WIDTH = 300

const maxY = computed(() => {
  const maxRecorded = props.points.reduce((max, p) => Math.max(max, p.speedKmh), 0)
  return Math.max(props.runMinSpeedKmh * 1.3, maxRecorded * 1.15, 1)
})

function yFor(speedKmh: number): number {
  return props.height - (speedKmh / maxY.value) * props.height
}

const linePath = computed(() => {
  const pts = props.points
  if (pts.length === 0) return ''
  if (pts.length === 1) {
    const y = yFor(pts[0].speedKmh)
    return `M0,${y} L${WIDTH},${y}`
  }

  const minT = pts[0].t
  const maxT = pts[pts.length - 1].t
  const spanT = Math.max(1, maxT - minT)

  const xy = pts.map((p) => [((p.t - minT) / spanT) * WIDTH, yFor(p.speedKmh)] as const)

  let d = `M${xy[0][0]},${xy[0][1]}`
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[i]
    const [x1, y1] = xy[i + 1]
    const midX = (x0 + x1) / 2
    d += ` C${midX},${y0} ${midX},${y1} ${x1},${y1}`
  }
  return d
})

const walkLineY = computed(() => yFor(props.walkMaxSpeedKmh))
const runLineY = computed(() => yFor(props.runMinSpeedKmh))
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${height}`"
    preserveAspectRatio="none"
    class="w-full"
    :style="{ height: `${height}px` }"
  >
    <line
      x1="0"
      :x2="WIDTH"
      :y1="walkLineY"
      :y2="walkLineY"
      stroke="var(--color-accent-blue)"
      stroke-width="1"
      stroke-dasharray="4 4"
      opacity="0.6"
    />
    <line
      x1="0"
      :x2="WIDTH"
      :y1="runLineY"
      :y2="runLineY"
      stroke="var(--color-accent-orange)"
      stroke-width="1"
      stroke-dasharray="4 4"
      opacity="0.6"
    />
    <path v-if="linePath" :d="linePath" fill="none" stroke="var(--color-primary)" stroke-width="2" />
  </svg>
</template>
