import { assign, setup } from 'xstate'
import { TableDefinition, LoadedTableEntry } from '../lib/types'
import { loadTableIntoDuckDb, pruneTableVersions } from '../actors/dbCatalog'
import { AsyncDuckDB } from '@duckdb/duckdb-wasm'

export interface Context {
  tableDefinitions: TableDefinition[]
  loadedVersions: Array<LoadedTableEntry>
  subscriptions: Record<string, Set<(tableInstanceName: string, tableVersionId: number) => void>>
  nextTableId: number
  duckDbHandle: AsyncDuckDB | null
  error?: string
}

type ExternalEvents =
  // these events are used to reset the catalog
  | { type: 'CATALOG.RESET' }
  | { type: 'CATALOG.CONFIGURE'; tableDefinitions: TableDefinition[] }
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
  | { type: 'CATALOG.LIST_DEFINITIONS'; callback: (config: TableDefinition[]) => void }

  // these events are used to subscribe to table changes
  | {
      type: 'CATALOG.SUBSCRIBE'
      tableSpecName: string
      callback: (tableInstanceName: string, tableVersionId: number) => void
    }
  | {
      type: 'CATALOG.UNSUBSCRIBE'
      tableSpecName: string
      callback: (tableInstanceName: string, tableVersionId: number) => void
    }
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
    tableDefinitions: [],
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
              tableDefinitions: ({ event }: any) => event.tableDefinitions,
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

        'CATALOG.LIST_DEFINITIONS': {
          actions: ({ context, event }) => {
            event.callback(context.tableDefinitions)
          },
        },

        'CATALOG.SUBSCRIBE': {
          actions: assign(({ context, event }) => {
            const subs = context.subscriptions[event.tableSpecName] ?? new Set()
            subs.add(event.callback)
            return {
              subscriptions: { ...context.subscriptions, [event.tableSpecName]: subs },
            }
          }),
        },

        'CATALOG.UNSUBSCRIBE': {
          actions: assign(({ context, event }) => {
            const subs = context.subscriptions[event.tableSpecName]
            if (subs) {
              subs.delete(event.callback)
              if (subs.size === 0) {
                const newSubscriptions = { ...context.subscriptions }
                delete newSubscriptions[event.tableSpecName]
                return { subscriptions: newSubscriptions }
              }
            }
            return context
          }),
        },

        'CATALOG.FORCE_NOTIFY': {
          actions: ({ context, event }) => {
            const subs = context.subscriptions[event.tableSpecName]
            if (subs) {
              // Find the most recent version of this table
              const latestTable = context.loadedVersions
                .filter(entry => entry.tableSpecName === event.tableSpecName)
                .sort((a, b) => b.tableVersionId - a.tableVersionId)[0]

              if (latestTable) {
                subs.forEach(callback => callback(latestTable.tableInstanceName, latestTable.tableVersionId))
              }
            }
          },
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
            tableDefinitions: context.tableDefinitions,
            duckDbHandle: context.duckDbHandle,
          }
        },
        onDone: {
          target: 'pruning_versions',
          actions: assign(({ event, context }) => {
            const newLoadedVersions = [event.output as LoadedTableEntry, ...context.loadedVersions]

            // Notify subscribers about the new table
            const newTable = event.output as LoadedTableEntry
            const subs = context.subscriptions[newTable.tableSpecName]
            if (subs) {
              subs.forEach(callback => callback(newTable.tableInstanceName, newTable.tableVersionId))
            }

            return {
              nextTableId: context.nextTableId + 1,
              loadedVersions: newLoadedVersions,
            }
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            nextTableId: ({ context }: any) => context.nextTableId + 1,
            error: ({ event }: any) => event.error.message,
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
            tableDefinitions: context.tableDefinitions,
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
