import { Capacitor } from '@capacitor/core'
import { Geolocation, type Position } from '@capacitor/geolocation'
import { Haptics } from '@capacitor/haptics'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ExerciseGoalType, ExerciseMode, SegmentType } from '@/services/activityService'
import { getOrCreateDailyLog } from '@/services/dailyLogService'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useSpeech } from '@/composables/useSpeech'
import {
  compareWithAverage,
  getLast7DaysAverage,
  toSessionSummary,
  type SessionAverage,
} from '@/composables/useSessionAnalysis'
import { todayIso } from '@/utils/date'

const USER_NAME = 'Eric'

export interface ExerciseGoal {
  type: ExerciseGoalType
  value: number // km (distance) ou minutos (time)
}

export interface SpeedPoint {
  t: number // segundos desde o início da sessão
  speedKmh: number
}

export interface SessionSegment {
  type: SegmentType
  startedAt: string
  endedAt: string | null
  durationS: number
}

export type SessionStatus = 'idle' | 'active' | 'paused' | 'finished'

export interface FinishedSessionSegment {
  type: SegmentType
  startedAt: string
  endedAt: string
  durationS: number
}

export interface FinishedSession {
  dailyLogId: number
  startedAt: string
  endedAt: string
  totalMinutes: number
  distanceKm: number
  avgSpeedKmh: number
  calories: number
  mode: ExerciseMode
  goalType: ExerciseGoalType | null
  goalValue: number | null
  segments: FinishedSessionSegment[]
}

const GPS_POLL_INTERVAL_MS = 3000
const MAX_ACCURACY_M = 20
const TYPE_CHANGE_DEBOUNCE_MS = 8000
const IDLE_SPEED_THRESHOLD_KMH = 1
const SPEED_HISTORY_MAX_POINTS = 120
const EARTH_RADIUS_M = 6371000
const CALORIES_PER_KM_RUNNING = 60
const CALORIES_PER_KM_WALKING = 50
const DISTANCE_CHECKPOINT_KM = 0.5
const GOAL_WARNING_PERCENT = 80

// Persistência: só sobrevive a troca de rota (o composable/store já resolvia
// isso, é estado de módulo). O que NÃO sobrevive é o processo do WebView
// sendo morto pelo Android em background — aí some tudo que está só na
// memória JS, Pinia incluso. Por isso gravamos um snapshot no localStorage
// e restauramos ao recarregar. Isso NÃO faz o GPS continuar sendo lido
// enquanto o app está morto (só um foreground service nativo faria isso,
// fora do escopo aqui) — só evita perder o progresso já registrado e
// realinha o cronômetro pelo relógio de verdade ao voltar.
const SNAPSHOT_KEY = 'nutriroutine:activeSession'

interface SessionSnapshot {
  status: SessionStatus
  mode: ExerciseMode
  goal: ExerciseGoal | null
  startedAtIso: string | null
  elapsedSeconds: number
  distanceKm: number
  segments: SessionSegment[]
  currentType: SegmentType
  goalReached: boolean
  dailyLogId: number
  lastPosition: { lat: number; lon: number; timestamp: number } | null
  openSegmentStartedAtIso: string | null
  openSegmentElapsedAtStart: number | null
  lastCheckpointKm: number
  lastCheckpointMin: number
  lastGoalExceededTick: number
  announcedCheckpoints: string[]
  sessionAverage: SessionAverage | null
  savedAt: number // Date.now() de quando o snapshot foi gravado
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace('.', ',')
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return (EARTH_RADIUS_M * c) / 1000
}

export const useActivityStore = defineStore('activity', () => {
  const status = ref<SessionStatus>('idle')
  const mode = ref<ExerciseMode>('auto')
  const goal = ref<ExerciseGoal | null>(null)
  const startedAtIso = ref<string | null>(null)
  const elapsedSeconds = ref(0)
  const distanceKm = ref(0)
  const currentSpeedKmh = ref(0)
  const speedHistory = ref<SpeedPoint[]>([])
  const segments = ref<SessionSegment[]>([])
  const currentType = ref<SegmentType>('idle')
  const goalReached = ref(false)
  const lastFinishedSession = ref<FinishedSession | null>(null)
  const permissionError = ref<string | null>(null)

  const openSegmentStartedAtIso = ref<string | null>(null)
  const openSegmentElapsedAtStart = ref<number | null>(null)

  let lastPosition: { lat: number; lon: number; timestamp: number } | null = null
  let candidateType: SegmentType | null = null
  let candidateSince = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let clockTimer: ReturnType<typeof setInterval> | null = null
  let dailyLogId = 0
  let lastCheckpointKm = 0
  let lastCheckpointMin = 0
  let lastGoalExceededTick = 0

  // Emma: fila de checkpoints já anunciados (nunca repete o mesmo na mesma
  // sessão) + a média dos últimos 7 dias, buscada uma vez ao iniciar.
  const announcedCheckpoints = new Set<string>()
  let sessionAverage: SessionAverage | null = null

  function saveSnapshot(): void {
    if (status.value === 'idle' || status.value === 'finished') return
    const snapshot: SessionSnapshot = {
      status: status.value,
      mode: mode.value,
      goal: goal.value,
      startedAtIso: startedAtIso.value,
      elapsedSeconds: elapsedSeconds.value,
      distanceKm: distanceKm.value,
      segments: segments.value,
      currentType: currentType.value,
      goalReached: goalReached.value,
      dailyLogId,
      lastPosition,
      openSegmentStartedAtIso: openSegmentStartedAtIso.value,
      openSegmentElapsedAtStart: openSegmentElapsedAtStart.value,
      lastCheckpointKm,
      lastCheckpointMin,
      lastGoalExceededTick,
      announcedCheckpoints: [...announcedCheckpoints],
      sessionAverage,
      savedAt: Date.now(),
    }
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
    } catch {
      // localStorage indisponível — a sessão segue só em memória
    }
  }

  function clearSnapshot(): void {
    try {
      localStorage.removeItem(SNAPSHOT_KEY)
    } catch {
      // ignora
    }
  }

  /**
   * Roda uma vez, na primeira vez que o store é instanciado (inclusive
   * logo após o app relançar depois de o Android matar o processo). Se
   * havia uma sessão em andamento, restaura o estado e realinha o
   * cronômetro pelo relógio de verdade (o GPS não gravou nada enquanto o
   * processo estava morto, então a distância fica congelada nesse trecho).
   */
  function restoreFromSnapshot(): void {
    let raw: string | null
    try {
      raw = localStorage.getItem(SNAPSHOT_KEY)
    } catch {
      return
    }
    if (!raw) return

    let snapshot: SessionSnapshot
    try {
      snapshot = JSON.parse(raw)
    } catch {
      clearSnapshot()
      return
    }

    if (snapshot.status !== 'active' && snapshot.status !== 'paused') {
      clearSnapshot()
      return
    }

    mode.value = snapshot.mode
    goal.value = snapshot.goal
    startedAtIso.value = snapshot.startedAtIso
    distanceKm.value = snapshot.distanceKm
    segments.value = snapshot.segments
    currentType.value = snapshot.currentType
    goalReached.value = snapshot.goalReached
    dailyLogId = snapshot.dailyLogId
    lastPosition = snapshot.lastPosition
    openSegmentStartedAtIso.value = snapshot.openSegmentStartedAtIso
    openSegmentElapsedAtStart.value = snapshot.openSegmentElapsedAtStart
    lastCheckpointKm = snapshot.lastCheckpointKm
    lastCheckpointMin = snapshot.lastCheckpointMin
    lastGoalExceededTick = snapshot.lastGoalExceededTick
    snapshot.announcedCheckpoints.forEach((key) => announcedCheckpoints.add(key))
    sessionAverage = snapshot.sessionAverage

    if (snapshot.status === 'active') {
      const gapSeconds = Math.max(0, Math.round((Date.now() - snapshot.savedAt) / 1000))
      elapsedSeconds.value = snapshot.elapsedSeconds + gapSeconds
      status.value = 'active'
      startTimers()
    } else {
      // pausado: fica exatamente como estava, sem religar os timers
      elapsedSeconds.value = snapshot.elapsedSeconds
      status.value = 'paused'
    }
  }

  const avgSpeedKmh = computed(() => {
    const hours = elapsedSeconds.value / 3600
    return hours > 0 ? distanceKm.value / hours : 0
  })

  const goalProgressPercent = computed(() => {
    if (!goal.value) return 0
    if (goal.value.type === 'distance') {
      return Math.min(100, (distanceKm.value / goal.value.value) * 100)
    }
    return Math.min(100, (elapsedSeconds.value / 60 / goal.value.value) * 100)
  })

  function announceOnce(key: string, text: string): void {
    const { settings } = useSettingsStore()
    if (!settings.assistantEnabled) return
    if (announcedCheckpoints.has(key)) return
    announcedCheckpoints.add(key)
    void useSpeech().speak(text)
  }

  function openNewSegment(type: SegmentType) {
    currentType.value = type
    openSegmentStartedAtIso.value = new Date().toISOString()
    openSegmentElapsedAtStart.value = elapsedSeconds.value
  }

  function closeCurrentSegment() {
    if (openSegmentStartedAtIso.value === null || openSegmentElapsedAtStart.value === null) return
    segments.value.push({
      type: currentType.value,
      startedAt: openSegmentStartedAtIso.value,
      endedAt: new Date().toISOString(),
      durationS: elapsedSeconds.value - openSegmentElapsedAtStart.value,
    })
    openSegmentStartedAtIso.value = null
    openSegmentElapsedAtStart.value = null
  }

  /** Segmentos fechados + o segmento em andamento (duração ao vivo), para a timeline. */
  const liveSegments = computed<SessionSegment[]>(() => {
    if (openSegmentStartedAtIso.value === null || openSegmentElapsedAtStart.value === null) {
      return segments.value
    }
    return [
      ...segments.value,
      {
        type: currentType.value,
        startedAt: openSegmentStartedAtIso.value,
        endedAt: null,
        durationS: elapsedSeconds.value - openSegmentElapsedAtStart.value,
      },
    ]
  })

  function commitTypeChange(newType: SegmentType) {
    closeCurrentSegment()
    openNewSegment(newType)

    if (newType === 'run') {
      const runCount = segments.value.filter((s) => s.type === 'run').length + 1 // +1: o que acabou de abrir
      if (runCount === 2) {
        announceOnce('run-2', `Olha só, temos progresso! Essa é sua segunda corrida hoje!`)
      } else if (runCount === 3) {
        announceOnce(
          'run-3',
          `Impressionante! Terceira corrida na mesma sessão. Você tá evoluindo demais, ${USER_NAME}!`,
        )
      }
    }
  }

  /** Detecção automática caminhada/corrida por velocidade, com debounce de 8s. */
  function updateDetectedType(speedKmh: number) {
    const { settings } = useSettingsStore()

    let zone: SegmentType | null
    if (speedKmh < IDLE_SPEED_THRESHOLD_KMH) {
      zone = 'idle'
    } else if (speedKmh <= settings.walkMaxSpeedKmh) {
      zone = 'walk'
    } else if (speedKmh >= settings.runMinSpeedKmh) {
      zone = 'run'
    } else {
      zone = null // zona de transição: mantém o tipo atual
    }

    if (zone === null || zone === currentType.value) {
      candidateType = null
      return
    }

    const now = Date.now()
    if (candidateType !== zone) {
      candidateType = zone
      candidateSince = now
      return
    }

    if (now - candidateSince >= TYPE_CHANGE_DEBOUNCE_MS) {
      commitTypeChange(zone)
      candidateType = null
    }
  }

  function currentRunningKm(): number {
    const runS = liveSegments.value.filter((s) => s.type === 'run').reduce((sum, s) => sum + s.durationS, 0)
    const walkS = liveSegments.value.filter((s) => s.type === 'walk').reduce((sum, s) => sum + s.durationS, 0)
    const activeS = runS + walkS
    return activeS > 0 ? distanceKm.value * (runS / activeS) : 0
  }

  /** Checkpoints falados da Emma: a cada 500m, a cada N minutos e "superou a média". */
  function checkCheckpoints() {
    const { settings } = useSettingsStore()

    if (settings.checkpointsByKmEnabled) {
      const mark = Math.floor(distanceKm.value / DISTANCE_CHECKPOINT_KM)
      if (mark > lastCheckpointKm) {
        lastCheckpointKm = mark
        announceOnce(
          `dist-${mark}`,
          `Você completou ${fmt(distanceKm.value)} quilômetros! Velocidade média: ${fmt(avgSpeedKmh.value)} quilômetros por hora. Continue assim!`,
        )
      }
    }

    if (settings.checkpointsByTimeEnabled && settings.checkpointsByTimeIntervalMin > 0) {
      const intervalMin = settings.checkpointsByTimeIntervalMin
      const mark = Math.floor(elapsedSeconds.value / 60 / intervalMin)
      if (mark > 0 && mark > lastCheckpointMin) {
        lastCheckpointMin = mark
        const totalMin = mark * intervalMin
        announceOnce(
          `time-${mark}`,
          `${totalMin} minutos de atividade! Você já percorreu ${fmt(distanceKm.value)} quilômetros. Incrível, ${USER_NAME}!`,
        )
      }
    }

    if (sessionAverage && sessionAverage.avgRunningKm > 0) {
      const runningKm = currentRunningKm()
      if (runningKm > sessionAverage.avgRunningKm) {
        announceOnce(
          'beat-avg-running',
          `Você já correu mais do que sua média dos últimos 7 dias! Continue, você tá arrasando!`,
        )
      }
    }
  }

  async function checkGoal() {
    if (!goal.value) return

    const isDistanceGoal = goal.value.type === 'distance'
    const rawPercent = isDistanceGoal
      ? (distanceKm.value / goal.value.value) * 100
      : (elapsedSeconds.value / 60 / goal.value.value) * 100

    if (isDistanceGoal && !goalReached.value && rawPercent >= GOAL_WARNING_PERCENT && rawPercent < 100) {
      const remainingM = Math.max(0, Math.round((goal.value.value - distanceKm.value) * 1000))
      announceOnce('goal-80', `Tá quase lá, ${USER_NAME}! Faltam apenas ${remainingM} mé-tros para sua meta. Vai!`)
    }

    if (!goalReached.value && rawPercent >= 100) {
      goalReached.value = true
      announceOnce(
        'goal-100',
        `Meta atingida! Parabéns, ${USER_NAME}! Você completou ${fmt(distanceKm.value)} quilômetros em ${Math.round(elapsedSeconds.value / 60)} minutos!`,
      )
      try {
        await Haptics.vibrate({ duration: 400 })
      } catch {
        // dispositivo sem suporte a haptics — segue sem feedback tátil
      }
    }

    if (isDistanceGoal && goalReached.value) {
      const overshootKm = distanceKm.value - goal.value.value
      const tick = Math.floor(overshootKm / DISTANCE_CHECKPOINT_KM)
      if (tick > lastGoalExceededTick) {
        lastGoalExceededTick = tick
        const overshootM = Math.round(overshootKm * 1000)
        announceOnce(`goal-exceeded-${tick}`, `Você foi ${overshootM} mé-tros além da sua meta! Isso é demais, ${USER_NAME}!`)
      }
    }
  }

  function handlePosition(position: Position) {
    const { latitude, longitude, accuracy, speed } = position.coords
    if (accuracy != null && accuracy > MAX_ACCURACY_M) return // GPS ruim, descarta leitura

    const timestamp = position.timestamp

    if (lastPosition) {
      distanceKm.value += haversineDistanceKm(lastPosition.lat, lastPosition.lon, latitude, longitude)
    }

    let speedKmh: number
    if (speed != null && speed >= 0) {
      speedKmh = speed * 3.6
    } else if (lastPosition) {
      const dtSeconds = (timestamp - lastPosition.timestamp) / 1000
      const dKm = haversineDistanceKm(lastPosition.lat, lastPosition.lon, latitude, longitude)
      speedKmh = dtSeconds > 0 ? (dKm / dtSeconds) * 3600 : 0
    } else {
      speedKmh = 0
    }

    lastPosition = { lat: latitude, lon: longitude, timestamp }
    currentSpeedKmh.value = speedKmh

    speedHistory.value.push({ t: elapsedSeconds.value, speedKmh })
    if (speedHistory.value.length > SPEED_HISTORY_MAX_POINTS) speedHistory.value.shift()

    if (mode.value === 'auto') {
      updateDetectedType(speedKmh)
    }

    checkCheckpoints()
    void checkGoal()
    saveSnapshot()
  }

  async function pollPosition() {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })
      handlePosition(position)
    } catch (error) {
      console.error('[useActivityStore] falha ao obter posição GPS:', error)
    }
  }

  function startTimers() {
    clockTimer = setInterval(() => {
      elapsedSeconds.value += 1
    }, 1000)
    pollTimer = setInterval(() => void pollPosition(), GPS_POLL_INTERVAL_MS)
    void pollPosition()
  }

  function stopTimers() {
    if (clockTimer) clearInterval(clockTimer)
    if (pollTimer) clearInterval(pollTimer)
    clockTimer = null
    pollTimer = null
  }

  function estimateCalories(): number {
    const runS = segments.value.filter((s) => s.type === 'run').reduce((sum, s) => sum + s.durationS, 0)
    const walkS = segments.value.filter((s) => s.type === 'walk').reduce((sum, s) => sum + s.durationS, 0)
    const activeS = runS + walkS
    if (activeS === 0) return 0

    const factor = (runS / activeS) * CALORIES_PER_KM_RUNNING + (walkS / activeS) * CALORIES_PER_KM_WALKING
    return distanceKm.value * factor
  }

  async function startSession(selectedMode: ExerciseMode, selectedGoal: ExerciseGoal | null): Promise<void> {
    announcedCheckpoints.clear()
    sessionAverage = null
    lastGoalExceededTick = 0

    // Dispara o mais perto possível do clique (gesto do usuário) — o
    // AudioContext compartilhado é criado/retomado dentro desta mesma
    // chamada síncrona, antes de qualquer await, para não esbarrar na
    // política de autoplay do WebView.
    announceOnce('greeting', `Vamos lá, ${USER_NAME}! Boa sessão pra você!`)

    permissionError.value = null

    // Geolocation.requestPermissions() não existe no shim web do Capacitor —
    // lá o próprio getCurrentPosition() já dispara o prompt nativo do navegador.
    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.requestPermissions()
      const granted = permission.location === 'granted' || permission.coarseLocation === 'granted'
      if (!granted) {
        permissionError.value = 'Permissão de localização negada. Ative o GPS para registrar o exercício.'
        throw new Error(permissionError.value)
      }
    }

    const dailyLog = await getOrCreateDailyLog(todayIso())
    dailyLogId = dailyLog.id

    mode.value = selectedMode
    goal.value = selectedGoal
    startedAtIso.value = new Date().toISOString()
    elapsedSeconds.value = 0
    distanceKm.value = 0
    currentSpeedKmh.value = 0
    speedHistory.value = []
    segments.value = []
    goalReached.value = false
    lastFinishedSession.value = null
    lastPosition = null
    candidateType = null
    lastCheckpointKm = 0
    lastCheckpointMin = 0

    const initialType: SegmentType =
      selectedMode === 'running' ? 'run' : selectedMode === 'walking' ? 'walk' : 'idle'
    currentType.value = initialType
    openNewSegment(initialType)

    status.value = 'active'
    startTimers()
    saveSnapshot()

    getLast7DaysAverage()
      .then((avg) => {
        sessionAverage = avg
        saveSnapshot()
      })
      .catch(() => {
        sessionAverage = null
      })
  }

  function pauseSession(): void {
    if (status.value !== 'active') return
    stopTimers()
    closeCurrentSegment()
    status.value = 'paused'
    saveSnapshot()
  }

  function resumeSession(): void {
    if (status.value !== 'paused') return
    openNewSegment(currentType.value)
    status.value = 'active'
    startTimers()
    saveSnapshot()
  }

  async function finishSession(): Promise<FinishedSession> {
    stopTimers()
    closeCurrentSegment()
    status.value = 'finished'
    clearSnapshot()

    const endedAt = new Date().toISOString()

    const result: FinishedSession = {
      dailyLogId,
      startedAt: startedAtIso.value ?? endedAt,
      endedAt,
      totalMinutes: elapsedSeconds.value / 60,
      distanceKm: distanceKm.value,
      avgSpeedKmh: avgSpeedKmh.value,
      calories: estimateCalories(),
      mode: mode.value,
      goalType: goal.value?.type ?? null,
      goalValue: goal.value?.value ?? null,
      segments: segments.value.map((s) => ({
        type: s.type,
        startedAt: s.startedAt,
        endedAt: s.endedAt ?? endedAt,
        durationS: s.durationS,
      })),
    }

    lastFinishedSession.value = result
    announceSessionSummary(result)
    return result
  }

  /** Resumo completo ao encerrar: uma única chamada a speak() com tudo junto. */
  function announceSessionSummary(result: FinishedSession): void {
    const { settings } = useSettingsStore()
    if (!settings.assistantEnabled) return

    const summary = toSessionSummary(result)
    const average = sessionAverage ?? {
      avgDistanceKm: 0,
      avgRunningKm: 0,
      avgWalkingKm: 0,
      avgDurationMin: 0,
      avgSpeedKmh: 0,
      totalSessions: 0,
    }
    const report = compareWithAverage(summary, average)

    const parts: string[] = [
      'Sessão encerrada!',
      `Você percorreu ${fmt(summary.distanceKm)} quilômetros em ${Math.round(summary.durationMin)} minutos.`,
      `Sendo ${fmt(summary.runningKm)} quilômetros correndo e ${fmt(summary.walkingKm)} quilômetros caminhando.`,
    ]

    if (average.totalSessions > 0) {
      if (report.isRecord) {
        parts.push(
          `Comparando com sua média dos últimos 7 dias, você correu ${fmt(Math.abs(report.runningDiffKm))} quilômetros a mais com velocidade consistente. Recorde pessoal!`,
        )
      } else if (report.isConsistency) {
        parts.push(`Você foi mais longe, mas num ritmo mais tranquilo. Isso se chama consistência, ${USER_NAME}. Muito bom!`)
      } else if (report.isPaceRecord) {
        parts.push('Mesma distância, porém mais rápido que sua média. Recorde de ritmo!')
      } else if (report.walkedLessRanMore) {
        parts.push('Seu fôlego tá melhorando. Você andou menos, mas correu mais. Evolução!')
      } else if (report.distanceDiffKm <= 0) {
        parts.push(`Hoje foi mais tranquilo, mas você foi lá e fez. Isso é o que importa, ${USER_NAME}!`)
      }

      if (report.firstRunAfterDaysWalking) {
        parts.push('Olha só! Você voltou a correr. Que ótima notícia!')
      }
    }

    if (summary.avgSpeedKmh > 0) {
      parts.push(`Velocidade média de corrida: ${fmt(summary.avgSpeedKmh)} quilômetros por hora.`)
    }

    void useSpeech().speak(parts.join(' '))
  }

  function resetSession(): void {
    status.value = 'idle'
    lastFinishedSession.value = null
    clearSnapshot()
  }

  // Roda uma única vez, na criação do store (primeiro useActivityStore()
  // chamado no app) — inclusive logo após relançar depois de o processo
  // ser morto em background.
  restoreFromSnapshot()

  return {
    status,
    mode,
    goal,
    elapsedSeconds,
    distanceKm,
    currentSpeedKmh,
    avgSpeedKmh,
    speedHistory,
    segments,
    liveSegments,
    currentType,
    goalReached,
    goalProgressPercent,
    lastFinishedSession,
    permissionError,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
    resetSession,
  }
})
