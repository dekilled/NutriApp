<script setup lang="ts">
const links = [
  { to: '/', label: 'Início' },
  { to: '/plan', label: 'Plano' },
  { to: '/daily-log', label: 'Registro' },
  { to: '/activity', label: 'Atividade' },
  { to: '/history', label: 'Histórico' },
]
</script>

<template>
  <nav
    class="flex shrink-0 justify-around border-t border-neutral-200 bg-white py-2 dark:border-neutral-800 dark:bg-neutral-900"
  >
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="px-2 py-1 text-xs text-neutral-500 [&.router-link-exact-active]:text-emerald-600 [&.router-link-exact-active]:font-semibold"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
</template>
