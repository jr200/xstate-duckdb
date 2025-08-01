import { assign, setup } from 'xstate'
import { TableDefinition } from '../lib/types'
import { loadTableIntoDuckDb } from '../actors/dbCatalog'

export interface LoadedTableEntry {
  id: number
  tableName: string
  loadedEpoch: number
}

export interface Context {
  config: TableDefinition[]
  loadedVersions: Array<LoadedTableEntry>
  subscriptions: Record<string, Set<() => void>>
  nextTableId: number
}

type ExternalEvents =
  // these events are used to reset the catalog
  | { type: 'CATALOG.RESET' }
  | { type: 'CATALOG.CONFIGURE'; config: Record<string, TableDefinition> }
  | { type: 'CATALOG.CONNECT' }
  | { type: 'CATALOG.DISCONNECT' }

  // these events are used to load data and delete tables
  | { type: 'CATALOG.LIST_TABLES'; callback: (tables: LoadedTableEntry[]) => void }
  | { type: 'CATALOG.LOAD_TABLE'; tableName: string; tablePayload: any; payloadType: 'json' | 'b64ipc', callback?: (tableName: string, tableVersion: number, error?: string) => void }
  | { type: 'CATALOG.DROP_TABLE'; tableName: string }
  | { type: 'CATALOG.GET_CONFIGURATION'; callback: (config: TableDefinition[]) => void }

  // these events are used to subscribe to table changes
  | { type: 'CATALOG.SUBSCRIBE'; tableName: string; callback: () => void }
  | { type: 'CATALOG.UNSUBSCRIBE'; tableName: string; callback: () => void }
  | { type: 'CATALOG.FORCE_NOTIFY'; tableName: string }

export type Events = ExternalEvents

export const dbCatalogLogic = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    loadTableIntoDuckDb: loadTableIntoDuckDb,
  },
}).createMachine({
  initial: 'idle',

  context: {
    config: [],
    loadedVersions: [],
    subscriptions: {},
    nextTableId: 1,
  },

  states: {
    idle: {
      on: {
        'CATALOG.CONFIGURE': {
          target: 'configured',
          actions: [
            assign({
              config: ({ event }: any) => event.catalogConfig,
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
            event.callback(context.config)
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
        input: ({ event, context }: any) => { return { ...event, nextTableId: context.nextTableId } },
        onDone: {
          target: 'connected',
          actions: assign({
            nextTableId: ({ context }: any) => context.nextTableId + 1,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            nextTableId: ({ context }: any) => context.nextTableId + 1,
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
