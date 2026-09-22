import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

export const DB_NAME = 'nutriroutine'

const sqliteConnection = new SQLiteConnection(CapacitorSQLite)

let dbInstance = null
let webStoreInitialized = false

async function ensureWebStore() {
  if (Capacitor.getPlatform() !== 'web' || webStoreInitialized) return

  const jeepSqliteEl = document.createElement('jeep-sqlite')
  document.body.appendChild(jeepSqliteEl)
  await customElements.whenDefined('jeep-sqlite')
  await sqliteConnection.initWebStore()

  webStoreInitialized = true
}

export async function getDbConnection() {
  if (dbInstance) return dbInstance

  await ensureWebStore()

  const isConsistent = (await sqliteConnection.checkConnectionsConsistency()).result
  const isConnection = (await sqliteConnection.isConnection(DB_NAME, false)).result

  if (isConsistent && isConnection) {
    dbInstance = await sqliteConnection.retrieveConnection(DB_NAME, false)
  } else {
    dbInstance = await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  }

  await dbInstance.open()

  return dbInstance
}

export async function closeDbConnection() {
  if (!dbInstance) return

  await sqliteConnection.closeConnection(DB_NAME, false)
  dbInstance = null
}
