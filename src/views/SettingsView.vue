<script setup lang="ts">
import { Laptop, Moon, Sun } from 'lucide-vue-next'

import AppCard from '@/components/ui/AppCard.vue'
import { useSettings } from '@/composables/useSettings'
import { useTheme } from '@/composables/useTheme'
import packageJson from '../../package.json'

const { preference, setPreference } = useTheme()
const { settings } = useSettings()

const themeOptions = [
  { value: 'light' as const, label: 'Claro', icon: Sun },
  { value: 'dark' as const, label: 'Escuro', icon: Moon },
  { value: 'system' as const, label: 'Sistema', icon: Laptop },
]
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <AppCard title="Tema">
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition-colors"
          :class="
            preference === option.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-text-muted'
          "
          @click="setPreference(option.value)"
        >
          <component :is="option.icon" :size="20" :stroke-width="1.75" />
          {{ option.label }}
        </button>
      </div>
    </AppCard>

    <AppCard title="Velocidade — Exercícios">
      <label class="mb-1 block text-sm text-text" for="walk-max">Velocidade máxima de caminhada (km/h)</label>
      <input
        id="walk-max"
        v-model.number="settings.walkMaxSpeedKmh"
        type="number"
        step="0.1"
        min="0"
        class="mb-4 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />

      <label class="mb-1 block text-sm text-text" for="run-min">Velocidade mínima de corrida (km/h)</label>
      <input
        id="run-min"
        v-model.number="settings.runMinSpeedKmh"
        type="number"
        step="0.1"
        min="0"
        class="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />

      <p class="mt-3 text-xs text-text-muted">
        Entre os dois valores fica a zona de transição, calculada pela média dos últimos 5 segundos de leitura.
      </p>
    </AppCard>

    <AppCard title="Sobre">
      <p class="text-sm text-text-muted">Nutri Routine · versão {{ packageJson.version }}</p>
    </AppCard>
  </div>
</template>
