const getCircularReplacer = () => {
  const seen = new WeakSet()
  return (_key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]' // Better than undefined
      }
      seen.add(value)

      // Handle Maps by converting to array of entries
      if (value instanceof Map) {
        return Array.from(value.entries())
      }

      // Handle Dates by converting to ISO string
      if (value instanceof Date) {
        return value.toISOString()
      }

      // Handle Sets
      if (value instanceof Set) {
        return Array.from(value)
      }

      // Handle other non-serializable objects
      if (value instanceof RegExp) {
        return value.toString()
      }

      if (typeof value === 'function') {
        return '[Function]'
      }

      if (typeof value === 'symbol') {
        return value.toString()
      }
    }
    return value
  }
}

export const safeStringify = (obj: any, space?: number) => {
  try {
    return JSON.stringify(obj, getCircularReplacer(), space)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `[Error serializing object: ${errorMessage}]`
  }
}

export function joinLiterals(values: string[]): string {
  return values.map(value => `'${value}'`).join(',')
}

export function arrayToSimpleMap(array: any[], key: string, value: string): Map<string, any> {
  const map = new Map<string, any>()
  array.forEach(item => {
    map.set(item[key], item[value])
  })
  return map
}

export function arrayToObjectMap(array: any[], key: string): Map<string, any> {
  const map = new Map<string, any>()
  array.forEach(item => {
    map.set(item[key], item)
  })
  return map
}

export function arrayToObjectMultiMap(array: any[], key: string): Map<string, any[]> {
  const map = new Map<string, any[]>()
  array.forEach(item => {
    const keyValue = item[key]
    if (!keyValue) {
      throw new Error(`Key ${key} does not exist in array. Array: ${JSON.stringify(item)}`)
    }
    if (!map.has(keyValue)) {
      map.set(keyValue, [])
    }
    map.get(keyValue)!.push(item)
  })
  return map
}
