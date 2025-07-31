import { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { fromPromise } from 'xstate'
import { JSONObject } from '../lib/types'
import { arrowToJSON } from 'duckdb-wasm-kit'
import { Table } from 'apache-arrow'

export interface QueryDbParams {
  description: string
  sql: string
  resultType: 'arrow' | 'json'
  callback?: (result: any) => void
}

export const queryDuckDb = fromPromise(
  async ({
    input,
  }: {
    input: QueryDbParams & { connection: Promise<AsyncDuckDBConnection> | AsyncDuckDBConnection }
  }) => {
    return queryDuckDbInternal({
      ...input,
      connection: input.connection instanceof Promise ? await input.connection : input.connection,
    })
  }
)

export async function queryDuckDbInternal(input: QueryDbParams & { connection: AsyncDuckDBConnection }): Promise<any> {
  let result: any = null
  if (input.resultType === 'arrow') {
    result = await duckDbExecuteToArrow(input.description, input.sql, input.connection)
  } else {
    result = await duckDbExecuteToJson(input.description, input.sql, input.connection)
  }

  if (input.callback) {
    input.callback(result)
  } else {
    return result
  }
}

async function duckDbExecuteToArrow(
  description: string,
  sqlText: string,
  connection: AsyncDuckDBConnection,
  debug: boolean = false
): Promise<Table<any> | undefined> {
  if (!connection) return undefined

  try {
    if (debug) {
      //   console.log(`[${nowUtc().toString()}] -- query[${description}]: ${sqlText}`)
    }

    const result = await connection.query(sqlText)
    return result as unknown as Table<any>
  } catch (error) {
    console.error(`duckDbError[${description}]`, error)
    return undefined
  }
}

export async function duckDbExecuteToJson(
  description: string,
  sqlText: string,
  connection: AsyncDuckDBConnection
): Promise<Record<string, JSONObject>[]> {
  const response = await duckDbExecuteToArrow(description, sqlText, connection)
  if (!response) {
    return []
  }
  const jsonResponse = arrowToJSON(response)
  return jsonResponse
}

export const beginTransaction = fromPromise(
  async ({ input }: { input: AsyncDuckDB }): Promise<AsyncDuckDBConnection> => {
    const connection = await input.connect()
    await connection.query('BEGIN TRANSACTION;')
    return connection
  }
)

export const commitTransaction = fromPromise(async ({ input }: { input: AsyncDuckDBConnection }): Promise<void> => {
  await input.query('COMMIT;')
})

export const rollbackTransaction = fromPromise(async ({ input }: { input: AsyncDuckDBConnection }): Promise<void> => {
  await input.query('ROLLBACK;')
})
