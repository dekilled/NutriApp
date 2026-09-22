<script setup lang="ts">
import { ClipboardList, Home, Pill, Dumbbell } from 'lucide-vue-next'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/products', label: 'Produtos', icon: Pill },
  { to: '/exercises', label: 'Exercícios', icon: Dumbbell },
  { to: '/plans', label: 'Planos', icon: ClipboardList },
]
</script>

<template>
  <nav
    class="nav-blur mx-4 mb-4 flex justify-around rounded-[24px] border border-border/60 bg-[var(--nav-bg)] py-2 shadow-[var(--shadow-card)] backdrop-blur-lg"
  >
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-text-muted transition-colors [&.router-link-exact-active]:text-primary"
    >
      <component :is="link.icon" :size="22" :stroke-width="1.75" />
      <span class="text-[11px] font-medium">{{ link.label }}</span>
    </RouterLink>
  </nav>
</template>
