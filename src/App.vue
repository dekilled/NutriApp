<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
</script>

<template>
  <div class="flex h-full flex-col bg-bg text-text">
    <AppHeader />
    <main class="flex-1 overflow-y-auto pb-24">
      <RouterView />
    </main>
    <div class="fixed inset-x-0 bottom-0 z-20">
      <BottomNav />
    </div>
  </div>
</template>
