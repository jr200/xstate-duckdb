import { assign, setup } from 'xstate'
import { AsyncDuckDB, DuckDBConfig } from '@duckdb/duckdb-wasm'
import { TableDefinition } from '../actions/types'

interface Context {
  db: AsyncDuckDB | null
  config: DuckDBConfig | null
  tables: Record<string, TableDefinition>
  subscriptions: Record<string, Set<() => void>>
  loadedVersions: Record<string, number[]>
}

type Events =
  | { type: 'CONFIGURE'; config: DuckDBConfig; tables: TableDefinition[] }
  | { type: 'LOAD_TABLE'; table: TableDefinition; base64ipc: string }
  | { type: 'DELETE_TABLE'; tableName: string }
  | { type: 'QUERY'; sql: string; callback: (rows: any[]) => void }
  | { type: 'SUBSCRIBE'; tableName: string; callback: () => void }
  | { type: 'UNSUBSCRIBE'; tableName: string; callback: () => void }
  | { type: 'RECONNECT' }
  | { type: 'CLOSE' }

export const duckdbMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
}).createMachine({
  context: {
    db: null,
    config: null,
    tables: {},
    subscriptions: {},
    loadedVersions: {},
  },

  id: 'duckdb',
  initial: 'idle',

  states: {
    idle: {
      on: {
        CONFIGURE: {
          target: 'initializing',
          actions: assign({
            config: ({ event }) => event.config,
            tables: ({ event }) => Object.fromEntries(event.tables.map(t => [t.name, t])),
          }),
        },
      },
    },

    initializing: {},

    ready: {
      initial: 'connected',

      states: {
        connected: {
          on: {
            LOAD_TABLE: {},

            DELETE_TABLE: {},

            QUERY: {},

            SUBSCRIBE: {},

            UNSUBSCRIBE: {},

            RECONNECT: {},
            CLOSE: {},
          },
        },

        reconnecting: {},
      },
    },

    error: {},

    closed: {
      type: 'final',
    },
  },
})
