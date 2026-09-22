import { getDb } from '@/services/database'

export function useDatabase() {
  async function query(statement, values = []) {
    const db = await getDb()
    const result = await db.query(statement, values)
    return result.values ?? []
  }

  async function execute(statement, values = []) {
    const db = await getDb()
    return db.run(statement, values)
  }

  return { query, execute }
}
