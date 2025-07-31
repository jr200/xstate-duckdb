import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { DUCKDB_TABLE, TableDefinition } from './types'
import { queryDuckDbInternal } from '../actors/dbQuery'
import { deleteTableStatement, tableExists, tryRollback } from './helperQueries'

// Separate function to register new dataset WITHOUT cleaning up old ones
export async function registerDatasetOnly(
  tbl: TableDefinition,
  connection: AsyncDuckDBConnection
): Promise<{ id: number | null; tableName: string | null; oldTableIds: number[] }> {
  try {
    const tableIdsToPrune = await findVersionsToPrune(tbl, connection)

    const registerStatement = `
      BEGIN TRANSACTION;
  
      CREATE SEQUENCE IF NOT EXISTS seq_catalog_id START 1;
  
      CREATE TABLE IF NOT EXISTS ${DUCKDB_TABLE.catalog.name} (
        id INTEGER DEFAULT nextval('seq_catalog_id'),
        table_type VARCHAR(64) NOT NULL,
        loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, table_type)
      );
  
      ${
        tbl.config.hasVersions
          ? `INSERT INTO ${DUCKDB_TABLE.catalog.name} (table_type) VALUES ('${tbl.name}') RETURNING *;`
          : `
          -- For non-versioned tables, delete existing entries first
          DELETE FROM ${DUCKDB_TABLE.catalog.name} WHERE table_type = '${tbl.name}';
          INSERT INTO ${DUCKDB_TABLE.catalog.name} (id, table_type) VALUES (0, '${tbl.name}') RETURNING *;
        `
      }
  
      COMMIT;
      `

    const response = await queryDuckDbInternal({
      description: 'register-dataset-only',
      sql: registerStatement,
      resultType: 'json',
      connection: connection,
    })
    const { id } = response?.at(0) ?? { id: undefined }
    const numericId = id !== undefined ? (id as unknown as number) : null
    const tableName = makeTableName(tbl, numericId ?? undefined)

    return { id: numericId, tableName, oldTableIds: tableIdsToPrune }
  } catch (error) {
    console.error('Error registering dataset.', error)
    await tryRollback(connection)
  }

  return { id: null, tableName: null, oldTableIds: [] }
}

export async function findVersionsToPrune(tbl: TableDefinition, connection: AsyncDuckDBConnection): Promise<number[]> {
  const hasCatalog = await tableExists(DUCKDB_TABLE.catalog.name, connection)
  if (!hasCatalog) {
    return []
  }

  const sqlText = `
      SELECT id
      FROM (
          SELECT id, ROW_NUMBER() 
          OVER (PARTITION BY table_type ORDER BY id DESC) AS rn
          FROM ${DUCKDB_TABLE.catalog.name}
          WHERE table_type = '${tbl.name}'
      ) sub
      WHERE rn >= ${tbl.config.maxVersions};
    `

  const toDelete = await queryDuckDbInternal({
    description: 'find-versions-to-prune',
    sql: sqlText,
    resultType: 'json',
    connection: connection,
  })
  return toDelete.map(({ id }: { id: number }) => id)
}

export function makeTableName(tbl: TableDefinition, id?: number): string {
  if (tbl.config.hasVersions && id) {
    return `${tbl.name}_${id}`
  }
  return tbl.name
}

// Separate function to cleanup old tables
export async function cleanupOldTables(
  tbl: TableDefinition,
  oldTableIds: number[],
  connection: AsyncDuckDBConnection
): Promise<void> {
  try {
    if (oldTableIds.length === 0) {
      console.debug(`No old tables to cleanup for ${tbl.name}`)
      return
    }

    console.log(`🧹 Cleaning up ${oldTableIds.length} old tables for ${tbl.name}:`, oldTableIds)

    let cleanupStatement = 'BEGIN TRANSACTION;\n'

    if (tbl.config.hasVersions) {
      cleanupStatement += oldTableIds.map(id => deleteTableStatement(tbl, id)).join('\n')
    } else {
      cleanupStatement += deleteTableStatement(tbl)
    }

    cleanupStatement += 'COMMIT;'

    await queryDuckDbInternal({
      description: 'cleanup-old-tables',
      sql: cleanupStatement,
      resultType: 'json',
      connection: connection,
    })
    console.log(`✅ Cleaned up old tables for ${tbl.name}`)
  } catch (error) {
    console.error(`Error cleaning up old tables for ${tbl.name}:`, error)
    await tryRollback(connection)
  }
}
