import { getDbConnection } from './connection'
import { migrations } from './migrations'

let ready = null

async function runMigrations(db) {
  const { values } = await db.query('PRAGMA user_version;')
  const currentVersion = values?.[0]?.user_version ?? 0

  const pending = migrations.filter((migration) => migration.version > currentVersion)

  for (const migration of pending) {
    await db.execute(migration.up)
    await db.execute(`PRAGMA user_version = ${migration.version};`)
  }
}

export async function initDatabase() {
  if (!ready) {
    ready = (async () => {
      const db = await getDbConnection()
      await runMigrations(db)
      return db
    })()
  }

  return ready
}

export async function getDb() {
  return initDatabase()
}
