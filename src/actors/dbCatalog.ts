import { fromPromise } from 'xstate/actors'
import { JSONObject, TableDefinition, LoadedTableEntry } from '../lib/types'
import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import pako from 'pako'

export interface LoadTableInput {
  nextTableId: number
  payloadType: 'json' | 'b64ipc'
  payloadCompression: 'none' | 'zlib'
  tableDefinitions: TableDefinition[]
  callback: (tableInstanceName: string, error?: string) => void
}

export const loadTableIntoDuckDb = fromPromise(async ({ input }: any) => {
  try {
    const { nextTableId, payloadType, tableDefinitions, payloadCompression } = input
    const tableDefinition = findTableDefinition(input.tableName, tableDefinitions)
    if (!tableDefinition) {
      input.callback?.({ error: `Table definition for table ${input.tableName} not found` })
      return
    }

    const tableNameInstance = makeTableNameInstance(tableDefinition, nextTableId)
    const catalogEntry: LoadedTableEntry = {
      tableVersionId: nextTableId,
      tableSpecName: tableDefinition.name,
      tableInstanceName: tableNameInstance,
      loadedEpoch: Date.now(),
    }
    let result: any

    const dbConnection = await input.duckDbHandle.connect()
    if (payloadType === 'json') {
      result = await loadTableFromJson(
        tableDefinition.schema,
        tableNameInstance,
        input.tablePayload,
        dbConnection,
        payloadCompression
      )
    } else if (payloadType === 'b64ipc') {
      result = await loadTableFromB64ipc(
        tableDefinition.schema,
        tableNameInstance,
        input.tablePayload,
        dbConnection,
        payloadCompression
      )
    } else {
      result = { error: `Unknown payload type: ${payloadType}` }
    }

    input.callback?.(tableNameInstance, result.error)
    return catalogEntry
  } catch (error: any) {
    console.error('Error loading table into DuckDB', error)
    input.callback?.({ error: error.message })
    return { error: error.message }
  }
})

function findTableDefinition(tableName: string, definitions: TableDefinition[]) {
  return definitions.find(def => def.name === tableName)
}

function makeTableNameInstance(definition: TableDefinition, nextTableId: number): string {
  if (definition.isVersioned && nextTableId) {
    return `${definition.name}_${nextTableId}`
  }
  return definition.name
}
async function loadTableFromJson(
  tableSchema: string,
  tableName: string,
  jsonPayload: JSONObject,
  dbConnection: AsyncDuckDBConnection,
  compression: 'none' | 'zlib'
): Promise<any> {
  console.log('loadTableFromJson', tableName, jsonPayload)
  return { tableSchema, tableName, dbConnection, compression, jsonPayload }
}

async function loadTableFromB64ipc(
  tableSchema: string,
  tableName: string,
  base64ipc: string,
  connection: AsyncDuckDBConnection,
  compression: 'none' | 'zlib'
): Promise<any> {
  const msgSizeMb = base64ipc.length / 1024 / 1024

  const binaryString = window.atob(base64ipc)
  const byteArray = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i)
  }

  // Decompress with pako if zlib compression is enabled
  const finalByteArray = compression === 'zlib' ? pako.inflate(byteArray) : byteArray

  try {
    await connection.insertArrowFromIPCStream(finalByteArray, {
      name: tableName,
      schema: tableSchema,
      create: true,
    })
  } catch (error: any) {
    console.error('Error loading table from b64ipc', error)
    return { error: error }
  }
  console.log(`DuckDB loaded ${tableSchema}.${tableName}: size=${msgSizeMb.toFixed(3)}mb`)

  return { tableName, connection, compression, base64ipc }
}

export const pruneTableVersions = fromPromise(async ({ input }: any) => {
  const currentLoadedVersions: LoadedTableEntry[] = input.currentLoadedVersions
  const definitions: TableDefinition[] = input.tableDefinitions
  const dbConnection = await input.duckDbHandle.connect()
  await dbConnection.query(`BEGIN TRANSACTION;`)

  try {
    let prunedLoadedVersions: LoadedTableEntry[] = []
    for (const definition of definitions) {
      const { maxVersions, isVersioned, name } = definition
      const loadedTables = currentLoadedVersions
        .filter(loadedTbl => loadedTbl.tableSpecName === name)
        .sort((a, b) => b.tableVersionId - a.tableVersionId)

      if (!isVersioned) {
        prunedLoadedVersions = [...prunedLoadedVersions, ...loadedTables]
      } else {
        const versionsToKeep = loadedTables.slice(0, maxVersions)
        const tableInstancesToPrune = loadedTables.slice(maxVersions).map(tbl => tbl.tableInstanceName)
        await dropTables(tableInstancesToPrune, dbConnection)
        prunedLoadedVersions = [...prunedLoadedVersions, ...versionsToKeep]
      }
    }

    await dbConnection.query(`COMMIT;`)

    return { loadedVersions: prunedLoadedVersions }
  } catch (error: any) {
    console.error('Error pruning table versions', error)
    await dbConnection.query(`ROLLBACK;`)
    return { error: error.message }
  }
})

export const dropTables = async (tableInstances: string[], connection: AsyncDuckDBConnection) => {
  for (const tableInstance of tableInstances) {
    await connection.query(`DROP TABLE IF EXISTS ${tableInstance};`)
  }
}
