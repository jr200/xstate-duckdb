import { assign, setup } from 'xstate'
import { AsyncDuckDB } from '@duckdb/duckdb-wasm'
import { TableDefinition } from '../lib/types'
import { closeDuckDb, InitDuckDbParams, initDuckDb } from '../actors/init'

interface Context {
  duckDbHandle: AsyncDuckDB | null
  duckDbVersion: string | null
  dbInitParams: InitDuckDbParams | null
  tables: Record<string, TableDefinition>
  subscriptions: Record<string, Set<() => void>>
  loadedVersions: Record<string, number[]>
}

type Events =
  | { type: 'CONFIGURE'; dbInitParams: InitDuckDbParams; tables: TableDefinition[] }
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
    initDuckDb,
    closeDuckDb
  },
}).createMachine({
  context: {
    duckDbHandle: null,
    duckDbVersion: null,
    dbInitParams: null,
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
            dbInitParams: ({ event }) => event.dbInitParams,
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
          duckDbHandle: null,
        }),
      ],
      invoke: {
        src: 'initDuckDb',
        input: ({ context }) => ({ ...context.dbInitParams! }),
        onDone: {
          target: 'ready.connected',
          actions: assign(({ event }) => ({
            duckDbHandle: event.output.db,
            duckDbVersion: event.output.version,
          })),
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
          invoke: {
            src: 'closeDuckDb',
            input: ({ context }: { context: Context }) => ({ db: context.duckDbHandle }),
            onDone: {
              actions: assign({
                duckDbHandle: null,
                duckDbVersion: null,
              }),
            },
          },
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
