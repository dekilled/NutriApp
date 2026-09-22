<script setup lang="ts">
import { ChevronDown, Plus, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'

import AppCard from '@/components/ui/AppCard.vue'
import {
  addFoodGuideline,
  addPlanMeal,
  deleteFoodGuideline,
  deletePlanMeal,
  getPlan,
  getSlotNotes,
  listFoodGuidelines,
  listMealSlots,
  listPlanMeals,
  setActivePlan,
  setSlotNotes,
  updatePlanMeal,
  type FoodGuideline,
  type MealSlot,
  type NutritionPlan,
  type PlanMeal,
} from '@/services/planService'
import {
  addPlanSupplement,
  deletePlanSupplement,
  listPlanSupplements,
  type PlanSupplement,
} from '@/services/supplementService'
import { iconForSlot } from '@/utils/mealSlotIcons'

const props = defineProps<{ id: string }>()
const planId = computed(() => Number(props.id))

const plan = ref<NutritionPlan | null>(null)
const slots = ref<MealSlot[]>([])
const meals = ref<PlanMeal[]>([])
const guidelines = ref<FoodGuideline[]>([])
const supplements = ref<PlanSupplement[]>([])
const loading = ref(true)

const slotTimes = reactive<Record<number, string>>({})
const slotNotesOpen = reactive<Record<number, boolean>>({})
const slotNotesText = reactive<Record<number, string>>({})
const newItemForms = reactive<Record<number, { description: string; quantity: string; calories: string }>>({})
const newGuideline = reactive<{ eat: string; avoid: string }>({ eat: '', avoid: '' })
const newSupplement = reactive<{ name: string; dose: string; scheduledTime: string }>({
  name: '',
  dose: '',
  scheduledTime: '',
})

function mealsForSlot(slotId: number): PlanMeal[] {
  return meals.value.filter((m) => m.slot_id === slotId)
}

function slotTotalCalories(slotId: number): number | null {
  const items = mealsForSlot(slotId)
  const withCalories = items.filter((i) => i.calories !== null)
  if (!withCalories.length) return null
  return withCalories.reduce((sum, i) => sum + (i.calories ?? 0), 0)
}

function formEntry(slotId: number) {
  if (!newItemForms[slotId]) {
    newItemForms[slotId] = { description: '', quantity: '', calories: '' }
  }
  return newItemForms[slotId]
}

async function load() {
  loading.value = true
  try {
    const [planData, slotList, mealList, guidelineList, supplementList] = await Promise.all([
      getPlan(planId.value),
      listMealSlots(),
      listPlanMeals(planId.value),
      listFoodGuidelines(planId.value),
      listPlanSupplements(planId.value),
    ])
    plan.value = planData
    slots.value = slotList
    meals.value = mealList
    guidelines.value = guidelineList
    supplements.value = supplementList

    for (const slot of slotList) {
      const firstItem = mealList.find((m) => m.slot_id === slot.id)
      slotTimes[slot.id] = firstItem?.scheduled_time ?? ''
      slotNotesText[slot.id] = await getSlotNotes(planId.value, slot.id)
    }
  } finally {
    loading.value = false
  }
}

async function activatePlan() {
  await setActivePlan(planId.value)
  plan.value = await getPlan(planId.value)
}

async function updateSlotTime(slotId: number) {
  const time = slotTimes[slotId]
  const items = mealsForSlot(slotId)
  await Promise.all(items.map((item) => updatePlanMeal(item.id, { scheduled_time: time })))
}

async function addItem(slotId: number) {
  const form = formEntry(slotId)
  if (!form.description.trim()) return

  await addPlanMeal({
    plan_id: planId.value,
    slot_id: slotId,
    scheduled_time: slotTimes[slotId] || null,
    description: form.description.trim(),
    quantity: form.quantity.trim() || null,
    calories: form.calories ? Number(form.calories) : null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    notes: null,
  })

  newItemForms[slotId] = { description: '', quantity: '', calories: '' }
  meals.value = await listPlanMeals(planId.value)
}

async function removeItem(id: number) {
  await deletePlanMeal(id)
  meals.value = meals.value.filter((m) => m.id !== id)
}

async function toggleSlotNotes(slotId: number) {
  slotNotesOpen[slotId] = !slotNotesOpen[slotId]
}

async function saveSlotNotes(slotId: number) {
  await setSlotNotes(planId.value, slotId, slotNotesText[slotId] ?? '')
}

async function addGuideline(type: 'eat' | 'avoid') {
  const value = type === 'eat' ? newGuideline.eat : newGuideline.avoid
  if (!value.trim()) return
  await addFoodGuideline({ plan_id: planId.value, food: value.trim(), type, reason: null })
  if (type === 'eat') newGuideline.eat = ''
  else newGuideline.avoid = ''
  guidelines.value = await listFoodGuidelines(planId.value)
}

async function removeGuideline(id: number) {
  await deleteFoodGuideline(id)
  guidelines.value = guidelines.value.filter((g) => g.id !== id)
}

async function addSupplement() {
  if (!newSupplement.name.trim()) return
  await addPlanSupplement({
    plan_id: planId.value,
    name: newSupplement.name.trim(),
    dose: newSupplement.dose.trim() || null,
    scheduled_time: newSupplement.scheduledTime || null,
    with_meal_slot: null,
    notes: null,
  })
  newSupplement.name = ''
  newSupplement.dose = ''
  newSupplement.scheduledTime = ''
  supplements.value = await listPlanSupplements(planId.value)
}

async function removeSupplement(id: number) {
  await deletePlanSupplement(id)
  supplements.value = supplements.value.filter((s) => s.id !== id)
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <AppCard v-if="plan">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-base font-semibold text-text">{{ plan.label }}</p>
          <p class="text-xs text-text-muted">Criado em {{ new Date(plan.created_at).toLocaleDateString('pt-BR') }}</p>
        </div>
        <span
          v-if="plan.is_active"
          class="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary"
        >
          Ativo
        </span>
        <button
          v-else
          type="button"
          class="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-contrast"
          @click="activatePlan"
        >
          Ativar plano
        </button>
      </div>
    </AppCard>

    <AppCard v-for="slot in slots" :key="slot.id">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <component :is="iconForSlot(slot.name)" :size="20" :stroke-width="1.75" class="text-primary" />
          <span class="text-sm font-semibold text-text">{{ slot.name }}</span>
        </div>
        <input
          v-model="slotTimes[slot.id]"
          type="time"
          class="rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text outline-none focus:border-primary"
          @change="updateSlotTime(slot.id)"
        />
      </div>

      <div class="my-3 border-t border-divider"></div>

      <ul v-if="mealsForSlot(slot.id).length" class="mb-2 flex flex-col gap-2">
        <li
          v-for="item in mealsForSlot(slot.id)"
          :key="item.id"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span class="min-w-0 flex-1 truncate text-text">{{ item.description }}</span>
          <span v-if="item.quantity" class="shrink-0 text-text-muted">{{ item.quantity }}</span>
          <button
            type="button"
            class="shrink-0 text-text-muted transition-colors hover:text-danger"
            aria-label="Remover item"
            @click="removeItem(item.id)"
          >
            <Trash2 :size="16" :stroke-width="1.75" />
          </button>
        </li>
      </ul>
      <p v-else class="mb-2 text-sm text-text-muted">Nenhum alimento adicionado.</p>

      <p v-if="slotTotalCalories(slot.id) !== null" class="mb-2 text-xs text-text-muted">
        Total: {{ slotTotalCalories(slot.id) }} kcal
      </p>

      <div class="flex gap-2">
        <input
          v-model="formEntry(slot.id).description"
          type="text"
          placeholder="Alimento"
          class="min-w-0 flex-1 rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="addItem(slot.id)"
        />
        <input
          v-model="formEntry(slot.id).quantity"
          type="text"
          placeholder="Qtd"
          class="w-16 rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="addItem(slot.id)"
        />
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-lg bg-primary/15 px-2.5 text-primary"
          aria-label="Adicionar alimento"
          @click="addItem(slot.id)"
        >
          <Plus :size="18" :stroke-width="2" />
        </button>
      </div>

      <button
        type="button"
        class="mt-3 flex items-center gap-1 text-xs font-medium text-text-muted"
        @click="toggleSlotNotes(slot.id)"
      >
        Notas
        <ChevronDown :size="14" :class="{ 'rotate-180': slotNotesOpen[slot.id] }" class="transition-transform" />
      </button>
      <textarea
        v-if="slotNotesOpen[slot.id]"
        v-model="slotNotesText[slot.id]"
        rows="2"
        class="mt-2 w-full rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
        placeholder="Observações sobre esta refeição"
        @blur="saveSlotNotes(slot.id)"
      />
    </AppCard>

    <AppCard title="Suplementos">
      <ul v-if="supplements.length" class="mb-3 flex flex-col gap-2">
        <li v-for="supplement in supplements" :key="supplement.id" class="flex items-center justify-between text-sm">
          <span>
            <span class="text-text">{{ supplement.name }}</span>
            <span class="text-text-muted">
              <template v-if="supplement.dose"> · {{ supplement.dose }}</template>
              <template v-if="supplement.scheduled_time"> · {{ supplement.scheduled_time }}</template>
            </span>
          </span>
          <button type="button" class="text-text-muted hover:text-danger" @click="removeSupplement(supplement.id)">
            <Trash2 :size="14" :stroke-width="1.75" />
          </button>
        </li>
      </ul>
      <p v-else class="mb-3 text-sm text-text-muted">Nenhum suplemento adicionado.</p>

      <div class="flex flex-wrap gap-2">
        <input
          v-model="newSupplement.name"
          type="text"
          placeholder="Nome"
          class="min-w-0 flex-1 rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="addSupplement"
        />
        <input
          v-model="newSupplement.dose"
          type="text"
          placeholder="Dose"
          class="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="addSupplement"
        />
        <input
          v-model="newSupplement.scheduledTime"
          type="time"
          class="rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
        />
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-lg bg-primary/15 px-2.5 text-primary"
          aria-label="Adicionar suplemento"
          @click="addSupplement"
        >
          <Plus :size="18" :stroke-width="2" />
        </button>
      </div>
    </AppCard>

    <AppCard title="Diretrizes alimentares">
      <p class="mb-2 text-xs font-semibold text-primary">✅ Comer</p>
      <ul class="mb-3 flex flex-col gap-1.5">
        <li
          v-for="g in guidelines.filter((g) => g.type === 'eat')"
          :key="g.id"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-text">{{ g.food }}</span>
          <button type="button" class="text-text-muted hover:text-danger" @click="removeGuideline(g.id)">
            <Trash2 :size="14" :stroke-width="1.75" />
          </button>
        </li>
      </ul>
      <div class="mb-4 flex gap-2">
        <input
          v-model="newGuideline.eat"
          type="text"
          placeholder="Adicionar alimento"
          class="min-w-0 flex-1 rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="addGuideline('eat')"
        />
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-lg bg-primary/15 px-2.5 text-primary"
          @click="addGuideline('eat')"
        >
          <Plus :size="18" :stroke-width="2" />
        </button>
      </div>

      <p class="mb-2 text-xs font-semibold text-danger">❌ Evitar</p>
      <ul class="mb-3 flex flex-col gap-1.5">
        <li
          v-for="g in guidelines.filter((g) => g.type === 'avoid')"
          :key="g.id"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-text">{{ g.food }}</span>
          <button type="button" class="text-text-muted hover:text-danger" @click="removeGuideline(g.id)">
            <Trash2 :size="14" :stroke-width="1.75" />
          </button>
        </li>
      </ul>
      <div class="flex gap-2">
        <input
          v-model="newGuideline.avoid"
          type="text"
          placeholder="Adicionar alimento"
          class="min-w-0 flex-1 rounded-lg border border-border bg-surface-alt px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="addGuideline('avoid')"
        />
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-lg bg-danger/15 px-2.5 text-danger"
          @click="addGuideline('avoid')"
        >
          <Plus :size="18" :stroke-width="2" />
        </button>
      </div>
    </AppCard>
  </div>
</template>
