type JSONPrimitive = string | number | boolean | null

type JSONValue =
  | JSONPrimitive
  | readonly JSONValue[]
  | {
      [key: string]: JSONValue
    }

export type JSONObject = Record<string, JSONValue>


export interface TableDefinition {
  schema: string
  name: string
  isVersioned: boolean
  maxVersions: number
  // loader: (payload: any) => Promise<Table<any>>
}



export interface LoadedTableEntry {
  id: number
  tableSpecName: string
  tableInstanceName: string
  loadedEpoch: number
}


export const DUCKDB_TABLE: Record<string, TableDefinition> = {
  catalog: {
    schema: 'main',
    name: 'catalog',
    isVersioned: false,
    maxVersions: 1,
  },
}
