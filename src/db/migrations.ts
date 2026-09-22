import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

import { CREATE_TABLES_SQL } from './schema'

export interface Migration {
  version: number
  up: string
}

export const migrations: Migration[] = [{ version: 1, up: CREATE_TABLES_SQL }]

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
