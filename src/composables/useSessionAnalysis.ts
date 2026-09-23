import { listRecentSessions } from '@/services/activityService'
import type { FinishedSession } from './useExerciseSession'

const SPEED_TOLERANCE = 0.1 // ±10%
const DISTANCE_TOLERANCE = 0.1 // ±10% (ou 0.1km em médias muito pequenas)
const LAST_N_SESSIONS = 7

export interface SessionAverage {
  avgDistanceKm: number
  avgRunningKm: number
  avgWalkingKm: number
  avgDurationMin: number
  /** Velocidade média DE CORRIDA (não a sessão toda) entre as sessões com corrida. */
  avgSpeedKmh: number
  totalSessions: number
}

export interface SessionSummary {
  distanceKm: number
  runningKm: number
  walkingKm: number
  durationMin: number
  /** Velocidade média de corrida desta sessão (0 se não correu). */
  avgSpeedKmh: number
  runSegmentCount: number
}

export interface PerformanceReport {
  ranMoreThanAvg: boolean
  walkedLessRanMore: boolean
  distanceDiffKm: number
  runningDiffKm: number
  isConsistency: boolean
  isRecord: boolean
  isPaceRecord: boolean
  secondRunInSession: boolean
  thirdRunInSession: boolean
  firstRunAfterDaysWalking: boolean
}

interface SegmentDuration {
  type: string
  durationS: number
}

function splitDistanceByType(
  distanceKm: number,
  segments: SegmentDuration[],
): { runningKm: number; walkingKm: number; runS: number } {
  const runS = segments.filter((s) => s.type === 'run').reduce((sum, s) => sum + s.durationS, 0)
  const walkS = segments.filter((s) => s.type === 'walk').reduce((sum, s) => sum + s.durationS, 0)
  const activeS = runS + walkS
  if (activeS === 0) return { runningKm: 0, walkingKm: 0, runS: 0 }

  return {
    runningKm: distanceKm * (runS / activeS),
    walkingKm: distanceKm * (walkS / activeS),
    runS,
  }
}

/** Constrói o resumo (distância separada por tipo) a partir de uma sessão recém-finalizada. */
export function toSessionSummary(session: FinishedSession): SessionSummary {
  const { runningKm, walkingKm, runS } = splitDistanceByType(
    session.distanceKm,
    session.segments.map((s) => ({ type: s.type, durationS: s.durationS })),
  )
  const runSegmentCount = session.segments.filter((s) => s.type === 'run').length

  return {
    distanceKm: session.distanceKm,
    runningKm,
    walkingKm,
    durationMin: session.totalMinutes,
    avgSpeedKmh: runS > 0 ? runningKm / (runS / 3600) : 0,
    runSegmentCount,
  }
}

/** Busca as últimas 7 sessões registradas (não "7 dias corridos") e calcula as médias. */
export async function getLast7DaysAverage(): Promise<SessionAverage> {
  const sessions = await listRecentSessions(LAST_N_SESSIONS)

  if (sessions.length === 0) {
    return { avgDistanceKm: 0, avgRunningKm: 0, avgWalkingKm: 0, avgDurationMin: 0, avgSpeedKmh: 0, totalSessions: 0 }
  }

  let totalDistance = 0
  let totalRunning = 0
  let totalWalking = 0
  let totalDuration = 0
  let totalRunningSpeed = 0
  let sessionsWithRunning = 0

  for (const session of sessions) {
    const distance = session.distance_km ?? 0
    const { runningKm, walkingKm, runS } = splitDistanceByType(
      distance,
      session.segments.map((s) => ({ type: s.type, durationS: s.duration_s ?? 0 })),
    )

    totalDistance += distance
    totalRunning += runningKm
    totalWalking += walkingKm
    totalDuration += session.total_minutes ?? 0

    if (runS > 0) {
      totalRunningSpeed += runningKm / (runS / 3600)
      sessionsWithRunning += 1
    }
  }

  const n = sessions.length
  return {
    avgDistanceKm: totalDistance / n,
    avgRunningKm: totalRunning / n,
    avgWalkingKm: totalWalking / n,
    avgDurationMin: totalDuration / n,
    avgSpeedKmh: sessionsWithRunning > 0 ? totalRunningSpeed / sessionsWithRunning : 0,
    totalSessions: n,
  }
}

/** Compara a sessão atual com a média histórica, per as regras de negócio da Emma. */
export function compareWithAverage(current: SessionSummary, average: SessionAverage): PerformanceReport {
  const distanceDiffKm = current.distanceKm - average.avgDistanceKm
  const runningDiffKm = current.runningKm - average.avgRunningKm

  const speedDiffPct =
    average.avgSpeedKmh > 0 ? (current.avgSpeedKmh - average.avgSpeedKmh) / average.avgSpeedKmh : 0
  const similarOrFaster = speedDiffPct >= -SPEED_TOLERANCE

  const distanceToleranceKm = average.avgDistanceKm > 0 ? average.avgDistanceKm * DISTANCE_TOLERANCE : 0.1
  const sameDistance = Math.abs(distanceDiffKm) <= distanceToleranceKm

  const ranMoreThanAvg = runningDiffKm > 0
  const walkedLessRanMore = current.walkingKm < average.avgWalkingKm && runningDiffKm > 0

  // Recorde e consistência exigem distância maior E fora da "mesma distância";
  // pace record cobre justamente a faixa de "mesma distância".
  const wentFarther = distanceDiffKm > 0 && !sameDistance
  const isRecord = wentFarther && similarOrFaster
  const isConsistency = wentFarther && !similarOrFaster
  const isPaceRecord = sameDistance && speedDiffPct > SPEED_TOLERANCE

  const secondRunInSession = current.runSegmentCount === 2
  const thirdRunInSession = current.runSegmentCount >= 3

  // Proxy usando só (current, average): histórico recente sem corrida
  // relevante (avgRunningKm ~0) e esta sessão correu de verdade.
  const firstRunAfterDaysWalking = average.avgRunningKm < 0.05 && current.runningKm > 0.1

  return {
    ranMoreThanAvg,
    walkedLessRanMore,
    distanceDiffKm,
    runningDiffKm,
    isConsistency,
    isRecord,
    isPaceRecord,
    secondRunInSession,
    thirdRunInSession,
    firstRunAfterDaysWalking,
  }
}
