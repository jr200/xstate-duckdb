import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { DUCKDB_TABLE, TableDefinition } from './types'
import { makeTableName } from './catalog'
import { queryDuckDbInternal } from '../actors/dbQuery'

export async function tryRollback(connection: AsyncDuckDBConnection) {
  try {
    await connection.query('ROLLBACK')
  } catch (error) {
    console.debug('Failed to rollback transaction. This is expected if the transaction was not started.', error)
  }
}

export function deleteTableStatement(tbl: TableDefinition, id?: number) {
  const tableName = makeTableName(tbl, id)
  let deleteStatement = `DROP TABLE IF EXISTS ${tableName};\n`

  if (tbl.isVersioned && id) {
    deleteStatement += `
      DELETE FROM ${DUCKDB_TABLE.catalog.name} 
      WHERE table_type='${tbl.name}' AND id=${id};\n`
  } else if (!tbl.isVersioned) {
    deleteStatement += `
      DELETE FROM ${DUCKDB_TABLE.catalog.name}
      WHERE table_type='${tbl.name}';\n`
  }
  return deleteStatement
}

export async function tableExists(tableName: string, connection: AsyncDuckDBConnection): Promise<boolean> {
  const sqlText = `
      SELECT DISTINCT true FROM information_schema.columns
      WHERE table_name='${tableName}'
    `

  const response = await queryDuckDbInternal({
    description: 'table-exists',
    sql: sqlText,
    resultType: 'arrow',
    connection: connection,
  })
  return response?.numRows === 1
}
