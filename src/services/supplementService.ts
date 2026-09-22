import { getDatabase } from '@/db'

export type SupplementLogStatus = 'pending' | 'done' | 'skipped'
export type SupplementType = 'simple' | 'recipe'
export type IngredientUnit = 'g' | 'ml' | 'unidade' | 'colher' | 'xícara' | 'pitada'

export const INGREDIENT_UNITS: IngredientUnit[] = ['g', 'ml', 'unidade', 'colher', 'xícara', 'pitada']

export interface PlanSupplement {
  id: number
  plan_id: number
  name: string
  dose: string | null
  scheduled_time: string | null
  with_meal_slot: number | null
  notes: string | null
  type: SupplementType
  serving_description: string | null
}

export interface SupplementIngredient {
  id: number
  supplement_id: number
  ingredient: string
  quantity: number | null
  unit: IngredientUnit | null
  order_index: number
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

export interface CreateSupplementInput {
  plan_id: number
  name: string
  dose: string | null
  scheduled_time: string | null
  with_meal_slot: number | null
  notes: string | null
  type: SupplementType
  serving_description: string | null
  ingredients?: Array<Pick<SupplementIngredient, 'ingredient' | 'quantity' | 'unit' | 'order_index'>>
}

export async function createSupplement(input: CreateSupplementInput): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    `INSERT INTO plan_supplements
      (plan_id, name, dose, scheduled_time, with_meal_slot, notes, type, serving_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.plan_id,
      input.name,
      input.dose,
      input.scheduled_time,
      input.with_meal_slot,
      input.notes,
      input.type,
      input.serving_description,
    ],
  )
  const supplementId = result.changes?.lastId ?? 0

  if (input.type === 'recipe' && input.ingredients?.length) {
    for (const ingredient of input.ingredients) {
      await addIngredient(supplementId, ingredient)
    }
  }

  return supplementId
}

export interface SupplementWithIngredients extends PlanSupplement {
  ingredients: SupplementIngredient[]
}

export async function getSupplement(id: number): Promise<SupplementWithIngredients | null> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM plan_supplements WHERE id = ?;', [id])
  const supplement = (values?.[0] as PlanSupplement | undefined) ?? null
  if (!supplement) return null

  const ingredients =
    supplement.type === 'recipe' ? await listIngredients(supplement.id) : []

  return { ...supplement, ingredients }
}

export async function listIngredients(supplementId: number): Promise<SupplementIngredient[]> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT * FROM supplement_ingredients WHERE supplement_id = ? ORDER BY order_index ASC, id ASC;',
    [supplementId],
  )
  return (values ?? []) as SupplementIngredient[]
}

export async function addIngredient(
  supplementId: number,
  ingredient: Pick<SupplementIngredient, 'ingredient' | 'quantity' | 'unit' | 'order_index'>,
): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    `INSERT INTO supplement_ingredients (supplement_id, ingredient, quantity, unit, order_index)
     VALUES (?, ?, ?, ?, ?);`,
    [supplementId, ingredient.ingredient, ingredient.quantity, ingredient.unit, ingredient.order_index],
  )
  return result.changes?.lastId ?? 0
}

export async function updateIngredient(
  id: number,
  changes: Partial<Pick<SupplementIngredient, 'ingredient' | 'quantity' | 'unit' | 'order_index'>>,
): Promise<void> {
  const db = getDatabase()
  if (changes.ingredient !== undefined) {
    await db.run('UPDATE supplement_ingredients SET ingredient = ? WHERE id = ?;', [
      changes.ingredient,
      id,
    ])
  }
  if (changes.quantity !== undefined) {
    await db.run('UPDATE supplement_ingredients SET quantity = ? WHERE id = ?;', [changes.quantity, id])
  }
  if (changes.unit !== undefined) {
    await db.run('UPDATE supplement_ingredients SET unit = ? WHERE id = ?;', [changes.unit, id])
  }
  if (changes.order_index !== undefined) {
    await db.run('UPDATE supplement_ingredients SET order_index = ? WHERE id = ?;', [
      changes.order_index,
      id,
    ])
  }
}

export async function removeIngredient(id: number): Promise<void> {
  const db = getDatabase()
  await db.run('DELETE FROM supplement_ingredients WHERE id = ?;', [id])
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
