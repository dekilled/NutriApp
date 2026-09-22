<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ percent: number; color?: string }>(),
  { color: 'var(--color-primary)' },
)

const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))
</script>

<template>
  <div class="h-2.5 w-full overflow-hidden rounded-full bg-surface-alt">
    <div
      class="h-full rounded-full transition-[width] duration-300"
      :style="{ width: `${clamped}%`, backgroundColor: color }"

    />
  </div>
</template>
