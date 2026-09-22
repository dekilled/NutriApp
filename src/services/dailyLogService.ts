import { getDatabase } from '@/db'

export type MealLogStatus = 'pending' | 'done' | 'skipped'

export interface DailyLog {
  id: number
  log_date: string
  plan_id: number | null
  notes: string | null
}

export interface MealLog {
  id: number
  daily_log_id: number
  slot_id: number
  plan_meal_id: number | null
  status: MealLogStatus
  actual_description: string | null
  actual_calories: number | null
  logged_at: string | null
  notes: string | null
  prepared_at: string | null
  is_prepared: number
}

export async function getOrCreateDailyLog(logDate: string, planId?: number | null): Promise<DailyLog> {
  const db = getDatabase()
  const existing = await db.query('SELECT * FROM daily_logs WHERE log_date = ?;', [logDate])

  if (existing.values && existing.values.length > 0) {
    return existing.values[0] as DailyLog
  }

  const result = await db.run('INSERT INTO daily_logs (log_date, plan_id) VALUES (?, ?);', [
    logDate,
    planId ?? null,
  ])
  const id = result.changes?.lastId ?? 0
  return { id, log_date: logDate, plan_id: planId ?? null, notes: null }
}

export async function listMealLogs(dailyLogId: number): Promise<MealLog[]> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM meal_logs WHERE daily_log_id = ?;', [dailyLogId])
  return (values ?? []) as MealLog[]
}

async function findMealLog(dailyLogId: number, slotId: number): Promise<MealLog | null> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT * FROM meal_logs WHERE daily_log_id = ? AND slot_id = ?;',
    [dailyLogId, slotId],
  )
  return (values?.[0] as MealLog | undefined) ?? null
}

async function ensureMealLog(dailyLogId: number, slotId: number, planMealId: number | null): Promise<MealLog> {
  const existing = await findMealLog(dailyLogId, slotId)
  if (existing) return existing

  const db = getDatabase()
  const result = await db.run(
    'INSERT INTO meal_logs (daily_log_id, slot_id, plan_meal_id) VALUES (?, ?, ?);',
    [dailyLogId, slotId, planMealId],
  )
  const id = result.changes?.lastId ?? 0
  return {
    id,
    daily_log_id: dailyLogId,
    slot_id: slotId,
    plan_meal_id: planMealId,
    status: 'pending',
    actual_description: null,
    actual_calories: null,
    logged_at: null,
    notes: null,
    prepared_at: null,
    is_prepared: 0,
  }
}

/** Marca como feito conforme o plano (sem descrição alternativa). */
export async function markMealDone(dailyLogId: number, slotId: number, planMealId: number | null): Promise<void> {
  const db = getDatabase()
  const log = await ensureMealLog(dailyLogId, slotId, planMealId)
  await db.run(
    "UPDATE meal_logs SET status = 'done', actual_description = NULL, actual_calories = NULL, logged_at = datetime('now') WHERE id = ?;",
    [log.id],
  )
}

/** Marca como feito, mas diferente do planejado (com descrição livre e calorias opcionais). */
export async function markMealModified(
  dailyLogId: number,
  slotId: number,
  planMealId: number | null,
  description: string,
  calories: number | null,
): Promise<void> {
  const db = getDatabase()
  const log = await ensureMealLog(dailyLogId, slotId, planMealId)
  await db.run(
    "UPDATE meal_logs SET status = 'done', actual_description = ?, actual_calories = ?, logged_at = datetime('now') WHERE id = ?;",
    [description, calories, log.id],
  )
}

export async function markMealSkipped(dailyLogId: number, slotId: number, planMealId: number | null): Promise<void> {
  const db = getDatabase()
  const log = await ensureMealLog(dailyLogId, slotId, planMealId)
  await db.run(
    "UPDATE meal_logs SET status = 'skipped', actual_description = NULL, actual_calories = NULL, logged_at = datetime('now') WHERE id = ?;",
    [log.id],
  )
}

/** Desfaz o registro do slot, voltando para pendente (não mexe em is_prepared). */
export async function resetMealLog(dailyLogId: number, slotId: number): Promise<void> {
  const db = getDatabase()
  const log = await findMealLog(dailyLogId, slotId)
  if (!log) return
  await db.run(
    "UPDATE meal_logs SET status = 'pending', actual_description = NULL, actual_calories = NULL, logged_at = NULL WHERE id = ?;",
    [log.id],
  )
}

/** Overnight: alterna o estado "preparado" (marcado à noite, antes de comer). */
export async function toggleMealPrepared(
  dailyLogId: number,
  slotId: number,
  planMealId: number | null,
): Promise<boolean> {
  const db = getDatabase()
  const log = await ensureMealLog(dailyLogId, slotId, planMealId)
  const nextPrepared = log.is_prepared ? 0 : 1
  await db.run(
    "UPDATE meal_logs SET is_prepared = ?, prepared_at = ? WHERE id = ?;",
    [nextPrepared, nextPrepared ? new Date().toISOString() : null, log.id],
  )
  return nextPrepared === 1
}

export interface DayAdherence {
  log_date: string
  total: number
  done: number
}

/** Adesão diária (refeições feitas vs. total registrado) num intervalo de datas [from, to]. */
export async function getAdherenceByDateRange(fromDate: string, toDate: string): Promise<DayAdherence[]> {
  const db = getDatabase()
  const { values } = await db.query(
    `SELECT dl.log_date as log_date,
            COUNT(ml.id) as total,
            SUM(CASE WHEN ml.status = 'done' THEN 1 ELSE 0 END) as done
     FROM daily_logs dl
     LEFT JOIN meal_logs ml ON ml.daily_log_id = dl.id
     WHERE dl.log_date BETWEEN ? AND ?
     GROUP BY dl.log_date
     ORDER BY dl.log_date ASC;`,
    [fromDate, toDate],
  )
  return (values ?? []) as DayAdherence[]
}
