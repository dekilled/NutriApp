import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

import { runMigrations, seedMealSlots } from './migrations'

const DB_NAME = 'nutriroutine'

const sqliteConnection = new SQLiteConnection(CapacitorSQLite)

let db: SQLiteDBConnection | null = null
let initPromise: Promise<SQLiteDBConnection> | null = null
let webStoreInitialized = false

async function ensureWebStore(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web' || webStoreInitialized) return

  const jeepSqliteEl = document.createElement('jeep-sqlite')
  document.body.appendChild(jeepSqliteEl)
  await customElements.whenDefined('jeep-sqlite')
  await sqliteConnection.initWebStore()

  webStoreInitialized = true
}

async function openConnection(): Promise<SQLiteDBConnection> {
  await ensureWebStore()

  const isConsistent = (await sqliteConnection.checkConnectionsConsistency()).result
  const isConnection = (await sqliteConnection.isConnection(DB_NAME, false)).result

  const connection =
    isConsistent && isConnection
      ? await sqliteConnection.retrieveConnection(DB_NAME, false)
      : await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false)

  await connection.open()

  return connection
}

/**
 * Abre a conexão SQLite, roda as migrations pendentes e faz o seed dos
 * meal_slots fixos. Idempotente: chamadas subsequentes reaproveitam a
 * mesma conexão já inicializada.
 */
export async function initDatabase(): Promise<SQLiteDBConnection> {
  if (!initPromise) {
    initPromise = (async () => {
      const connection = await openConnection()
      await runMigrations(connection)
      await seedMealSlots(connection)
      db = connection
      return connection
    })()
  }

  return initPromise
}

/** Retorna a instância do DB já inicializada, para uso nos services. */
export function getDatabase(): SQLiteDBConnection {
  if (!db) {
    throw new Error('Database não inicializado. Chame initDatabase() antes de usar getDatabase().')
  }

  return db
}
