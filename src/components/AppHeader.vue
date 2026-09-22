<script setup lang="ts">
import { Moon, Settings, Sun } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const router = useRouter()
const { preference, toggleTheme } = useTheme()

const title = computed(() => (route.meta.title as string | undefined) ?? 'Nutri Routine')
const isDark = computed(() => {
  if (preference.value === 'dark') return true
  if (preference.value === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

function openSettings() {
  router.push({ name: 'settings' })
}
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-bg/90 px-5 py-3 backdrop-blur nav-blur"
  >
    <h1 class="text-lg font-semibold text-text">{{ title }}</h1>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
        :aria-label="isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" :size="22" :stroke-width="1.75" />
        <Moon v-else :size="22" :stroke-width="1.75" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
        aria-label="Configurações"
        @click="openSettings"
      >
        <Settings :size="22" :stroke-width="1.75" />
      </button>
    </div>
  </header>
</template>
