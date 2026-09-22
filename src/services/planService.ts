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
      (plan_id, slot_id, scheduled_time, description, calories, protein_g, carbs_g, fat_g, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.plan_id,
      input.slot_id,
      input.scheduled_time,
      input.description,
      input.calories,
      input.protein_g,
      input.carbs_g,
      input.fat_g,
      input.notes,
    ],
  )
  return result.changes?.lastId ?? 0
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
