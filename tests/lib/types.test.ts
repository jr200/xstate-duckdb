import { describe, it, expect } from 'vitest'
import { DUCKDB_TABLE } from '../../src/lib/types'

describe('DUCKDB_TABLE', () => {
  it('has a catalog table definition', () => {
    expect(DUCKDB_TABLE.catalog).toEqual({
      schema: 'main',
      name: 'catalog',
      isVersioned: false,
      maxVersions: 1,
    })
  })
})
