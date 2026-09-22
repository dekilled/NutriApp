import { getDatabase } from '@/db'

export type SupplementLogStatus = 'pending' | 'done' | 'skipped'

export interface PlanSupplement {
  id: number
  plan_id: number
  name: string
  dose: string | null
  scheduled_time: string | null
  with_meal_slot: number | null
  notes: string | null
}

export interface SupplementLog {
  id: number
  daily_log_id: number
  plan_supplement_id: number
  status: SupplementLogStatus
  logged_at: string | null
  notes: string | null
}

export async function listPlanSupplements(planId: number): Promise<PlanSupplement[]> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM plan_supplements WHERE plan_id = ?;', [planId])
  return (values ?? []) as PlanSupplement[]
}

export async function addPlanSupplement(input: Omit<PlanSupplement, 'id'>): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    `INSERT INTO plan_supplements
      (plan_id, name, dose, scheduled_time, with_meal_slot, notes)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [input.plan_id, input.name, input.dose, input.scheduled_time, input.with_meal_slot, input.notes],
  )
  return result.changes?.lastId ?? 0
}

export async function listSupplementLogs(dailyLogId: number): Promise<SupplementLog[]> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM supplement_logs WHERE daily_log_id = ?;', [
    dailyLogId,
  ])
  return (values ?? []) as SupplementLog[]
}

export async function logSupplement(
  dailyLogId: number,
  planSupplementId: number,
  status: SupplementLogStatus,
  notes?: string,
): Promise<number> {
  const db = getDatabase()
  const existing = await db.query(
    'SELECT id FROM supplement_logs WHERE daily_log_id = ? AND plan_supplement_id = ?;',
    [dailyLogId, planSupplementId],
  )

  if (existing.values && existing.values.length > 0) {
    const id = existing.values[0].id as number
    await db.run(
      "UPDATE supplement_logs SET status = ?, logged_at = datetime('now'), notes = ? WHERE id = ?;",
      [status, notes ?? null, id],
    )
    return id
  }

  const result = await db.run(
    `INSERT INTO supplement_logs (daily_log_id, plan_supplement_id, status, logged_at, notes)
     VALUES (?, ?, ?, datetime('now'), ?);`,
    [dailyLogId, planSupplementId, status, notes ?? null],
  )
  return result.changes?.lastId ?? 0
}

export async function deletePlanSupplement(id: number): Promise<void> {
  const db = getDatabase()
  await db.run('DELETE FROM plan_supplements WHERE id = ?;', [id])
}

export interface SupplementHistoryDay {
  log_date: string
  status: SupplementLogStatus
}

/** Histórico dos últimos N dias de um suplemento, para o mini calendário de checks. */
export async function getSupplementHistory(
  planSupplementId: number,
  days: number,
): Promise<SupplementHistoryDay[]> {
  const db = getDatabase()
  const { values } = await db.query(
    `SELECT dl.log_date as log_date, sl.status as status
     FROM daily_logs dl
     LEFT JOIN supplement_logs sl
       ON sl.daily_log_id = dl.id AND sl.plan_supplement_id = ?
     ORDER BY dl.log_date DESC
     LIMIT ?;`,
    [planSupplementId, days],
  )
  return (values ?? []) as SupplementHistoryDay[]
}
