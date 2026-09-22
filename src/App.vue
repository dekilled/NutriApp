<script setup>
import BottomNav from '@/components/common/BottomNav.vue'
</script>

<template>
  <div class="flex h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
    <BottomNav />
  </div>
</template>
