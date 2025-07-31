import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import pako from 'pako'
import { TableDefinition } from './types'
import { registerDatasetOnly } from './catalog'
import { queryDuckDbInternal } from '../actors/dbQuery'

// export const loadTable = async (tbl: TableDefinition, base64ipc: string): Promise<string | null> => {
//     if (!db) {
//       console.error('Null db when loading table into DuckDB')
//       return null
//     }
//     const connection = await db.connect()
//     if (!connection) {
//       console.error('Null connection when loading table into DuckDB')
//       return null
//     }

//     // Pass db instance to loadIntoDuckDb
//     const tableName = await loadIntoDuckDb(tbl, base64ipc, connection, useZlib, db)

//     if (tableName) {
//       setCatalogUpdated(prev => prev + 1)

//       // Schedule cleanup to happen after atoms are updated
//       setTimeout(() => {
//         executePendingCleanups()
//       }, 150) // 150ms delay to ensure atoms have updated
//     }

//     return tableName
//   }

export async function loadIntoDuckDb(
  tbl: TableDefinition,
  base64ipc: string,
  connection: AsyncDuckDBConnection,
  useZlib: boolean
): Promise<string | null> {
  // Step 1: Register new table without dropping old ones
  const { tableName, oldTableIds: _oldTableIds } = await registerDatasetOnly(tbl, connection)

  if (tableName) {
    // Step 2: Load data into new table
    await loadFromArrowIpc(base64ipc, tableName, connection, useZlib)

    // Step 3: Store cleanup function for later execution with proper db reference
    // if (oldTableIds.length > 0) {
    //   const cleanupKey = `${tbl.name}-${Date.now()}`
    //   console.log(`📝 Scheduling cleanup for ${tbl.name}, will delete ${oldTableIds.length} old tables:`, oldTableIds)

    //   pendingCleanups.set(cleanupKey, async () => {
    //     try {
    //       console.log(`🧹 Executing cleanup for ${tbl.name}...`)
    //       // Create a fresh connection for cleanup
    //       const cleanupConnection = await db.connect()
    //       await cleanupOldTables(tbl, oldTableIds, cleanupConnection)
    //       pendingCleanups.delete(cleanupKey)
    //       console.log(`✅ Successfully cleaned up ${oldTableIds.length} old tables for ${tbl.name}`)
    //     } catch (error) {
    //       console.error(`❌ Error during deferred cleanup for ${tbl.name}:`, error)
    //       pendingCleanups.delete(cleanupKey)
    //     }
    //   })
    // }

    return tableName
  }

  return null
}

async function loadFromArrowIpc(
  base64ipc: string,
  tableName: string,
  connection: AsyncDuckDBConnection,
  useZlib: boolean,
  dbSchema: string = 'main'
): Promise<void> {
  if (!base64ipc || base64ipc.length == 0) {
    return
  }

  const msgSizeMb = base64ipc.length / 1024 / 1024

  const binaryString = window.atob(base64ipc)
  const byteArray = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i)
  }

  // Decompress with pako if zlib compression is enabled
  const finalByteArray = useZlib ? pako.inflate(byteArray) : byteArray

  try {
    await connection.insertArrowFromIPCStream(finalByteArray, {
      name: tableName,
      schema: dbSchema,
      create: true,
    })
  } catch (error: any) {
    // Parse error if it's a stringified JSON object in the message
    let parsedError = error

    // First try to parse the error message if it's a JSON string
    if (error?.message && typeof error.message === 'string') {
      try {
        parsedError = JSON.parse(error.message)
      } catch {
        // If parsing the message fails, check if the error itself is a string
        if (typeof error === 'string') {
          try {
            parsedError = JSON.parse(error)
          } catch {
            // If both fail, use the original error
            parsedError = error
          }
        } else {
          parsedError = error
        }
      }
    } else if (typeof error === 'string') {
      try {
        parsedError = JSON.parse(error)
      } catch {
        // If parsing fails, use the original error
        parsedError = error
      }
    }

    // If the table already exists, try to insert into existing table
    if (
      parsedError?.error_subtype === 'ENTRY_ALREADY_EXISTS' ||
      parsedError?.exception_subtype === 'ENTRY_ALREADY_EXISTS'
    ) {
      console.log(`Table ${tableName} already exists, inserting into existing table`)
      await connection.insertArrowFromIPCStream(finalByteArray, {
        name: tableName,
        schema: dbSchema,
        create: false,
      })
    } else {
      console.error('Different Error subtype loading into DuckDB', error)
      console.error('Parsed error details:', parsedError) // Add debugging info
      throw error
    }
  }
  const res = await queryDuckDbInternal({
    description: 'load-from-arrow-ipc-rowcount',
    sql: `SELECT count(*) AS rowcount FROM ${tableName}`,
    resultType: 'arrow',
    connection: connection,
  })
  const rowCount = res?.toArray()?.[0]?.rowcount
  console.log(`DuckDB loaded ${dbSchema}.${tableName}: rows=${rowCount}, size=${msgSizeMb.toFixed(3)}mb`)
}
