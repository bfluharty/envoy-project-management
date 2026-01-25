import db from '@adonisjs/lucid/services/db'

export async function retrieveReferences(table: string, fields?: string[]): Promise<any[]> {
  let query = db.from(table).where('is_active', true)
  if (fields && fields.length > 0) {
    query = query.select(...fields)
  } else {
    query = query.select('*')
  }
  return await query
}
