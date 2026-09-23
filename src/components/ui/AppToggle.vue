<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="relative h-6 w-11 shrink-0 rounded-full transition-colors"
    :class="modelValue ? 'bg-primary' : 'bg-surface-alt'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
      :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
    />
  </button>
</template>
