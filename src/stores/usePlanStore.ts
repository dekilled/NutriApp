import { defineStore } from 'pinia'
import { ref } from 'vue'

import * as planService from '@/services/planService'
import type { FoodGuideline, MealSlot, NutritionPlan, PlanMeal } from '@/services/planService'

export const usePlanStore = defineStore('plan', () => {
  const mealSlots = ref<MealSlot[]>([])
  const activePlan = ref<NutritionPlan | null>(null)
  const planMeals = ref<PlanMeal[]>([])
  const foodGuidelines = ref<FoodGuideline[]>([])
  const loading = ref(false)

  async function loadMealSlots() {
    mealSlots.value = await planService.listMealSlots()
  }

  async function loadActivePlan() {
    loading.value = true
    try {
      activePlan.value = await planService.getActivePlan()
      if (activePlan.value) {
        planMeals.value = await planService.listPlanMeals(activePlan.value.id)
        foodGuidelines.value = await planService.listFoodGuidelines(activePlan.value.id)
      } else {
        planMeals.value = []
        foodGuidelines.value = []
      }
    } finally {
      loading.value = false
    }
  }

  return { mealSlots, activePlan, planMeals, foodGuidelines, loading, loadMealSlots, loadActivePlan }
})
