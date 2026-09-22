import { defineStore } from 'pinia'
import { ref } from 'vue'

import * as activityService from '@/services/activityService'
import type { ActivitySession } from '@/services/activityService'

export const useActivityStore = defineStore('activity', () => {
  const sessions = ref<ActivitySession[]>([])
  const activeSessionId = ref<number | null>(null)
  const loading = ref(false)

  async function loadSessions(dailyLogId: number) {
    loading.value = true
    try {
      sessions.value = await activityService.listActivitySessions(dailyLogId)
    } finally {
      loading.value = false
    }
  }

  async function startSession(dailyLogId: number) {
    activeSessionId.value = await activityService.startActivitySession(dailyLogId)
    await loadSessions(dailyLogId)
  }

  async function endSession(dailyLogId: number, totalMinutes: number) {
    if (!activeSessionId.value) return
    await activityService.endActivitySession(activeSessionId.value, totalMinutes)
    activeSessionId.value = null
    await loadSessions(dailyLogId)
  }

  return { sessions, activeSessionId, loading, loadSessions, startSession, endSession }
})
