import { describe, it, expect, vi, beforeEach } from 'vitest'

// Suppress expected console.debug output in tests
vi.spyOn(console, 'debug').mockImplementation(() => {})

const mockInstantiate = vi.fn().mockResolvedValue(undefined)
const mockOpen = vi.fn().mockResolvedValue(undefined)
const mockGetVersion = vi.fn().mockResolvedValue('v0.10.0')
const mockTerminate = vi.fn().mockResolvedValue(undefined)

vi.mock('@duckdb/duckdb-wasm', () => {
  return {
    AsyncDuckDB: class MockAsyncDuckDB {
      instantiate = mockInstantiate
      open = mockOpen
      getVersion = mockGetVersion
      terminate = mockTerminate
    },
    ConsoleLogger: class MockConsoleLogger {},
    getJsDelivrBundles: vi.fn().mockReturnValue({}),
    selectBundle: vi.fn().mockResolvedValue({
      mainModule: 'module.wasm',
      mainWorker: 'worker.js',
      pthreadWorker: 'pthread.js',
    }),
    LogLevel: { WARNING: 2, ERROR: 1 },
  }
})

// Mock browser APIs
vi.stubGlobal(
  'URL',
  Object.assign(globalThis.URL ?? function () {}, {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: vi.fn(),
  }),
)
vi.stubGlobal('Blob', class MockBlob {})
vi.stubGlobal('Worker', class MockWorker {})

import { createActor } from 'xstate'
import { initDuckDb, closeDuckDb } from '../../src/actors/dbInit'
import { LogLevel } from '@duckdb/duckdb-wasm'

describe('initDuckDb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes DuckDB and returns db handle and version', async () => {
    const actor = createActor(initDuckDb, {
      input: {
        dbLogLevel: LogLevel.WARNING,
        dbInitParams: null,
      },
    })

    const result = await new Promise<any>((resolve, reject) => {
      actor.subscribe({
        complete() {
          resolve(actor.getSnapshot().output)
        },
        error: reject,
      })
      actor.start()
    })

    expect(result.db).toBeDefined()
    expect(result.version).toBe('v0.10.0')
    expect(mockInstantiate).toHaveBeenCalled()
  })

  it('calls statusHandler with initializing and ready', async () => {
    const statusHandler = vi.fn()

    const actor = createActor(initDuckDb, {
      input: {
        dbLogLevel: LogLevel.WARNING,
        dbInitParams: null,
        statusHandler,
      },
    })

    await new Promise<void>((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(),
        error: reject,
      })
      actor.start()
    })

    expect(statusHandler).toHaveBeenCalledWith('initializing')
    expect(statusHandler).toHaveBeenCalledWith('ready')
  })

  it('calls db.open when dbInitParams is provided', async () => {
    const dbInitParams = { path: ':memory:' }
    const actor = createActor(initDuckDb, {
      input: {
        dbLogLevel: LogLevel.WARNING,
        dbInitParams,
      },
    })

    await new Promise<void>((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(),
        error: reject,
      })
      actor.start()
    })

    expect(mockOpen).toHaveBeenCalledWith(dbInitParams)
  })

  it('does not call db.open when dbInitParams is null', async () => {
    const actor = createActor(initDuckDb, {
      input: {
        dbLogLevel: LogLevel.WARNING,
        dbInitParams: null,
      },
    })

    await new Promise<void>((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(),
        error: reject,
      })
      actor.start()
    })

    expect(mockOpen).not.toHaveBeenCalled()
  })
})

describe('closeDuckDb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('terminates the database', async () => {
    const mockDb = { terminate: mockTerminate }

    const actor = createActor(closeDuckDb, {
      input: { db: mockDb as any },
    })

    const result = await new Promise<any>((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(actor.getSnapshot().output),
        error: reject,
      })
      actor.start()
    })

    expect(mockTerminate).toHaveBeenCalled()
    expect(result.db).toBeNull()
  })

  it('handles null db gracefully', async () => {
    const actor = createActor(closeDuckDb, {
      input: { db: null },
    })

    const result = await new Promise<any>((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(actor.getSnapshot().output),
        error: reject,
      })
      actor.start()
    })

    expect(mockTerminate).not.toHaveBeenCalled()
    expect(result.db).toBeNull()
  })
})
