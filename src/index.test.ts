import { describe, it, expect } from 'vitest'
import { duckdbMachine } from './index'

describe('xstate-duckdb', () => {
  it('should export duckdbMachine', () => {
    expect(duckdbMachine).toBeDefined()
    expect(typeof duckdbMachine).toBe('object')
  })
})
