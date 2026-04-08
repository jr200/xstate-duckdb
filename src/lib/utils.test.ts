import { describe, it, expect } from 'vitest'
import {
  arrayToSimpleMap,
  arrayToObjectMap,
  arrayToObjectMultiMap,
  arrayToFirstRowMap,
  arrayToFirstValue,
} from './utils'

describe('arrayToSimpleMap', () => {
  it('maps key and value fields from array of objects', () => {
    const input = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]
    const result = arrayToSimpleMap(input, 'id', 'name')
    expect(result).toBeInstanceOf(Map)
    expect(result.get('a')).toBe('Alice')
    expect(result.get('b')).toBe('Bob')
    expect(result.size).toBe(2)
  })

  it('returns empty map for empty array', () => {
    const result = arrayToSimpleMap([], 'id', 'name')
    expect(result.size).toBe(0)
  })

  it('overwrites duplicates with last value', () => {
    const input = [
      { id: 'a', val: 1 },
      { id: 'a', val: 2 },
    ]
    const result = arrayToSimpleMap(input, 'id', 'val')
    expect(result.get('a')).toBe(2)
    expect(result.size).toBe(1)
  })
})

describe('arrayToObjectMap', () => {
  it('maps objects by key field', () => {
    const input = [
      { id: 'x', data: 10 },
      { id: 'y', data: 20 },
    ]
    const result = arrayToObjectMap(input, 'id')
    expect(result.get('x')).toEqual({ id: 'x', data: 10 })
    expect(result.get('y')).toEqual({ id: 'y', data: 20 })
  })

  it('returns empty map for empty array', () => {
    const result = arrayToObjectMap([], 'id')
    expect(result.size).toBe(0)
  })

  it('overwrites duplicates with last object', () => {
    const input = [
      { id: 'a', v: 1 },
      { id: 'a', v: 2 },
    ]
    const result = arrayToObjectMap(input, 'id')
    expect(result.get('a')).toEqual({ id: 'a', v: 2 })
  })
})

describe('arrayToObjectMultiMap', () => {
  it('groups objects by key field', () => {
    const input = [
      { category: 'fruit', name: 'apple' },
      { category: 'fruit', name: 'banana' },
      { category: 'veg', name: 'carrot' },
    ]
    const result = arrayToObjectMultiMap(input, 'category')
    expect(result.get('fruit')).toHaveLength(2)
    expect(result.get('veg')).toHaveLength(1)
  })

  it('returns empty map for empty array', () => {
    const result = arrayToObjectMultiMap([], 'key')
    expect(result.size).toBe(0)
  })

  it('throws when key does not exist on an item', () => {
    const input = [{ other: 'value' }]
    expect(() => arrayToObjectMultiMap(input, 'missing')).toThrow(
      'Key missing does not exist in array'
    )
  })
})

describe('arrayToFirstRowMap', () => {
  it('returns the first row', () => {
    const input = [{ a: 1 }, { a: 2 }]
    expect(arrayToFirstRowMap(input)).toEqual({ a: 1 })
  })

  it('returns null for empty array', () => {
    expect(arrayToFirstRowMap([])).toBeNull()
  })
})

describe('arrayToFirstValue', () => {
  it('returns the value of the specified key from the first row', () => {
    const input = [{ name: 'Alice', age: 30 }]
    expect(arrayToFirstValue(input, 'name')).toBe('Alice')
  })

  it('returns null for empty array', () => {
    expect(arrayToFirstValue([], 'name')).toBeNull()
  })

  it('returns null when key does not exist on first row', () => {
    const input = [{ other: 'value' }]
    expect(arrayToFirstValue(input, 'missing')).toBeNull()
  })
})
