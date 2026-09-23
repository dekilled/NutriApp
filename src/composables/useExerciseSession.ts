// Composable fino sobre useActivityStore (Pinia) — mantém a mesma API
// pública de antes para as views não precisarem mudar nada. O estado real
// (e a lógica de GPS/timers/checkpoints) mora no store, que é o que
// precisa sobreviver à troca de tela e, na medida do possível via
// localStorage, a um processo do WebView morto e relançado em background.
import { storeToRefs } from 'pinia'

import { useActivityStore } from '@/stores/useActivityStore'

export type {
  ExerciseGoal,
  FinishedSession,
  FinishedSessionSegment,
  SessionSegment,
  SessionStatus,
  SpeedPoint,
} from '@/stores/useActivityStore'

export function useExerciseSession() {
  const store = useActivityStore()
  const state = storeToRefs(store)

  return {
    ...state,
    startSession: store.startSession,
    pauseSession: store.pauseSession,
    resumeSession: store.resumeSession,
    finishSession: store.finishSession,
    resetSession: store.resetSession,
  }
}
