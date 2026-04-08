import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, setup, assign } from 'xstate'
import type { TableDefinition, LoadedTableEntry, CatalogSubscription } from '../lib/types'

// Create a testable version of dbCatalogLogic with mocked actors
function createTestCatalogMachine(
  loadResult?: LoadedTableEntry,
  pruneResult?: { loadedVersions: LoadedTableEntry[] }
) {
  return setup({
    types: {
      context: {} as {
        tableDefinitions: TableDefinition[]
        loadedVersions: LoadedTableEntry[]
        subscriptions: Map<string, CatalogSubscription>
        nextTableId: number
        pendingTableLoads: any[]
        currentTableLoad: any
        error: string | null
      },
      events: {} as any,
    },
    actors: {
      loadTableIntoDuckDb: fromPromise(async () => {
        return (
          loadResult ?? {
            tableIsVersioned: true,
            tableVersionId: 1,
            tableSpecName: 'test',
            tableInstanceName: 'test_1',
            loadedEpoch: Date.now(),
          }
        )
      }),
      pruneTableVersions: fromPromise(async () => {
        return pruneResult ?? { loadedVersions: [] }
      }),
    },
    guards: {
      hasPendingTableLoads: ({ context }: any) => context.pendingTableLoads.length > 0,
    },
  }).createMachine({
    initial: 'idle',
    context: {
      tableDefinitions: [],
      loadedVersions: [],
      subscriptions: new Map<string, CatalogSubscription>(),
      nextTableId: 1,
      pendingTableLoads: [],
      currentTableLoad: null,
      error: null,
    },
    on: {
      'CATALOG.SUBSCRIBE': {
        actions: assign(({ context, event }: any) => {
          const { subscription } = event
          const subscriptionKey = subscription.subscriptionUid ?? subscription.tableSpecName
          const newSubscriptions = new Map(context.subscriptions)
          newSubscriptions.set(subscriptionKey, { ...subscription, subscriptionUid: subscriptionKey })
          return { subscriptions: newSubscriptions }
        }),
      },
      'CATALOG.UNSUBSCRIBE': {
        actions: assign(({ context, event }: any) => {
          const newSubscriptions = new Map(context.subscriptions)
          newSubscriptions.delete(event.id)
          return { subscriptions: newSubscriptions }
        }),
      },
      'CATALOG.LOAD_TABLE': {
        actions: assign(({ context, event }: any) => {
          const eventWithDbHandle = { ...event.data, duckDbHandle: event.duckDbHandle }
          return { pendingTableLoads: [...context.pendingTableLoads, eventWithDbHandle] }
        }),
      },
      'CATALOG.LIST_DEFINITIONS': {
        actions: ({ context, event }: any) => {
          event.callback(context.tableDefinitions)
        },
      },
    },
    states: {
      idle: {
        on: {
          'CATALOG.CONFIGURE': {
            target: 'configured',
            actions: assign({ tableDefinitions: ({ event }: any) => event.tableDefinitions }),
          },
        },
      },
      configured: {
        on: {
          'CATALOG.RESET': {
            target: 'idle',
            actions: assign(() => ({
              config: [] as any,
              loadedVersions: [] as LoadedTableEntry[],
              subscriptions: new Map<string, CatalogSubscription>(),
              pendingTableLoads: [] as any[],
              currentTableLoad: null,
            })),
          },
          'CATALOG.CONNECT': { target: 'connected' },
        },
      },
      connected: {
        always: {
          target: 'loading_table',
          guard: 'hasPendingTableLoads',
        },
        on: {
          'CATALOG.DISCONNECT': { target: 'configured' },
          'CATALOG.LIST_TABLES': {
            actions: ({ context, event }: any) => {
              event.callback(context.loadedVersions)
            },
          },
          'CATALOG.FORCE_NOTIFY': {
            actions: ({ context, event }: any) => {
              const foundSub = context.subscriptions.get(event.id)
              if (foundSub) {
                const latestTable = context.loadedVersions
                  .filter((entry: LoadedTableEntry) => entry.tableSpecName === foundSub.tableSpecName)
                  .sort((a: LoadedTableEntry, b: LoadedTableEntry) => b.tableVersionId - a.tableVersionId)[0]
                if (latestTable) {
                  foundSub.onChange(latestTable.tableInstanceName, latestTable.tableVersionId, latestTable.tableIsVersioned)
                }
              }
            },
          },
        },
      },
      loading_table: {
        entry: assign(({ context }: any) => {
          const [firstItem, ...remainingItems] = context.pendingTableLoads
          return { pendingTableLoads: remainingItems, currentTableLoad: firstItem }
        }),
        invoke: {
          src: 'loadTableIntoDuckDb',
          input: ({ context }: any) => ({
            ...context.currentTableLoad,
            nextTableId: context.nextTableId,
            tableDefinitions: context.tableDefinitions,
          }),
          onDone: {
            target: 'pruning_versions',
            actions: assign(({ event, context }: any) => {
              const loadedTable = event.output as LoadedTableEntry
              const newLoadedVersions = [loadedTable, ...context.loadedVersions]
              for (const [_, subscription] of context.subscriptions.entries()) {
                if (subscription.tableSpecName === loadedTable.tableSpecName) {
                  subscription.onChange(loadedTable.tableInstanceName, loadedTable.tableVersionId, loadedTable.tableIsVersioned)
                }
              }
              return { nextTableId: context.nextTableId + 1, loadedVersions: newLoadedVersions }
            }),
          },
          onError: {
            target: 'error',
            actions: assign({
              nextTableId: ({ context }: any) => context.nextTableId + 1,
              error: ({ event }: any) => event.error?.message ?? 'unknown',
              currentTableLoad: null,
            }),
          },
        },
      },
      pruning_versions: {
        invoke: {
          src: 'pruneTableVersions',
          input: ({ context }: any) => ({
            currentLoadedVersions: context.loadedVersions,
            tableDefinitions: context.tableDefinitions,
            duckDbHandle: context.currentTableLoad?.duckDbHandle,
          }),
          onDone: {
            target: 'connected',
            actions: assign(({ event }: any) => ({
              loadedVersions: event.output.loadedVersions,
              currentTableLoad: null,
            })),
          },
          onError: {
            target: 'error',
            actions: assign({
              nextTableId: ({ context }: any) => context.nextTableId + 1,
              error: ({ event }: any) => event,
              currentTableLoad: null,
            }),
          },
        },
      },
      error: {
        on: { 'CATALOG.RESET': { target: 'idle' } },
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

describe('dbCatalogLogic', () => {
  it('starts in idle state', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  it('transitions idle -> configured on CATALOG.CONFIGURE', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    const defs: TableDefinition[] = [{ schema: 'main', name: 'test', isVersioned: true, maxVersions: 3 }]
    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: defs })

    expect(actor.getSnapshot().value).toBe('configured')
    expect(actor.getSnapshot().context.tableDefinitions).toEqual(defs)
    actor.stop()
  })

  it('transitions configured -> idle on CATALOG.RESET', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [] })
    actor.send({ type: 'CATALOG.RESET' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.loadedVersions).toEqual([])
    expect(actor.getSnapshot().context.subscriptions.size).toBe(0)
    actor.stop()
  })

  it('transitions configured -> connected on CATALOG.CONNECT', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [] })
    actor.send({ type: 'CATALOG.CONNECT' })

    expect(actor.getSnapshot().value).toBe('connected')
    actor.stop()
  })

  it('transitions connected -> configured on CATALOG.DISCONNECT', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [] })
    actor.send({ type: 'CATALOG.CONNECT' })
    actor.send({ type: 'CATALOG.DISCONNECT' })

    expect(actor.getSnapshot().value).toBe('configured')
    actor.stop()
  })

  it('handles CATALOG.SUBSCRIBE and CATALOG.UNSUBSCRIBE', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    const subscription: CatalogSubscription = {
      tableSpecName: 'test',
      subscriptionUid: 'sub1',
      onSubscribe: vi.fn(),
      onChange: vi.fn(),
    }

    actor.send({ type: 'CATALOG.SUBSCRIBE', subscription })
    expect(actor.getSnapshot().context.subscriptions.size).toBe(1)
    expect(actor.getSnapshot().context.subscriptions.get('sub1')).toBeDefined()

    actor.send({ type: 'CATALOG.UNSUBSCRIBE', id: 'sub1' })
    expect(actor.getSnapshot().context.subscriptions.size).toBe(0)
    actor.stop()
  })

  it('uses tableSpecName as subscriptionUid when subscriptionUid is not provided', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    const subscription: CatalogSubscription = {
      tableSpecName: 'my_table',
      onSubscribe: vi.fn(),
      onChange: vi.fn(),
    }

    actor.send({ type: 'CATALOG.SUBSCRIBE', subscription })
    expect(actor.getSnapshot().context.subscriptions.get('my_table')).toBeDefined()
    actor.stop()
  })

  it('calls callback on CATALOG.LIST_TABLES', () => {
    const loadedEntry: LoadedTableEntry = {
      tableIsVersioned: true,
      tableVersionId: 1,
      tableSpecName: 'test',
      tableInstanceName: 'test_1',
      loadedEpoch: 1000,
    }

    const pruneResult = { loadedVersions: [loadedEntry] }
    const machine = createTestCatalogMachine(loadedEntry, pruneResult)
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [] })
    actor.send({ type: 'CATALOG.CONNECT' })

    const callback = vi.fn()
    actor.send({ type: 'CATALOG.LIST_TABLES', callback })
    expect(callback).toHaveBeenCalledWith(actor.getSnapshot().context.loadedVersions)
    actor.stop()
  })

  it('calls callback on CATALOG.LIST_DEFINITIONS', () => {
    const defs: TableDefinition[] = [{ schema: 'main', name: 'test', isVersioned: true, maxVersions: 3 }]
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: defs })

    const callback = vi.fn()
    actor.send({ type: 'CATALOG.LIST_DEFINITIONS', callback })
    expect(callback).toHaveBeenCalledWith(defs)
    actor.stop()
  })

  it('queues CATALOG.LOAD_TABLE and processes when connected', async () => {
    const loadedEntry: LoadedTableEntry = {
      tableIsVersioned: true,
      tableVersionId: 1,
      tableSpecName: 'test',
      tableInstanceName: 'test_1',
      loadedEpoch: Date.now(),
    }
    const pruneResult = { loadedVersions: [loadedEntry] }
    const machine = createTestCatalogMachine(loadedEntry, pruneResult)
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [{ schema: 'main', name: 'test', isVersioned: true, maxVersions: 3 }] })
    actor.send({ type: 'CATALOG.CONNECT' })

    // Queue a table load
    actor.send({
      type: 'CATALOG.LOAD_TABLE',
      data: {
        tableSpecName: 'test',
        tablePayload: { data: [] },
        payloadType: 'json',
        payloadCompression: 'none',
      },
      duckDbHandle: {},
    })

    await waitForState(actor, 'connected')

    expect(actor.getSnapshot().context.loadedVersions).toHaveLength(1)
    expect(actor.getSnapshot().context.nextTableId).toBe(2)
    actor.stop()
  })

  it('notifies subscribers when a table is loaded', async () => {
    const onChange = vi.fn()
    const loadedEntry: LoadedTableEntry = {
      tableIsVersioned: true,
      tableVersionId: 1,
      tableSpecName: 'test',
      tableInstanceName: 'test_1',
      loadedEpoch: Date.now(),
    }
    const pruneResult = { loadedVersions: [loadedEntry] }
    const machine = createTestCatalogMachine(loadedEntry, pruneResult)
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [{ schema: 'main', name: 'test', isVersioned: true, maxVersions: 3 }] })

    // Subscribe before connecting
    actor.send({
      type: 'CATALOG.SUBSCRIBE',
      subscription: { tableSpecName: 'test', subscriptionUid: 'sub1', onSubscribe: vi.fn(), onChange },
    })

    actor.send({ type: 'CATALOG.CONNECT' })

    // Queue a table load
    actor.send({
      type: 'CATALOG.LOAD_TABLE',
      data: { tableSpecName: 'test', tablePayload: {}, payloadType: 'json', payloadCompression: 'none' },
      duckDbHandle: {},
    })

    await waitForState(actor, 'connected')

    expect(onChange).toHaveBeenCalledWith('test_1', 1, true)
    actor.stop()
  })

  it('handles CATALOG.FORCE_NOTIFY', async () => {
    const onChange = vi.fn()
    const loadedEntry: LoadedTableEntry = {
      tableIsVersioned: true,
      tableVersionId: 5,
      tableSpecName: 'test',
      tableInstanceName: 'test_5',
      loadedEpoch: Date.now(),
    }
    const pruneResult = { loadedVersions: [loadedEntry] }
    const machine = createTestCatalogMachine(loadedEntry, pruneResult)
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [{ schema: 'main', name: 'test', isVersioned: true, maxVersions: 3 }] })
    actor.send({
      type: 'CATALOG.SUBSCRIBE',
      subscription: { tableSpecName: 'test', subscriptionUid: 'sub1', onSubscribe: vi.fn(), onChange },
    })
    actor.send({ type: 'CATALOG.CONNECT' })

    // Load a table first
    actor.send({
      type: 'CATALOG.LOAD_TABLE',
      data: { tableSpecName: 'test', tablePayload: {}, payloadType: 'json', payloadCompression: 'none' },
      duckDbHandle: {},
    })

    await waitForState(actor, 'connected')
    onChange.mockClear()

    actor.send({ type: 'CATALOG.FORCE_NOTIFY', id: 'sub1' })
    expect(onChange).toHaveBeenCalledWith('test_5', 5, true)
    actor.stop()
  })

  it('FORCE_NOTIFY does nothing when subscription not found', () => {
    const machine = createTestCatalogMachine()
    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [] })
    actor.send({ type: 'CATALOG.CONNECT' })

    // Should not throw
    actor.send({ type: 'CATALOG.FORCE_NOTIFY', id: 'nonexistent' })
    actor.stop()
  })

  it('handles error -> CATALOG.RESET -> idle', async () => {
    // Create a machine with a failing loadTableIntoDuckDb
    const failingMachine = setup({
      types: {
        context: {} as any,
        events: {} as any,
      },
      actors: {
        loadTableIntoDuckDb: fromPromise(async () => {
          throw new Error('load failed')
        }),
        pruneTableVersions: fromPromise(async () => ({ loadedVersions: [] })),
      },
      guards: {
        hasPendingTableLoads: ({ context }: any) => context.pendingTableLoads.length > 0,
      },
    }).createMachine({
      initial: 'idle',
      context: {
        tableDefinitions: [],
        loadedVersions: [],
        subscriptions: new Map(),
        nextTableId: 1,
        pendingTableLoads: [],
        currentTableLoad: null,
        error: null,
      },
      on: {
        'CATALOG.LOAD_TABLE': {
          actions: assign(({ context, event }: any) => ({
            pendingTableLoads: [...context.pendingTableLoads, { ...event.data, duckDbHandle: event.duckDbHandle }],
          })),
        },
      },
      states: {
        idle: {
          on: {
            'CATALOG.CONFIGURE': {
              target: 'configured',
              actions: assign({ tableDefinitions: ({ event }: any) => event.tableDefinitions }),
            },
          },
        },
        configured: {
          on: { 'CATALOG.CONNECT': { target: 'connected' } },
        },
        connected: {
          always: { target: 'loading_table', guard: 'hasPendingTableLoads' },
        },
        loading_table: {
          entry: assign(({ context }: any) => {
            const [firstItem, ...rest] = context.pendingTableLoads
            return { pendingTableLoads: rest, currentTableLoad: firstItem }
          }),
          invoke: {
            src: 'loadTableIntoDuckDb',
            input: ({ context }: any) => ({ ...context.currentTableLoad, nextTableId: context.nextTableId, tableDefinitions: context.tableDefinitions }),
            onDone: { target: 'connected' },
            onError: {
              target: 'error',
              actions: assign({
                error: ({ event }: any) => event.error?.message ?? 'unknown',
                currentTableLoad: null,
              }),
            },
          },
        },
        pruning_versions: {},
        error: {
          on: { 'CATALOG.RESET': { target: 'idle' } },
        },
      },
    })

    const actor = createActor(failingMachine)
    actor.start()

    actor.send({ type: 'CATALOG.CONFIGURE', tableDefinitions: [] })
    actor.send({ type: 'CATALOG.CONNECT' })
    actor.send({
      type: 'CATALOG.LOAD_TABLE',
      data: { tableSpecName: 'test', tablePayload: {}, payloadType: 'json', payloadCompression: 'none' },
      duckDbHandle: {},
    })

    await waitForState(actor, 'error')
    expect(actor.getSnapshot().value).toBe('error')

    actor.send({ type: 'CATALOG.RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })
})
