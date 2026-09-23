<script setup lang="ts">
import { Laptop, Moon, Sun } from 'lucide-vue-next'

import AppCard from '@/components/ui/AppCard.vue'
import { useTheme } from '@/composables/useTheme'
import { useSettingsStore } from '@/stores/useSettingsStore'
import packageJson from '../../package.json'

const { preference, setPreference } = useTheme()
const { settings } = useSettingsStore()

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
        Entre os dois valores fica a zona de transição: o app mantém o tipo atual (caminhada/corrida) por 8s
        antes de confirmar uma mudança, evitando trocas por oscilação do GPS.
      </p>
    </AppCard>

    <AppCard title="Assistente de voz">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-text">Ativar assistente</p>
          <p class="text-xs text-text-muted">Anuncia checkpoints durante o exercício</p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="settings.assistantEnabled"
          class="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          :class="settings.assistantEnabled ? 'bg-primary' : 'bg-surface-alt'"
          @click="settings.assistantEnabled = !settings.assistantEnabled"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            :class="settings.assistantEnabled ? 'translate-x-5' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <template v-if="settings.assistantEnabled">
        <div class="mb-3 flex items-center justify-between rounded-lg bg-surface-alt px-3 py-2">
          <span class="text-sm text-text">Voz</span>
          <span class="text-sm font-medium text-primary">Emma</span>
        </div>

        <p class="mb-3 text-xs text-text-muted">Idioma: Português (Brasil) — fixo por enquanto.</p>

        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm text-text">Checkpoints por km</p>
          <button
            type="button"
            role="switch"
            :aria-checked="settings.checkpointsByKmEnabled"
            class="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            :class="settings.checkpointsByKmEnabled ? 'bg-primary' : 'bg-surface-alt'"
            @click="settings.checkpointsByKmEnabled = !settings.checkpointsByKmEnabled"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              :class="settings.checkpointsByKmEnabled ? 'translate-x-5' : 'translate-x-0.5'"
            />
          </button>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-sm text-text">Checkpoints por tempo</p>
          <button
            type="button"
            role="switch"
            :aria-checked="settings.checkpointsByTimeEnabled"
            class="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            :class="settings.checkpointsByTimeEnabled ? 'bg-primary' : 'bg-surface-alt'"
            @click="settings.checkpointsByTimeEnabled = !settings.checkpointsByTimeEnabled"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              :class="settings.checkpointsByTimeEnabled ? 'translate-x-5' : 'translate-x-0.5'"
            />
          </button>
        </div>
        <div v-if="settings.checkpointsByTimeEnabled" class="mt-2 overflow-visible">
          <input
            v-model.number="settings.checkpointsByTimeIntervalMin"
            type="number"
            min="1"
            step="1"
            placeholder="Intervalo em minutos"
            class="w-full rounded-lg border border-border bg-surface-alt py-2 pl-3 pr-10 text-sm text-text outline-none focus:border-primary"
          />
        </div>

        <p class="mt-4 rounded-lg bg-surface-alt px-3 py-2 text-xs text-text-muted">
          Voz gerada por Fish Audio. Sem internet, os comentários da Emma ficam em silêncio — a sessão continua normalmente.
        </p>
      </template>
    </AppCard>

    <AppCard title="Sobre">
      <p class="text-sm text-text-muted">Nutri Routine · versão {{ packageJson.version }}</p>
    </AppCard>
  </div>
</template>
