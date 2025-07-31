import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { fromPromise } from 'xstate'
import { JSONObject } from '../lib/types'
import { arrowToJSON } from 'duckdb-wasm-kit'
import { Table } from 'apache-arrow'

export interface QueryDbParams {
  description: string
  sql: string
  type: 'arrow' | 'json'
  callback?: (result: any) => void
}

export const queryDuckDbActor = fromPromise(async ({ input }: { input: QueryDbParams & { connection: AsyncDuckDBConnection | Promise<AsyncDuckDBConnection> } }) => {
  console.log('queryDuckDbActor input', input)
  return queryDuckDb({ ...input })
})

export async function queryDuckDb(input: QueryDbParams & { connection: AsyncDuckDBConnection | Promise<AsyncDuckDBConnection> }): Promise<any> {
  if (input.connection instanceof Promise) {
    input.connection = await input.connection
  }

  console.log('queryDuckDb input', input)
  let result: any = null
  if (input.type === 'arrow') {
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
