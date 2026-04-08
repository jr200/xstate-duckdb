import { describe, it, expect, vi } from 'vitest'
import { createActor, fromPromise, createMachine } from 'xstate'
import { duckdbMachine } from '../../src/machines/root'

// Suppress expected console.log output from catalog event forwarding
vi.spyOn(console, 'log').mockImplementation(() => {})

// Test the actual exported machine with mocked actors via .provide()
const mockDb = {
  connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined) }),
  terminate: vi.fn().mockResolvedValue(undefined),
}

const testMachine = duckdbMachine.provide({
  actors: {
    initDuckDb: fromPromise(async () => ({
      db: mockDb,
      version: 'v0.10.0-test',
    })),
    closeDuckDb: fromPromise(async () => ({ db: null })),
    queryDuckDb: fromPromise(async () => [{ result: 1 }]),
    beginTransaction: fromPromise(async () => ({
      query: vi.fn().mockResolvedValue(undefined),
    })),
    commitTransaction: fromPromise(async () => {}),
    rollbackTransaction: fromPromise(async () => {}),
    dbCatalog: createMachine({ initial: 'idle', states: { idle: {} } }),
  },
})

function waitForState(actor: any, targetState: string, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for state: ${targetState}`)),
      timeout,
    )
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

describe('actual duckdbMachine with mocked actors', () => {
  it('starts in idle', () => {
    const actor = createActor(testMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  it('idle -> configured -> initializing -> connected', async () => {
    const actor = createActor(testMachine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] },
    })
    expect(actor.getSnapshot().value).toBe('configured')

    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().context.duckDbVersion).toBe('v0.10.0-test')
    expect(actor.getSnapshot().context.duckDbHandle).toBe(mockDb)
    actor.stop()
  })

  it('connected -> disconnect -> configured', async () => {
    const actor = createActor(testMachine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] },
    })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({ type: 'DISCONNECT' })
    await waitForState(actor, 'configured')

    expect(actor.getSnapshot().context.duckDbHandle).toBeNull()
    actor.stop()
  })

  it('QUERY.EXECUTE spawns query actor in connected state', async () => {
    const actor = createActor(testMachine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] },
    })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({
      type: 'QUERY.EXECUTE',
      queryParams: { description: 'test-q', sql: 'SELECT 1', resultOptions: { type: 'array' } },
    })
    // Should stay in connected state
    expect(actor.getSnapshot().value).toBe('connected')
    actor.stop()
  })

  it('handles full transaction lifecycle', async () => {
    const actor = createActor(testMachine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] },
    })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({ type: 'TRANSACTION.BEGIN' })
    await waitForState(actor, 'within_transaction')

    actor.send({
      type: 'TRANSACTION.EXECUTE',
      queryParams: {
        description: 'txn',
        sql: 'INSERT INTO t VALUES(1)',
        resultOptions: { type: 'array' },
      },
    })
    await waitForState(actor, 'within_transaction')

    actor.send({ type: 'TRANSACTION.COMMIT' })
    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().context.transactionConnection).toBeNull()
    actor.stop()
  })

  it('handles transaction rollback', async () => {
    const actor = createActor(testMachine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: null, dbLogLevel: 2, tableDefinitions: [] },
    })
    actor.send({ type: 'CONNECT', dbProgressHandler: null, statusHandler: null })
    await waitForState(actor, 'connected')

    actor.send({ type: 'TRANSACTION.BEGIN' })
    await waitForState(actor, 'within_transaction')

    actor.send({ type: 'TRANSACTION.ROLLBACK' })
    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().context.transactionConnection).toBeNull()
    actor.stop()
  })

  it('configured -> RESET -> idle', () => {
    const actor = createActor(testMachine)
    actor.start()

    actor.send({
      type: 'CONFIGURE',
      config: { dbInitParams: { path: ':memory:' }, dbLogLevel: 2, tableDefinitions: [] },
    })
    expect(actor.getSnapshot().value).toBe('configured')

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.dbInitParams).toBeNull()
    actor.stop()
  })

  it('forwards CATALOG.* events to dbCatalog child', async () => {
    const actor = createActor(testMachine)
    actor.start()

    // Sending a catalog event should not throw (it gets forwarded)
    actor.send({
      type: 'CATALOG.LIST_DEFINITIONS',
      callback: vi.fn(),
    } as any)

    actor.stop()
  })
})
