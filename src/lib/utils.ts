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
