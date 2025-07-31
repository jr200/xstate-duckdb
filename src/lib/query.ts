// import { Table as ArrowTable } from 'apache-arrow'
// import { JSONObject } from './types'

// export async function duckDbExecuteToArrow(
//   description: string,
//   sqlText: string,
//   connection: AsyncDuckDBConnection,
//   debug: boolean = false
// ): Promise<ArrowTable | undefined> {
//   if (!connection) return undefined

//   try {
//     if (debug) {
//       //   console.log(`[${nowUtc().toString()}] -- query[${description}]: ${sqlText}`)
//     }

//     const result = await connection.query(sqlText)
//     return result as unknown as ArrowTable
//   } catch (error) {
//     console.error(`duckDbError[${description}]`, error)
//     return undefined
//   }
// }

// export async function duckDbExecuteToJson(
//   description: string,
//   sqlText: string,
//   connection: AsyncDuckDBConnection
// ): Promise<Record<string, JSONObject>[]> {
//   const response = await duckDbExecuteToArrow(description, sqlText, connection)
//   const jsonResponse = arrowToJSON(response)
//   return jsonResponse
// }

/**
 * Convert an Apache Arrow table to an array of JSON row objects.
 */
// function arrowToJSON(arrow?: ArrowTable): Record<string, JSONObject>[] {
//   const rows: Record<string, JSONObject>[] = []

//   if (!arrow) {
//     return rows
//   }

//   for (let i = 0; i < arrow.numRows; i++) {
//     const row = arrow.get(i)
//     if (row) {
//       rows.push(row.toJSON())
//     }
//   }
//   return rows
// }

// export function arrayToSimpleMap(array: any[], key: string, value: string): Map<string, any> {
//   const map = new Map<string, any>()
//   array.forEach(item => {
//     map.set(item[key], item[value])
//   })
//   return map
// }

// export function arrayToObjectMap(array: any[], key: string): Map<string, any> {
//   const map = new Map<string, any>()
//   array.forEach(item => {
//     map.set(item[key], item)
//   })
//   return map
// }

// export function arrayToObjectMultiMap(array: any[], key: string): Map<string, any[]> {
//   const map = new Map<string, any[]>()
//   array.forEach(item => {
//     const keyValue = item[key]
//     if (!keyValue) {
//       throw new Error(`Key ${key} does not exist in array. Array: ${JSON.stringify(item)}`)
//     }
//     if (!map.has(keyValue)) {
//       map.set(keyValue, [])
//     }
//     map.get(keyValue)!.push(item)
//   })
//   return map
// }

// export function joinLiterals(values: string[]): string {
//   return values.map(value => `'${value}'`).join(',')
// }
