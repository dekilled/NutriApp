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

export async function upsertMealLog(input: Omit<MealLog, 'id' | 'status'> & { id?: number }): Promise<number> {
  const db = getDatabase()

  if (input.id) {
    await db.run(
      `UPDATE meal_logs SET slot_id = ?, plan_meal_id = ?, actual_description = ?,
        actual_calories = ?, logged_at = ?, notes = ? WHERE id = ?;`,
      [
        input.slot_id,
        input.plan_meal_id,
        input.actual_description,
        input.actual_calories,
        input.logged_at,
        input.notes,
        input.id,
      ],
    )
    return input.id
  }

  const result = await db.run(
    `INSERT INTO meal_logs
      (daily_log_id, slot_id, plan_meal_id, actual_description, actual_calories, logged_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      input.daily_log_id,
      input.slot_id,
      input.plan_meal_id,
      input.actual_description,
      input.actual_calories,
      input.logged_at,
      input.notes,
    ],
  )
  return result.changes?.lastId ?? 0
}

export async function updateMealLogStatus(id: number, status: MealLogStatus): Promise<void> {
  const db = getDatabase()
  await db.run("UPDATE meal_logs SET status = ?, logged_at = datetime('now') WHERE id = ?;", [
    status,
    id,
  ])
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
