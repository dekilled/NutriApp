<script setup>
const links = [
  { to: '/', label: 'Início' },
  { to: '/nutrition', label: 'Nutrição' },
  { to: '/activity', label: 'Atividade' },
  { to: '/profile', label: 'Perfil' },
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
      class="px-3 py-1 text-sm text-neutral-500 [&.router-link-exact-active]:text-emerald-600 [&.router-link-exact-active]:font-semibold"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
</template>
