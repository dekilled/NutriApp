import { getDatabase } from '@/db'

export interface MealSlot {
  id: number
  name: string
  order_index: number
}

export interface NutritionPlan {
  id: number
  created_at: string
  label: string
  is_active: number
  notes: string | null
}

export interface PlanMeal {
  id: number
  plan_id: number
  slot_id: number
  scheduled_time: string | null
  description: string
  quantity: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string | null
}

export interface FoodGuideline {
  id: number
  plan_id: number
  food: string
  type: string
  reason: string | null
}

export async function listMealSlots(): Promise<MealSlot[]> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM meal_slots ORDER BY order_index ASC;')
  return (values ?? []) as MealSlot[]
}

export async function listPlans(): Promise<NutritionPlan[]> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM nutrition_plan ORDER BY created_at DESC;')
  return (values ?? []) as NutritionPlan[]
}

export async function getPlan(planId: number): Promise<NutritionPlan | null> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM nutrition_plan WHERE id = ?;', [planId])
  return (values?.[0] as NutritionPlan | undefined) ?? null
}

export async function getActivePlan(): Promise<NutritionPlan | null> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM nutrition_plan WHERE is_active = 1 LIMIT 1;')
  return ((values?.[0] as NutritionPlan | undefined) ?? null)
}

export async function createPlan(input: { label: string; notes?: string }): Promise<number> {
  const db = getDatabase()
  const result = await db.run('INSERT INTO nutrition_plan (label, notes) VALUES (?, ?);', [
    input.label,
    input.notes ?? null,
  ])
  return result.changes?.lastId ?? 0
}

export async function setActivePlan(planId: number): Promise<void> {
  const db = getDatabase()
  await db.execute('UPDATE nutrition_plan SET is_active = 0;')
  await db.run('UPDATE nutrition_plan SET is_active = 1 WHERE id = ?;', [planId])
}

export async function listPlanMeals(planId: number): Promise<PlanMeal[]> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT * FROM plan_meals WHERE plan_id = ? ORDER BY scheduled_time ASC;',
    [planId],
  )
  return (values ?? []) as PlanMeal[]
}

export async function addPlanMeal(
  input: Omit<PlanMeal, 'id'>,
): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    `INSERT INTO plan_meals
      (plan_id, slot_id, scheduled_time, description, quantity, calories, protein_g, carbs_g, fat_g, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.plan_id,
      input.slot_id,
      input.scheduled_time,
      input.description,
      input.quantity,
      input.calories,
      input.protein_g,
      input.carbs_g,
      input.fat_g,
      input.notes,
    ],
  )
  return result.changes?.lastId ?? 0
}

export async function updatePlanMeal(
  id: number,
  changes: Partial<Pick<PlanMeal, 'scheduled_time' | 'notes'>>,
): Promise<void> {
  const db = getDatabase()
  if (changes.scheduled_time !== undefined) {
    await db.run('UPDATE plan_meals SET scheduled_time = ? WHERE id = ?;', [
      changes.scheduled_time,
      id,
    ])
  }
  if (changes.notes !== undefined) {
    await db.run('UPDATE plan_meals SET notes = ? WHERE id = ?;', [changes.notes, id])
  }
}

export async function deletePlanMeal(id: number): Promise<void> {
  const db = getDatabase()
  await db.run('DELETE FROM plan_meals WHERE id = ?;', [id])
}

export async function listFoodGuidelines(planId: number): Promise<FoodGuideline[]> {
  const db = getDatabase()
  const { values } = await db.query('SELECT * FROM food_guidelines WHERE plan_id = ?;', [planId])
  return (values ?? []) as FoodGuideline[]
}

export async function addFoodGuideline(input: Omit<FoodGuideline, 'id'>): Promise<number> {
  const db = getDatabase()
  const result = await db.run(
    'INSERT INTO food_guidelines (plan_id, food, type, reason) VALUES (?, ?, ?, ?);',
    [input.plan_id, input.food, input.type, input.reason],
  )
  return result.changes?.lastId ?? 0
}

export async function deleteFoodGuideline(id: number): Promise<void> {
  const db = getDatabase()
  await db.run('DELETE FROM food_guidelines WHERE id = ?;', [id])
}

export interface PlanSlotConfig {
  notes: string
  isControllable: boolean
  isOvernight: boolean
}

const DEFAULT_SLOT_CONFIG: PlanSlotConfig = { notes: '', isControllable: true, isOvernight: false }

async function ensureSlotConfigRow(planId: number, slotId: number): Promise<number> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT id FROM plan_slot_notes WHERE plan_id = ? AND slot_id = ?;',
    [planId, slotId],
  )
  if (values && values.length > 0) return values[0].id as number

  const result = await db.run('INSERT INTO plan_slot_notes (plan_id, slot_id) VALUES (?, ?);', [
    planId,
    slotId,
  ])
  return result.changes?.lastId ?? 0
}

export async function getSlotConfig(planId: number, slotId: number): Promise<PlanSlotConfig> {
  const db = getDatabase()
  const { values } = await db.query(
    'SELECT notes, is_controllable, is_overnight FROM plan_slot_notes WHERE plan_id = ? AND slot_id = ?;',
    [planId, slotId],
  )
  const row = values?.[0]
  if (!row) return { ...DEFAULT_SLOT_CONFIG }
  return {
    notes: (row.notes as string | null) ?? '',
    isControllable: (row.is_controllable as number | null) !== 0,
    isOvernight: (row.is_overnight as number | null) === 1,
  }
}

export async function setSlotNotes(planId: number, slotId: number, notes: string): Promise<void> {
  const db = getDatabase()
  const id = await ensureSlotConfigRow(planId, slotId)
  await db.run('UPDATE plan_slot_notes SET notes = ? WHERE id = ?;', [notes, id])
}

export async function setSlotControllable(planId: number, slotId: number, value: boolean): Promise<void> {
  const db = getDatabase()
  const id = await ensureSlotConfigRow(planId, slotId)
  await db.run('UPDATE plan_slot_notes SET is_controllable = ? WHERE id = ?;', [value ? 1 : 0, id])
}

export async function setSlotOvernight(planId: number, slotId: number, value: boolean): Promise<void> {
  const db = getDatabase()
  const id = await ensureSlotConfigRow(planId, slotId)
  await db.run('UPDATE plan_slot_notes SET is_overnight = ? WHERE id = ?;', [value ? 1 : 0, id])
}
