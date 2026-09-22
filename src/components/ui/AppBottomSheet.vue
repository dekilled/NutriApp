<script setup lang="ts">
import { Transition } from 'vue'

defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" @click="emit('close')" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      leave-active-class="transition-transform duration-150 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-40 rounded-t-[24px] bg-surface px-5 pb-8 pt-4 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-alt" />
        <h2 v-if="title" class="mb-3 text-sm font-semibold text-text">{{ title }}</h2>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
