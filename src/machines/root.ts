import { assign, setup } from 'xstate'
import { AsyncDuckDB, DuckDBConfig } from '@duckdb/duckdb-wasm'
import { TableDefinition } from '../lib/types'
import { initDuckDb } from '../actors/init'

interface Context {
  db: AsyncDuckDB | null
  config: DuckDBConfig | null
  tables: Record<string, TableDefinition>
  subscriptions: Record<string, Set<() => void>>
  loadedVersions: Record<string, number[]>
}

type Events =
  | { type: 'CONFIGURE'; config: DuckDBConfig; tables: TableDefinition[] }
  | { type: 'CONNECT' }
  | { type: 'LOAD_TABLE'; table: TableDefinition; base64ipc: string }
  | { type: 'DELETE_TABLE'; tableName: string }
  | { type: 'QUERY'; sql: string; callback: (rows: any[]) => void }
  | { type: 'SUBSCRIBE'; tableName: string; callback: () => void }
  | { type: 'UNSUBSCRIBE'; tableName: string; callback: () => void }
  | { type: 'RECONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'RESET' }
  | { type: 'CLOSE' }

export const duckdbMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    initDuckDb: initDuckDb
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
          target: 'configured',
          actions: assign({
            config: ({ event }) => event.config,
            tables: ({ event }) => Object.fromEntries(event.tables.map(t => [t.name, t])),
          }),
        },
      },
    },

    configured: {
      on: {
        CONNECT: {
          target: 'initializing',
        },
        RESET: {
          target: 'idle',
        },
      },
    },

    initializing: {
      entry: [
        assign({
          db: null,
        }),
      ],
      invoke: {
        src: 'initDuckDb',
        input: ({ context }) => ({ config: context.config }),
        onDone: {
          target: 'ready.connected',
          actions: assign(({ event }) => event.output ),
        },
      },
    },

    ready: {
      initial: 'connected',

      states: {
        connected: {
          on: {
            LOAD_TABLE: {
              target: 'connected',
            },

            DELETE_TABLE: {
              target: 'connected',
            },

            QUERY: {
              target: 'connected',
            },

            SUBSCRIBE: {
              target: 'connected',
            },

            UNSUBSCRIBE: {
              target: 'connected',
            },

            DISCONNECT: {
              target: 'notReady',
            },

            CLOSE: {
              target: 'notReady',
            },
          },
        },

        notReady: {
          type: 'final',
        },
      },
      onDone: {
        target: 'configured',
      },
    },

    error: {
    },

    closed: {
      type: 'final',
    },
  },
})
