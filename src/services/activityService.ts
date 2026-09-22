import { getDatabase } from '@/db'

export type ExerciseMode = 'walking' | 'running' | 'auto'
export type ExerciseGoalType = 'distance' | 'time'
export type SegmentType = 'walk' | 'run' | 'idle'

export interface ActivitySession {
  id: number
  daily_log_id: number
  started_at: string
  ended_at: string | null
  total_minutes: number | null
  notes: string | null
  mode: ExerciseMode | null
  distance_km: number | null
  avg_speed_kmh: number | null
  calories: number | null
  goal_type: ExerciseGoalType | null
  goal_value: number | null
}

export interface ActivitySegment {
  id: number
  session_id: number
  type: SegmentType
  started_at: string
  ended_at: string | null
  duration_s: number | null
  confidence: number | null
}

export async function startActivitySession(dailyLogId: number, notes?: string): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    "INSERT INTO activity_sessions (daily_log_id, started_at, notes) VALUES (?, datetime('now'), ?);",
    [dailyLogId, notes ?? null],
  )
  return result.changes?.lastId ?? 0
}

export async function endActivitySession(sessionId: number, totalMinutes: number): Promise<void> {
  const db = getDatabase()
  await db.run(
    "UPDATE activity_sessions SET ended_at = datetime('now'), total_minutes = ? WHERE id = ?;",
    [totalMinutes, sessionId],
  )
}

export async function listActivitySessions(dailyLogId: number): Promise<ActivitySession[]> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT * FROM activity_sessions WHERE daily_log_id = ? ORDER BY started_at DESC;',
    [dailyLogId],
  )
  return (values ?? []) as ActivitySession[]
}

export async function addActivitySegment(input: Omit<ActivitySegment, 'id'>): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    `INSERT INTO activity_segments
      (session_id, type, started_at, ended_at, duration_s, confidence)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [input.session_id, input.type, input.started_at, input.ended_at, input.duration_s, input.confidence],
  )
  return result.changes?.lastId ?? 0
}

export async function listActivitySegments(sessionId: number): Promise<ActivitySegment[]> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT * FROM activity_segments WHERE session_id = ? ORDER BY started_at ASC;',
    [sessionId],
  )
  return (values ?? []) as ActivitySegment[]
}

export interface SessionWithSegments extends ActivitySession {
  segments: ActivitySegment[]
}

/** Sessões mais recentes (de qualquer dia) com seus segmentos já carregados. */
export async function listRecentSessions(limit: number): Promise<SessionWithSegments[]> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT * FROM activity_sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?;',
    [limit],
  )
  const sessions = (values ?? []) as ActivitySession[]

  const withSegments: SessionWithSegments[] = []
  for (const session of sessions) {
    const segments = await listActivitySegments(session.id)
    withSegments.push({ ...session, segments })
  }
  return withSegments
}

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

/** Persiste uma sessão de exercício já finalizada (GPS) e seus segmentos. */
export async function saveSession(session: FinishedSession): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    `INSERT INTO activity_sessions
      (daily_log_id, started_at, ended_at, total_minutes, mode, distance_km, avg_speed_kmh, calories, goal_type, goal_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      session.dailyLogId,
      session.startedAt,
      session.endedAt,
      session.totalMinutes,
      session.mode,
      session.distanceKm,
      session.avgSpeedKmh,
      session.calories,
      session.goalType,
      session.goalValue,
    ],
  )
  const sessionId = result.changes?.lastId ?? 0

  for (const segment of session.segments) {
    await addActivitySegment({
      session_id: sessionId,
      type: segment.type,
      started_at: segment.startedAt,
      ended_at: segment.endedAt,
      duration_s: segment.durationS,
      confidence: 1,
    })
  }

  return sessionId
}
