<script setup lang="ts">
import { Footprints, PersonStanding, Zap } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppToggle from '@/components/ui/AppToggle.vue'
import type { ExerciseMode } from '@/services/activityService'
import { useExerciseSession, type ExerciseGoal } from '@/composables/useExerciseSession'

const router = useRouter()
const { startSession, permissionError } = useExerciseSession()

const modes: Array<{ value: ExerciseMode; label: string; icon: typeof Footprints }> = [
  { value: 'walking', label: 'Caminhada', icon: Footprints },
  { value: 'running', label: 'Corrida', icon: PersonStanding },
  { value: 'auto', label: 'Automático', icon: Zap },
]

const selectedMode = ref<ExerciseMode>('auto')
const defineGoal = ref(false)
const goalKind = ref<'distance' | 'time'>('distance')
const goalValue = ref('')
const starting = ref(false)

const goalUnitLabel = computed(() => (goalKind.value === 'distance' ? 'km' : 'min'))

const form = reactive({ error: '' })

async function handleStart() {
  form.error = ''
  const goal: ExerciseGoal | null =
    defineGoal.value && goalValue.value
      ? { type: goalKind.value, value: Number(goalValue.value) }
      : null

  starting.value = true
  try {
    await startSession(selectedMode.value, goal)
    router.push({ name: 'exercise-active' })
  } catch (error) {
    form.error = permissionError.value ?? (error instanceof Error ? error.message : 'Falha ao iniciar.')
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <div>
      <h2 class="mb-3 text-sm font-semibold text-text-muted">Modo</h2>
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="option in modes"
          :key="option.value"
          type="button"
          class="flex flex-col items-center gap-2 rounded-[20px] border-2 px-2 py-5 transition-colors"
          :class="
            selectedMode === option.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-text-muted'
          "
          @click="selectedMode = option.value"
        >
          <component :is="option.icon" :size="28" :stroke-width="1.75" />
          <span class="text-xs font-medium">{{ option.label }}</span>
        </button>
      </div>
    </div>

    <div class="rounded-[20px] bg-surface px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-border/60">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-text">Definir meta</p>
        <AppToggle v-model="defineGoal" />
      </div>

      <div v-if="defineGoal" class="mt-4">
        <div class="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="
              goalKind === 'distance'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted'
            "
            @click="goalKind = 'distance'"
          >
            Distância (km)
          </button>
          <button
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="
              goalKind === 'time' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'
            "
            @click="goalKind = 'time'"
          >
            Tempo (min)
          </button>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="goalValue"
            type="text"
            inputmode="decimal"
            placeholder="0"
            class="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
          <span class="shrink-0 text-sm text-text-muted">{{ goalUnitLabel }}</span>
        </div>
      </div>
    </div>

    <p v-if="form.error" class="text-sm text-danger">{{ form.error }}</p>

    <button
      type="button"
      class="rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-contrast disabled:opacity-60"
      :disabled="starting"
      @click="handleStart"
    >
      {{ starting ? 'Iniciando…' : 'Iniciar' }}
    </button>
  </div>
</template>
