import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, type AnyActorLogic } from 'xstate'
import { setup, assign, sendTo, spawnChild } from 'xstate'

// We test the root machine by creating a version with mocked actors
// to avoid needing real DuckDB WASM infrastructure.

function createMockMachine() {
  return setup({
    types: {
      context: {} as {
        duckDbHandle: any
        duckDbVersion: string | null
        dbInitParams: any
        dbLogLevel: any
        transactionConnection: any
      },
      events: {} as any,
    },
    actors: {
      initDuckDb: fromPromise(async () => ({
        db: { connect: vi.fn().mockResolvedValue({ query: vi.fn() }), terminate: vi.fn() },
        version: 'v0.10.0',
      })),
      closeDuckDb: fromPromise(async () => ({ db: null })),
      queryDuckDb: fromPromise(async () => [{ result: 1 }]),
      beginTransaction: fromPromise(async () => ({
        query: vi.fn().mockResolvedValue(undefined),
      })),
      commitTransaction: fromPromise(async () => {}),
      rollbackTransaction: fromPromise(async () => {}),
      dbCatalog: fromPromise(async () => {}) as unknown as AnyActorLogic,
    },
  }).createMachine({
    context: {
      duckDbHandle: null,
      duckDbVersion: null,
      dbInitParams: null,
      dbLogLevel: null,
      transactionConnection: null,
    },
    id: 'duckdb',
    initial: 'idle',
    states: {
      idle: {
        on: {
          CONFIGURE: {
            target: 'configured',
            actions: assign({
              dbInitParams: ({ event }: any) => event.config.dbInitParams,
              dbLogLevel: ({ event }: any) => event.config.dbLogLevel,
            }),
          },
        },
      },
      configured: {
        on: {
          CONNECT: { target: 'initializing' },
          RESET: {
            actions: assign({
              duckDbHandle: null,
              duckDbVersion: null,
              dbInitParams: null,
              transactionConnection: null,
            }),
            target: 'idle',
          },
        },
      },
      initializing: {
        entry: assign({ duckDbHandle: null }),
        invoke: {
          src: 'initDuckDb',
          input: ({ context, event }: any) => ({
            dbInitParams: context.dbInitParams,
            dbLogLevel: context.dbLogLevel ?? 2,
            dbProgressHandler: event.dbProgressHandler,
            statusHandler: event.statusHandler,
          }),
          onDone: {
            target: 'connected',
            actions: assign(({ event }: any) => ({
              duckDbHandle: event.output.db,
              duckDbVersion: event.output.version,
            })),
          },
        },
      },
      connected: {
        on: {
          'QUERY.EXECUTE': {
            actions: spawnChild('queryDuckDb', {
              input: ({ event, context }: any) => ({
                ...event.queryParams,
                connection: context.duckDbHandle?.connect(),
              }),
            }),
          },
          DISCONNECT: { target: 'disconnected' },
          'TRANSACTION.BEGIN': { target: 'transaction.begin' },
        },
      },
      transaction: {
        initial: 'begin',
        states: {
          begin: {
            invoke: {
              src: 'beginTransaction',
              input: ({ context }: any) => context.duckDbHandle,
              onDone: {
                target: 'within_transaction',
                actions: assign({
                  transactionConnection: ({ event }: any) => event.output,
                }),
              },
            },
          },
          within_transaction: {
            on: {
              'TRANSACTION.EXECUTE': { target: 'execute' },
              'TRANSACTION.COMMIT': { target: 'commit' },
              'TRANSACTION.ROLLBACK': { target: 'rollback' },
            },
          },
          execute: {
            invoke: {
              src: 'queryDuckDb',
              input: ({ event, context }: any) => ({
                ...event.queryParams,
                connection: context.transactionConnection,
              }),
              onDone: 'within_transaction',
              onError: 'error',
            },
          },
          commit: {
            invoke: {
              src: 'commitTransaction',
              input: ({ context }: any) => context.transactionConnection,
              onDone: 'end',
              onError: 'error',
            },
          },
          rollback: {
            invoke: {
              src: 'rollbackTransaction',
              input: ({ context }: any) => context.transactionConnection,
              onDone: 'end',
              onError: 'error',
            },
          },
          end: {
            type: 'final' as const,
            entry: assign({ transactionConnection: null }),
          },
          error: {},
        },
        onDone: { target: 'connected' },
      },
      disconnected: {
        invoke: {
          src: 'closeDuckDb',
          input: ({ context }: any) => ({ db: context.duckDbHandle }),
          onDone: {
            actions: assign({ duckDbHandle: null, duckDbVersion: null }),
            target: 'configured',
          },
        },
      },
      error: {
        on: { RESET: { target: 'configured' } },
      },
    },
  })
}

function waitForState(actor: any, targetState: string, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for state: ${targetState}`)), timeout)
    const check = () => {
      const snap = actor.getSnapshot()
      const stateValue = typeof snap.value === 'string' ? snap.value : JSON.stringify(snap.value)
      if (stateValue.includes(targetState)) {
        clearTimeout(timer)
        resolve()
      }
    }
    check()
    actor.subscribe(() => check())
  })
}

describe('duckdbMachine (root)', () => {
  it('starts in idle state', () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  it('transitions idle -> configured on CONFIGURE', () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: { path: ':memory:' }, dbLogLevel: 2, tableDefinitions: [] },
    })

    expect(actor.getSnapshot().value).toBe('configured')
    expect(actor.getSnapshot().context.dbInitParams).toEqual({ path: ':memory:' })
    actor.stop()
  })

  it('transitions configured -> idle on RESET', () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CONFIGURE', config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] } })
    actor.send({ type: 'RESET' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.dbInitParams).toBeNull()
    actor.stop()
  })

  it('transitions configured -> initializing -> connected on CONNECT', async () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CONFIGURE', config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] } })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })

    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().value).toBe('connected')
    expect(actor.getSnapshot().context.duckDbVersion).toBe('v0.10.0')
    expect(actor.getSnapshot().context.duckDbHandle).not.toBeNull()
    actor.stop()
  })

  it('transitions connected -> disconnected -> configured on DISCONNECT', async () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CONFIGURE', config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] } })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({ type: 'DISCONNECT' })
    await waitForState(actor, 'configured')

    expect(actor.getSnapshot().value).toBe('configured')
    expect(actor.getSnapshot().context.duckDbHandle).toBeNull()
    actor.stop()
  })

  it('handles QUERY.EXECUTE in connected state', async () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CONFIGURE', config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] } })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    // Should not throw, stays connected
    actor.send({
      type: 'QUERY.EXECUTE',
      queryParams: { description: 'test', sql: 'SELECT 1', resultOptions: { type: 'array' } },
    })

    expect(actor.getSnapshot().value).toBe('connected')
    actor.stop()
  })

  it('handles transaction lifecycle: begin -> execute -> commit', async () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CONFIGURE', config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] } })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({ type: 'TRANSACTION.BEGIN' })
    await waitForState(actor, 'within_transaction')

    expect(actor.getSnapshot().context.transactionConnection).not.toBeNull()

    actor.send({
      type: 'TRANSACTION.EXECUTE',
      queryParams: { description: 'txn-q', sql: 'INSERT INTO t VALUES(1)', resultOptions: { type: 'array' } },
    })
    await waitForState(actor, 'within_transaction')

    actor.send({ type: 'TRANSACTION.COMMIT' })
    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().value).toBe('connected')
    expect(actor.getSnapshot().context.transactionConnection).toBeNull()
    actor.stop()
  })

  it('handles transaction rollback', async () => {
    const machine = createMockMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CONFIGURE', config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] } })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({ type: 'TRANSACTION.BEGIN' })
    await waitForState(actor, 'within_transaction')

    actor.send({ type: 'TRANSACTION.ROLLBACK' })
    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().value).toBe('connected')
    expect(actor.getSnapshot().context.transactionConnection).toBeNull()
    actor.stop()
  })
})
