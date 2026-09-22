import { getDatabase } from '@/db'

export interface ActivitySession {
  id: number
  daily_log_id: number
  started_at: string
  ended_at: string | null
  total_minutes: number | null
  notes: string | null
}

export interface ActivitySegment {
  id: number
  session_id: number
  type: string
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

export async function addActivitySegment(
  input: Omit<ActivitySegment, 'id'>,
): Promise<number> {
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
