import { Capacitor } from '@capacitor/core'
import { Geolocation, type Position } from '@capacitor/geolocation'
import { Haptics } from '@capacitor/haptics'
import { computed, ref } from 'vue'

import type { ExerciseGoalType, ExerciseMode, SegmentType } from '@/services/activityService'
import { getOrCreateDailyLog } from '@/services/dailyLogService'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { todayIso } from '@/utils/date'

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

// Estado em módulo (singleton): compartilhado entre NewExerciseView,
// ActiveSessionView e SessionSummaryView sem precisar de route params.
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

/**
 * Preparado para o futuro sistema de anúncios (voz/haptics) por checkpoint.
 * Hoje só marca a passagem do km/intervalo — nenhuma notificação é disparada.
 */
function checkCheckpoints() {
  const { settings } = useSettingsStore()

  if (settings.checkpointsByKmEnabled) {
    const kmMark = Math.floor(distanceKm.value)
    if (kmMark > lastCheckpointKm) {
      lastCheckpointKm = kmMark
    }
  }

  if (settings.checkpointsByTimeEnabled && settings.checkpointsByTimeIntervalMin > 0) {
    const minuteMark = Math.floor(elapsedSeconds.value / 60)
    if (
      minuteMark > 0 &&
      minuteMark % settings.checkpointsByTimeIntervalMin === 0 &&
      minuteMark > lastCheckpointMin
    ) {
      lastCheckpointMin = minuteMark
    }
  }
}

async function checkGoal() {
  if (!goal.value || goalReached.value) return

  const reached =
    goal.value.type === 'distance'
      ? distanceKm.value >= goal.value.value
      : elapsedSeconds.value / 60 >= goal.value.value

  if (reached) {
    goalReached.value = true
    try {
      await Haptics.vibrate({ duration: 400 })
    } catch {
      // dispositivo sem suporte a haptics — segue sem feedback tátil
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
}

async function pollPosition() {
  try {
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })
    handlePosition(position)
  } catch (error) {
    console.error('[useExerciseSession] falha ao obter posição GPS:', error)
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
}

function pauseSession(): void {
  if (status.value !== 'active') return
  stopTimers()
  closeCurrentSegment()
  status.value = 'paused'
}

function resumeSession(): void {
  if (status.value !== 'paused') return
  openNewSegment(currentType.value)
  status.value = 'active'
  startTimers()
}

async function finishSession(): Promise<FinishedSession> {
  stopTimers()
  closeCurrentSegment()
  status.value = 'finished'

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
  return result
}

function resetSession(): void {
  status.value = 'idle'
  lastFinishedSession.value = null
}

export function useExerciseSession() {
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
}
