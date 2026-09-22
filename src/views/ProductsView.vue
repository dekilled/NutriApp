<script setup lang="ts">
import { Check, ChevronDown, Circle } from 'lucide-vue-next'
import { onMounted, reactive, ref } from 'vue'

import AppCard from '@/components/ui/AppCard.vue'
import { getOrCreateDailyLog } from '@/services/dailyLogService'
import { getActivePlan, type NutritionPlan } from '@/services/planService'
import {
  getSupplementHistory,
  listIngredients,
  listPlanSupplements,
  listSupplementLogs,
  logSupplement,
  type PlanSupplement,
  type SupplementHistoryDay,
  type SupplementIngredient,
} from '@/services/supplementService'
import { formatShortDate, todayIso } from '@/utils/date'

const activePlan = ref<NutritionPlan | null>(null)
const supplements = ref<PlanSupplement[]>([])
const statusToday = reactive<Record<number, boolean>>({})
const historyOpen = reactive<Record<number, boolean>>({})
const history = reactive<Record<number, SupplementHistoryDay[]>>({})
const ingredientsOpen = reactive<Record<number, boolean>>({})
const ingredients = reactive<Record<number, SupplementIngredient[]>>({})
const dailyLogId = ref<number | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    activePlan.value = await getActivePlan()
    if (!activePlan.value) return

    supplements.value = await listPlanSupplements(activePlan.value.id)
    const dailyLog = await getOrCreateDailyLog(todayIso(), activePlan.value.id)
    dailyLogId.value = dailyLog.id

    const logs = await listSupplementLogs(dailyLog.id)
    for (const log of logs) {
      statusToday[log.plan_supplement_id] = log.status === 'done'
    }
  } finally {
    loading.value = false
  }
}

async function toggleStatus(supplement: PlanSupplement) {
  if (!dailyLogId.value) return
  const next = !statusToday[supplement.id]
  statusToday[supplement.id] = next
  await logSupplement(dailyLogId.value, supplement.id, next ? 'done' : 'pending')
  if (historyOpen[supplement.id]) {
    history[supplement.id] = await getSupplementHistory(supplement.id, 7)
  }
}

async function toggleHistory(supplement: PlanSupplement) {
  historyOpen[supplement.id] = !historyOpen[supplement.id]
  if (historyOpen[supplement.id] && !history[supplement.id]) {
    history[supplement.id] = await getSupplementHistory(supplement.id, 7)
  }
}

async function toggleIngredients(supplement: PlanSupplement) {
  ingredientsOpen[supplement.id] = !ingredientsOpen[supplement.id]
  if (ingredientsOpen[supplement.id] && !ingredients[supplement.id]) {
    ingredients[supplement.id] = await listIngredients(supplement.id)
  }
}

const SYMBOL_UNITS = new Set(['g', 'ml'])

function formatQuantity(ingredient: SupplementIngredient): string {
  if (ingredient.quantity === null) return ingredient.unit ?? ''
  const qty = ingredient.quantity % 1 === 0 ? ingredient.quantity : ingredient.quantity.toFixed(1)
  if (!ingredient.unit) return `${qty}`
  const separator = SYMBOL_UNITS.has(ingredient.unit) ? '' : ' '
  return `${qty}${separator}${ingredient.unit}`
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <p v-if="!loading && !activePlan" class="text-sm text-text-muted">
      Nenhum plano ativo. Ative um plano em Planos para ver os suplementos aqui.
    </p>

    <AppCard v-for="supplement in supplements" :key="supplement.id">
      <div class="flex items-center justify-between gap-3">
        <button type="button" class="flex flex-1 items-center gap-3 text-left" @click="toggleStatus(supplement)">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
            :class="statusToday[supplement.id] ? 'bg-primary/15 text-primary' : 'bg-surface-alt text-text-muted'"
          >
            <Check v-if="statusToday[supplement.id]" :size="18" :stroke-width="2.5" />
            <Circle v-else :size="18" :stroke-width="1.75" />
          </span>
          <span>
            <p class="text-sm font-medium text-text">{{ supplement.name }}</p>
            <p class="text-xs text-text-muted">
              <template v-if="supplement.type === 'recipe'">{{ supplement.serving_description ?? 'Receita' }}</template>
              <template v-else>{{ supplement.dose ?? '—' }}</template>
              <span v-if="supplement.scheduled_time"> · {{ supplement.scheduled_time }}</span>
            </p>
          </span>
        </button>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-transform"
          :class="{ 'rotate-180': historyOpen[supplement.id] }"
          aria-label="Ver histórico"
          @click="toggleHistory(supplement)"
        >
          <ChevronDown :size="18" />
        </button>
      </div>

      <template v-if="supplement.type === 'recipe'">
        <div class="my-3 border-t border-divider"></div>
        <button
          type="button"
          class="flex items-center gap-1 text-xs font-medium text-text-muted"
          @click="toggleIngredients(supplement)"
        >
          <ChevronDown
            :size="14"
            :class="{ 'rotate-180': ingredientsOpen[supplement.id] }"
            class="transition-transform"
          />
          Ver ingredientes
        </button>
        <ul v-if="ingredientsOpen[supplement.id]" class="mt-2 flex flex-col gap-1.5">
          <li
            v-for="ingredient in ingredients[supplement.id]"
            :key="ingredient.id"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-text">{{ ingredient.ingredient }}</span>
            <span class="text-text-muted">{{ formatQuantity(ingredient) }}</span>
          </li>
        </ul>
      </template>

      <div v-if="historyOpen[supplement.id]" class="mt-3 border-t border-divider pt-3">
        <p class="mb-2 text-xs font-medium text-text-muted">Últimos 7 dias</p>
        <div class="flex gap-2">
          <div
            v-for="day in [...(history[supplement.id] ?? [])].reverse()"
            :key="day.log_date"
            class="flex flex-col items-center gap-1"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-[10px]"
              :class="day.status === 'done' ? 'bg-primary/15 text-primary' : 'bg-surface-alt text-text-muted'"
            >
              <Check v-if="day.status === 'done'" :size="12" :stroke-width="3" />
              <Circle v-else :size="10" :stroke-width="2" />
            </span>
            <span class="text-[9px] text-text-muted">{{ formatShortDate(day.log_date) }}</span>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
