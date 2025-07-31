type JSONPrimitive = string | number | boolean | null

type JSONValue =
  | JSONPrimitive
  | readonly JSONValue[]
  | {
      [key: string]: JSONValue
    }

export type JSONObject = Record<string, JSONValue>

export interface TableConfig {
  hasVersions: boolean
  maxVersions: number
}

export interface TableDefinition {
  name: string
  config: TableConfig
}

export const DUCKDB_TABLE: Record<string, TableDefinition> = {
  catalog: {
    name: 'catalog',
    config: {
      hasVersions: false,
      maxVersions: 1,
    },
  },
}
