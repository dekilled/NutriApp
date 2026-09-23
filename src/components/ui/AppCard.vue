<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: undefined })
</script>

<template>
  <div
    class="overflow-visible rounded-[20px] bg-surface px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-border/60"
  >
    <div v-if="title || $slots.actions" class="mb-3 flex items-center justify-between">
      <h2 v-if="title" class="text-base font-semibold text-text">{{ title }}</h2>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>
