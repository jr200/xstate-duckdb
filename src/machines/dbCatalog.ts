import { assign, setup } from 'xstate'
import { TableDefinition, LoadedTableEntry } from '../lib/types'
import { loadTableIntoDuckDb, pruneTableVersions } from '../actors/dbCatalog'
import { AsyncDuckDB } from '@duckdb/duckdb-wasm'

export interface Context {
  definitions: TableDefinition[]
  loadedVersions: Array<LoadedTableEntry>
  subscriptions: Record<string, Set<() => void>>
  nextTableId: number
  duckDbHandle: AsyncDuckDB | null
  error?: string
}

type ExternalEvents =
  // these events are used to reset the catalog
  | { type: 'CATALOG.RESET' }
  | { type: 'CATALOG.CONFIGURE'; definitions: TableDefinition[] }
  | { type: 'CATALOG.CONNECT' }
  | { type: 'CATALOG.DISCONNECT' }

  // these events are used to load data and delete tables
  | { type: 'CATALOG.LIST_TABLES'; callback: (tables: LoadedTableEntry[]) => void }
  | {
      type: 'CATALOG.LOAD_TABLE'
      tableName: string
      tablePayload: any
      payloadType: 'json' | 'b64ipc'
      payloadCompression: 'none' | 'zlib'
      callback?: (tableInstanceName: string, error?: string) => void
    }
  | { type: 'CATALOG.DROP_TABLE'; tableName: string }
  | { type: 'CATALOG.GET_CONFIGURATION'; callback: (config: TableDefinition[]) => void }

  // these events are used to subscribe to table changes
  | { type: 'CATALOG.SUBSCRIBE'; tableSpecName: string; callback: (tableInstanceName: string) => void }
  | { type: 'CATALOG.UNSUBSCRIBE'; tableSpecName: string; callback: (tableInstanceName: string) => void }
  | { type: 'CATALOG.FORCE_NOTIFY'; tableSpecName: string }

export type Events = ExternalEvents

export const dbCatalogLogic = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    loadTableIntoDuckDb: loadTableIntoDuckDb,
    pruneTableVersions: pruneTableVersions,
  },
}).createMachine({
  initial: 'idle',

  context: {
    definitions: [],
    loadedVersions: [],
    subscriptions: {},
    nextTableId: 1,
    duckDbHandle: null,
  },

  states: {
    idle: {
      on: {
        'CATALOG.CONFIGURE': {
          target: 'configured',
          actions: [
            assign({
              definitions: ({ event }: any) => event.catalogConfig,
            }),
          ],
        },
      },
    },

    configured: {
      on: {
        'CATALOG.RESET': {
          target: 'idle',
          actions: assign(() => ({
            config: [],
            loadedVersions: [],
            subscriptions: {},
            // shoudl we reset this?? nextTableId: 1,
          })),
        },
        'CATALOG.CONNECT': {
          target: 'connected',
        },
      },
    },
    connected: {
      on: {
        'CATALOG.DISCONNECT': {
          target: 'configured',
        },
        'CATALOG.LIST_TABLES': {
          actions: ({ context, event }) => {
            event.callback(context.loadedVersions)
          },
        },
        'CATALOG.LOAD_TABLE': {
          target: 'loading_table',
          actions: assign({
            duckDbHandle: ({ event }: any) => event.duckDbHandle,
          }),
        },

        'CATALOG.DROP_TABLE': {
          //   actions: fromPromise(async ({ context, event }) => {
          //     const { tableName } = event
          //     const versions = context.loadedVersions[tableName] ?? []
          //     const def = context.config[tableName]
          //     if (!def) return
          //     const conn = await def.loader({}).then(t => t.db.connect()) // hacky but works
          //     for (const id of versions) {
          //       await conn.query(`DROP TABLE IF EXISTS ${tableName}_${id}`)
          //     }
          //     context.loadedVersions[tableName] = []
          //   }),
        },

        'CATALOG.GET_CONFIGURATION': {
          actions: ({ context, event }) => {
            event.callback(context.definitions)
          },
        },

        'CATALOG.SUBSCRIBE': {
          //   actions: assign(({ context, event }) => {
          //     const subs = context.subscriptions[event.tableName] ?? new Set()
          //     subs.add(event.callback)
          //     return {
          //       subscriptions: { ...context.subscriptions, [event.tableName]: subs },
          //     }
          //   }),
        },

        'CATALOG.UNSUBSCRIBE': {
          //   actions: assign(({ context, event }) => {
          //     const subs = context.subscriptions[event.tableName]
          //     subs?.delete(event.callback)
          //     return context
          //   }),
        },

        'CATALOG.FORCE_NOTIFY': {
          //   actions: ({ context, event }) => {
          //     context.subscriptions[event.tableName]?.forEach(cb => cb())
          //   },
        },
      },
    },
    loading_table: {
      invoke: {
        src: 'loadTableIntoDuckDb',
        input: ({ event, context }: any) => {
          return {
            ...event,
            nextTableId: context.nextTableId,
            definitions: context.definitions,
            duckDbHandle: context.duckDbHandle,
          }
        },
        onDone: {
          target: 'pruning_versions',
          actions: assign(({ event, context }) => ({
            nextTableId: context.nextTableId + 1,
            loadedVersions: [event.output as LoadedTableEntry, ...context.loadedVersions],
          })),
        },
        onError: {
          target: 'error',
          actions: assign({
            nextTableId: ({ context }: any) => context.nextTableId + 1,
          }),
        },
      },
    },
    pruning_versions: {
      invoke: {
        src: 'pruneTableVersions',
        input: ({ event, context }: any) => {
          return {
            ...event,
            currentLoadedVersions: context.loadedVersions,
            definitions: context.definitions,
            duckDbHandle: context.duckDbHandle,
          }
        },
        onDone: {
          target: 'connected',
          actions: assign(({ event }) => ({
            loadedVersions: event.output.loadedVersions,
            duckDbHandle: null,
          })),
        },
        onError: {
          target: 'error',
          actions: assign({
            nextTableId: ({ context }: any) => context.nextTableId + 1,
            duckDbHandle: null,
            error: ({ event }: any) => event,
          }),
        },
      },
    },
    error: {
      on: {
        'CATALOG.RESET': {
          target: 'idle',
        },
      },
    },
  },
})
