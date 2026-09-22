import { ref, watch } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'nutriroutine:theme'

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage indisponível (modo privado, etc.) — cai no padrão do sistema.
  }
  return 'system'
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', preference)
  }
}

const preference = ref<ThemePreference>('system')
let initialized = false

export function useTheme() {
  if (!initialized) {
    preference.value = readStoredPreference()
    applyTheme(preference.value)

    watch(preference, (value) => {
      applyTheme(value)
      try {
        if (value === 'system') {
          localStorage.removeItem(STORAGE_KEY)
        } else {
          localStorage.setItem(STORAGE_KEY, value)
        }
      } catch {
        // ignora falha de persistência
      }
    })

    initialized = true
  }

  function toggleTheme() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const effectiveIsDark = preference.value === 'dark' || (preference.value === 'system' && systemPrefersDark)
    preference.value = effectiveIsDark ? 'light' : 'dark'
  }

  function setPreference(value: ThemePreference) {
    preference.value = value
  }

  return { preference, toggleTheme, setPreference }
}
