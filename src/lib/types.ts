import { DuckDBConfig, InstantiationProgressHandler, LogLevel } from '@duckdb/duckdb-wasm'

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
  tableIsVersioned: boolean
  tableVersionId: number
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

interface CatalogMachineConfig {
  tableDefinitions: TableDefinition[]
}

interface DuckDbMachineConfig {
  dbLogLevel: LogLevel
  dbInitParams: DuckDBConfig | null
}

export type MachineConfig = DuckDbMachineConfig & CatalogMachineConfig

export type DuckDbInitialistionStatus = 'initializing' | 'ready' | 'error'

export type InitDuckDbParams = DuckDbMachineConfig & {
  dbProgressHandler?: InstantiationProgressHandler | null
  statusHandler?: (status: DuckDbInitialistionStatus) => void
}

export interface CatalogSubscription {
  tableSpecName: string
  subscriptionUid?: string
  onSubscribe: (id: string, tableSpecName: string) => void
  onChange: (tableInstanceName: string, tableVersionId: number, isVersioned: boolean) => void
}
