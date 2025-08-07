import { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { fromPromise } from 'xstate'
import { JSONObject } from '../lib/types'
import { arrowToJSON } from 'duckdb-wasm-kit'
import { Table } from 'apache-arrow'
import { arrayToObjectMap, arrayToObjectMultiMap, arrayToSimpleMap } from '../lib/utils'

export interface ResultOptions {
  key?: string
  value?: string
  type: 'dictionary' |'multimap' | 'singlevaluemap' | 'array' | 'arrow'
}


export interface QueryDbParams {
  description: string
  sql: string
  resultOptions: ResultOptions
  callback?: (result: any) => void
}

export const queryDuckDb = fromPromise(
  async ({
    input,
  }: {
    input: QueryDbParams & { connection: Promise<AsyncDuckDBConnection> | AsyncDuckDBConnection }
  }) => {
    return duckdbRunQuery({
      ...input,
      connection: input.connection instanceof Promise ? await input.connection : input.connection,
    })
  }
)

export async function duckdbRunQuery(input: QueryDbParams & { connection: AsyncDuckDBConnection }): Promise<any> {
  let result: any = null
  if (input.resultOptions?.type === 'arrow') {
    result = await duckDbExecuteToArrow(input.description, input.sql, input.connection)
  } else {
    result = await duckDbExecuteToJson(input.description, input.sql, input.connection)
  }

  result = formatResult(result, input.resultOptions)

  if (input.callback) {
    input.callback(result)
  } else {
    return result
  }
}

function formatResult(result: any, resultOptions?: ResultOptions) {
  if(!resultOptions) {
    return result
  }

  let transformed
  if (resultOptions.type === 'singlevaluemap') {
    transformed = arrayToSimpleMap(result, resultOptions.key!, resultOptions.value!)
  } else if (resultOptions.type === 'multimap') {
    transformed = arrayToObjectMultiMap(result, resultOptions.key!)
  } else if (resultOptions.type === 'dictionary') {
    transformed = arrayToObjectMap(result, resultOptions.key!)
  } else if (resultOptions.type === 'array') {
    transformed = result
  } else {
    throw new Error(`Unsupported result type: ${resultOptions.type}`)
  }

  return transformed
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

async function duckDbExecuteToJson(
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
