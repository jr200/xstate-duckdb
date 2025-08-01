import { assign, setup } from 'xstate'
import { TableDefinition } from '../lib/types'

export interface LoadedTableEntry {
  id: number
  tableName: string
  loadedEpoch: number
}

export interface Context {
  config: TableDefinition[]
  loadedVersions: Array<LoadedTableEntry>
  subscriptions: Record<string, Set<() => void>>
}

type ExternalEvents =
  // these events are used to reset the catalog
  | { type: 'CATALOG.RESET' }
  | { type: 'CATALOG.CONFIGURE'; config: Record<string, TableDefinition> }
  | { type: 'CATALOG.CONNECT' }
  | { type: 'CATALOG.DISCONNECT' }

  // these events are used to load data and delete tables
  | { type: 'CATALOG.LIST_TABLES', callback: (tables: LoadedTableEntry[]) => void }
  | { type: 'CATALOG.LOAD_TABLE_FROM_DATA'; table: TableDefinition; payload: any }
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
}).createMachine({
  initial: 'idle',

  context: {
    config: [],
    loadedVersions: [],
    subscriptions: {},
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
          })),
        },
        'CATALOG.CONNECT': {
          target: 'connected',
        },
      }
    },
    connected: {
      on: {
        'CATALOG.DISCONNECT': {
          target: 'configured',
        },
        'CATALOG.LIST_TABLES': {
          actions: (({ context, event }) => {
            event.callback(context.loadedVersions)
          }),
        },
        'CATALOG.LOAD_TABLE_FROM_DATA': {
          //   actors: {
          //     loadTable: fromPromise(async ({ context, event }) => {
          //     const { tableName, payload } = event
          //     const def = context.config[tableName]
          //     if (!def) throw new Error(`Unknown table: ${tableName}`)
          //     // load the data using the user-provided loader
          //     const table = await def.loader(payload)
          //     const connection = await table.db.connect()
          //     const { tableName: fullName, oldTableIds } = await registerDatasetOnly(def, connection)
          //     if (!fullName) throw new Error('Failed to register dataset')
          //     await table.insertInto(fullName)
          //     if (oldTableIds.length > 0) {
          //       queueMicrotask(async () => {
          //         const cleanupConn = await table.db.connect()
          //         await cleanupOldTables(def, oldTableIds, cleanupConn)
          //       })
          //     }
          //     const id = parseInt(fullName.split('_').at(-1) ?? '0')
          //     const updated = [id, ...(context.loadedVersions[tableName] ?? [])].slice(0, def.config.maxVersions)
          //     context.loadedVersions[tableName] = updated
          //     context.subscriptions[tableName]?.forEach(cb => cb())
          //   }),
          // }
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
          actions: (({ context, event }) => {
            event.callback(context.config)
          }),
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
  },
})
