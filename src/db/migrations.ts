import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

import { CREATE_SUPPLEMENT_INGREDIENTS_SQL, CREATE_TABLES_SQL } from './schema'

export interface Migration {
  version: number
  up: string
}

const ADD_QUANTITY_AND_SLOT_NOTES_SQL = `
ALTER TABLE plan_meals ADD COLUMN quantity TEXT;

CREATE TABLE IF NOT EXISTS plan_slot_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  slot_id INTEGER NOT NULL,
  notes TEXT,
  UNIQUE(plan_id, slot_id),
  FOREIGN KEY (plan_id) REFERENCES nutrition_plan(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES meal_slots(id) ON DELETE CASCADE
);
`

const ADD_SUPPLEMENT_RECIPES_SQL = `
ALTER TABLE plan_supplements ADD COLUMN type TEXT DEFAULT 'simple';
ALTER TABLE plan_supplements ADD COLUMN serving_description TEXT;

${CREATE_SUPPLEMENT_INGREDIENTS_SQL}
`

// Sessão de exercício ganha GPS: precisa persistir distância, velocidade
// média, calorias estimadas, o modo escolhido (walking/running/auto) e a
// meta definida (se houver), nada disso existia até a v3.
const ADD_EXERCISE_SESSION_FIELDS_SQL = `
ALTER TABLE activity_sessions ADD COLUMN mode TEXT;
ALTER TABLE activity_sessions ADD COLUMN distance_km REAL;
ALTER TABLE activity_sessions ADD COLUMN avg_speed_kmh REAL;
ALTER TABLE activity_sessions ADD COLUMN calories REAL;
ALTER TABLE activity_sessions ADD COLUMN goal_type TEXT;
ALTER TABLE activity_sessions ADD COLUMN goal_value REAL;
`

export const migrations: Migration[] = [
  { version: 1, up: CREATE_TABLES_SQL },
  { version: 2, up: ADD_QUANTITY_AND_SLOT_NOTES_SQL },
  { version: 3, up: ADD_SUPPLEMENT_RECIPES_SQL },
  { version: 4, up: ADD_EXERCISE_SESSION_FIELDS_SQL },
]

// NOTA: a lista original tem 9 nomes, não 8 — mantidos todos para não perder
// nenhum horário de refeição do plano.
export const MEAL_SLOTS_SEED = [
  { name: 'Café da manhã', order_index: 1 },
  { name: 'Lanche manhã', order_index: 2 },
  { name: 'Almoço', order_index: 3 },
  { name: 'Sobremesa', order_index: 4 },
  { name: 'Lanche tarde', order_index: 5 },
  { name: 'Pré-treino', order_index: 6 },
  { name: 'Pós-treino', order_index: 7 },
  { name: 'Jantar', order_index: 8 },
  { name: 'Ceia', order_index: 9 },
]

export async function runMigrations(db: SQLiteDBConnection): Promise<void> {
  const { values } = await db.query('PRAGMA user_version;')
  const currentVersion = (values?.[0]?.user_version as number | undefined) ?? 0

  const pending = migrations.filter((migration) => migration.version > currentVersion)

  for (const migration of pending) {
    await db.execute(migration.up)
    await db.execute(`PRAGMA user_version = ${migration.version};`)
  }
}

export async function seedMealSlots(db: SQLiteDBConnection): Promise<void> {
  const { values } = await db.query('SELECT COUNT(*) as count FROM meal_slots;')
  const count = (values?.[0]?.count as number | undefined) ?? 0

  if (count > 0) return

  for (const slot of MEAL_SLOTS_SEED) {
    await db.run('INSERT INTO meal_slots (name, order_index) VALUES (?, ?);', [
      slot.name,
      slot.order_index,
    ])
  }
}
