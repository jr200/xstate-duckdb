import { describe, it, expect } from 'vitest'
import {
  duckdbMachine,
  duckdbRunQuery,
  type DuckDbContext,
  type DuckDbEvent,
  type DuckDbCatalogContext,
  type DuckDbCatalogEvent,
  type DuckDbInitialistionStatus,
  type TableDefinition,
  type LoadedTableEntry,
  type MachineConfig,
  type InitDuckDbParams,
  type QueryDbParams,
  type ResultOptions,
  type DuckDbCatalogSnapshot,
} from './index'

describe('xstate-duckdb exports', () => {
  it('should export duckdbMachine', () => {
    expect(duckdbMachine).toBeDefined()
    expect(typeof duckdbMachine).toBe('object')
  })

  it('should export duckdbRunQuery as a function', () => {
    expect(duckdbRunQuery).toBeDefined()
    expect(typeof duckdbRunQuery).toBe('function')
  })

  it('should export types (compile-time check)', () => {
    // These are type-only exports; if this file compiles, they work.
    // We do runtime checks on the value exports.
    const _ctx: DuckDbContext | undefined = undefined
    const _evt: DuckDbEvent | undefined = undefined
    const _catCtx: DuckDbCatalogContext | undefined = undefined
    const _catEvt: DuckDbCatalogEvent | undefined = undefined
    const _status: DuckDbInitialistionStatus | undefined = undefined
    const _tableDef: TableDefinition | undefined = undefined
    const _loadedEntry: LoadedTableEntry | undefined = undefined
    const _config: MachineConfig | undefined = undefined
    const _initParams: InitDuckDbParams | undefined = undefined
    const _queryParams: QueryDbParams | undefined = undefined
    const _resultOpts: ResultOptions | undefined = undefined
    const _snapshot: DuckDbCatalogSnapshot | undefined = undefined

    // Suppress unused warnings
    void [_ctx, _evt, _catCtx, _catEvt, _status, _tableDef, _loadedEntry, _config, _initParams, _queryParams, _resultOpts, _snapshot]

    expect(true).toBe(true)
  })
})
