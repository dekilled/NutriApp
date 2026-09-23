import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'

const STORAGE_KEY = 'nutriroutine:settings'

export interface AppSettings {
  walkMaxSpeedKmh: number
  runMinSpeedKmh: number
  assistantEnabled: boolean
  checkpointsByKmEnabled: boolean
  checkpointsByTimeEnabled: boolean
  checkpointsByTimeIntervalMin: number
}

const defaults: AppSettings = {
  walkMaxSpeedKmh: 6,
  runMinSpeedKmh: 7,
  assistantEnabled: false,
  checkpointsByKmEnabled: true,
  checkpointsByTimeEnabled: false,
  checkpointsByTimeIntervalMin: 30,
}

function readStoredSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...defaults, ...JSON.parse(stored) }
  } catch {
    // ignora JSON inválido ou localStorage indisponível
  }
  return { ...defaults }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<AppSettings>(readStoredSettings())

  watch(
    settings,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // ignora falha de persistência
      }
    },
    { deep: true },
  )

  return { settings }
})
