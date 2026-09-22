import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNutritionStore = defineStore('nutrition', () => {
  const meals = ref([])

  function setMeals(newMeals) {
    meals.value = newMeals
  }

  return { meals, setMeals }
})
