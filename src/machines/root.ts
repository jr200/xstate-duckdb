import { assign, sendTo, setup } from 'xstate'
import { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { TableDefinition } from '../lib/types'
import { closeDuckDb, InitDuckDbParams, initDuckDb } from '../actors/dbInit'
import { beginTransaction, commitTransaction, rollbackTransaction, QueryDbParams, queryDuckDb } from '../actors/dbQuery'
import { dbCatalogLogic, Events as DbCatalogEvents } from './dbCatalog'

interface Context {
  duckDbHandle: AsyncDuckDB | null
  duckDbVersion: string | null
  dbInitParams: InitDuckDbParams | null
  transactionConnection: AsyncDuckDBConnection | null
}

type Events =
  | { type: 'CONFIGURE'; dbInitParams: InitDuckDbParams; catalogConfig: Record<string, TableDefinition> }
  | { type: 'CONNECT' }
  | { type: 'RECONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'RESET' }
  | { type: 'CLOSE' }
  | { type: 'QUERY.EXECUTE'; queryParams: QueryDbParams }
  | { type: 'TRANSACTION.BEGIN' }
  | { type: 'TRANSACTION.EXECUTE'; queryParams: QueryDbParams }
  | { type: 'TRANSACTION.COMMIT' }
  | { type: 'TRANSACTION.ROLLBACK' }
  | DbCatalogEvents

export const duckdbMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    initDuckDb: initDuckDb,
    closeDuckDb: closeDuckDb,
    queryDuckDb: queryDuckDb,
    beginTransaction: beginTransaction,
    commitTransaction: commitTransaction,
    rollbackTransaction: rollbackTransaction,
    dbCatalog: dbCatalogLogic,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QQK4GMDWEBGA6AlhADZgDEAwgPIByAYgJIDiAqgEoCiA2gAwC6ioAA4B7WPgAu+YQDsBIAB6IAjAA5uuAEwB2AMwAWAKw6VGgJzGAbHp0AaEAE9lOpblNu3apUp0+DFgL7+dqiYOLhoMgBm+FAoAE6QFDTU7OQAKjz8SCAiYpIycooIelaa+nrcFloGpty1OgZ2jghKeqa4OuYaGtwG1iV6KoHB6Fh4EdLRsQkQpBwAyuwZfHK5ElKy2UXeLgZKfhpGdUqm1RZNiCoube7cdRYWphpVwyAhYwTS6wCGRPgAXvhpFBSBAZGBPgA3YQYCHvMJAn5-QHAhBA6Fob75aSZTKrUTrApbRCHAyuQw6DRKCxU0z7bQXBD1XAGZ4aToqSmqfSveF4BLfCD2cIyaRgNDiRIAGUoAEEACIAfTSsoAQlKuCtsmtsYVEAY7rh6Q0uaZHnoNIyVFotJpWWotBbTAYtBYDLzRmEBUKRdIxRLEvL2Bq0uxlWqNXjtQTdcTinTXFpnhZ9NwVG6LNSrc9cNVtG49m0GgEgm9PfywILhRN-ZLZgBFZjsVgATVwsuYaUoiqoAFle-RllkhDGNnrijTcCoap0lM8DVoVHo9IzdOozGajLU3U8dB7QhWq77a4l5sxVfNyKx6KrNcOcqOiaAiga9LgaQa54ZTNaTIyUzoU4lAaJg-hobT7h83rVqK4p1qQzDUGeF5Xjed74nkY5xkWLIPHoqi1IM3CqIyRi2p0Pg0hYKhuL0JYjAeuDQcecGBvQl7JKkQ4YYSmzPog1EqLmBrEZYxacoydJko8Gg0TRPjWD4kFepWPo1qxszkDKixRiOmFPgoAkqEJ1R3N46bibYDiXG6RpPDRSjEdaTx6Mph4+tIwjiKwqn2KC4K4LA4hYnC5ZMb5uCed5vm6Q++l8YZLSVG++EVNOybWKYkncBoRp1H4JhqL0xiBKWnkQHAch8jxsb8QgAC05zWQ1ZLuG17WnBobkEMQYA1VhdUWoyrTkeYqgGBNDyHMu3UTFM8SQP1BlFD4LiyXOS6nK6FjEU1zStO08njZNH4laWfKfEiAJAlAS0JS+WhWjRuB3LJVLEV4JxKN10F3eOqVTjOdLztwi7Loyy6HeYOg7eYdQ+F151hcx6kBhAf1xns6h3IuJypq6xWSZSwnrUYy5Uo6P0RVFPlVhjdXTi4GZsg83DGNwK7NbU6gGOm3imGlpzplTR5oEQoiLdG8Xjl4WjtKDVx6I63i808kndFOMPeBm+y6O6SOMcxMjyuC9OJay6is9ShGOZ0j1cwmhz5m4+hmNa3VgHEcTCHEZtFENzXGVOXQC88SsmNUs3i7Akt6bx-2Ws1PRkvJzzlG0hjfaVQA */
  context: {
    duckDbHandle: null,
    duckDbVersion: null,
    dbInitParams: null,
    transactionConnection: null,
  },
  invoke: [{ src: 'dbCatalog', id: 'dbCatalog' }],
  id: 'duckdb',
  initial: 'idle',

  states: {
    idle: {
      on: {
        CONFIGURE: {
          target: 'configured',
          actions: [
            assign({
              dbInitParams: ({ event }) => event.dbInitParams,
            }),
            sendTo('dbCatalog', ({ event }: any) => {
              return {
                catalogConfig: event.catalogConfig,
                type: 'CATALOG.CONFIGURE',
              }
            }),
          ],
        },
      },
    },

    configured: {
      on: {
        CONNECT: {
          target: 'initializing',
        },
        RESET: {
          actions: [
            sendTo('dbCatalog', {
              type: 'CATALOG.RESET',
            }),
            assign({
              duckDbHandle: null,
              duckDbVersion: null,
              dbInitParams: null,
              transactionConnection: null,
            }),
          ],
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
          target: 'connected',
          actions: [
            assign(({ event }) => ({
              duckDbHandle: event.output.db,
              duckDbVersion: event.output.version,
            })),
            sendTo('dbCatalog', {
              type: 'CATALOG.CONNECT',
            }),
          ],
        },
      },
    },

    connected: {
      on: {
        'QUERY.EXECUTE': {
          target: 'query_one_shot',
        },

        DISCONNECT: {
          actions: [
            sendTo('dbCatalog', {
              type: 'CATALOG.DISCONNECT',
            }),
          ],
          target: 'disconnected',
        },
        'CATALOG.*': {
          actions: [
            ({ event }: any) => {
              console.log('forwarding event', event)
            },
            sendTo('dbCatalog', ({ event, context }: { event: DbCatalogEvents; context: Context }) => {
              return { ...event, duckDbHandle: context.duckDbHandle }
            }),
          ],
        },

        'TRANSACTION.BEGIN': {
          target: 'transaction.begin',
        },
      },
    },

    transaction: {
      initial: 'begin',
      states: {
        begin: {
          invoke: {
            src: 'beginTransaction',
            input: ({ context }) => context.duckDbHandle!,
            onDone: {
              target: 'within_transaction',
              actions: assign({
                transactionConnection: ({ event }) => event.output,
              }),
            },
          },
        },

        within_transaction: {
          on: {
            'TRANSACTION.EXECUTE': {
              target: 'execute',
            },
            'TRANSACTION.COMMIT': {
              target: 'commit',
            },
            'TRANSACTION.ROLLBACK': {
              target: 'rollback',
            },
          },
        },

        execute: {
          invoke: {
            src: 'queryDuckDb',
            input: ({ event, context }: any) => {
              return {
                ...event.queryParams,
                connection: context.transactionConnection!,
              }
            },
            onDone: 'within_transaction',
            onError: 'error',
          },
        },

        commit: {
          invoke: {
            src: 'commitTransaction',
            input: ({ context }: any) => context.transactionConnection!,
            onDone: 'end',
            onError: 'error',
          },
        },

        rollback: {
          invoke: {
            src: 'rollbackTransaction',
            input: ({ context }: any) => context.transactionConnection!,
            onDone: 'end',
            onError: 'error',
          },
        },

        end: {
          type: 'final',
          entry: assign({
            transactionConnection: null,
          }),
        },

        error: {
          onDone: {
            target: 'end',
          },
        },
      },
      onDone: {
        target: 'connected',
      },
    },

    query_one_shot: {
      invoke: {
        src: 'queryDuckDb',
        input: ({ event, context }: any) => {
          return {
            ...event.queryParams,
            connection: context?.duckDbHandle?.connect(),
          }
        },
        onDone: 'connected',
        onError: 'error',
      },
    },

    disconnected: {
      invoke: {
        src: 'closeDuckDb',
        input: ({ context }: { context: Context }) => ({ db: context.duckDbHandle }),
        onDone: {
          actions: assign({
            duckDbHandle: null,
            duckDbVersion: null,
          }),
          target: 'configured',
        },
      },
    },

    error: {
      on: {
        RESET: {
          target: 'configured',
        },
      },
    },
  },
})
