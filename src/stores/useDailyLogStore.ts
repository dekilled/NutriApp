import { defineStore } from 'pinia'
import { ref } from 'vue'

import * as dailyLogService from '@/services/dailyLogService'
import type { DailyLog, MealLog, MealLogStatus } from '@/services/dailyLogService'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useDailyLogStore = defineStore('dailyLog', () => {
  const currentLog = ref<DailyLog | null>(null)
  const mealLogs = ref<MealLog[]>([])
  const loading = ref(false)

  async function loadToday(planId?: number | null) {
    loading.value = true
    try {
      currentLog.value = await dailyLogService.getOrCreateDailyLog(todayIso(), planId)
      mealLogs.value = await dailyLogService.listMealLogs(currentLog.value.id)
    } finally {
      loading.value = false
    }
  }

  async function setMealStatus(mealLogId: number, status: MealLogStatus) {
    await dailyLogService.updateMealLogStatus(mealLogId, status)
    if (currentLog.value) {
      mealLogs.value = await dailyLogService.listMealLogs(currentLog.value.id)
    }
  }

  return { currentLog, mealLogs, loading, loadToday, setMealStatus }
})
