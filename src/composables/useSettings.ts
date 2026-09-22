import { reactive, watch } from 'vue'

const STORAGE_KEY = 'nutriroutine:settings'

export interface AppSettings {
  walkMaxSpeedKmh: number
  runMinSpeedKmh: number
}

const defaults: AppSettings = {
  walkMaxSpeedKmh: 6,
  runMinSpeedKmh: 7,
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

const settings = reactive<AppSettings>(readStoredSettings())
let initialized = false

export function useSettings() {
  if (!initialized) {
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
    initialized = true
  }

  return { settings }
}
