export const catalogSubscribe = (tableSpecName: string, callback: (tableInstanceName: string) => void) => {
  return {
    type: 'CATALOG.SUBSCRIBE',
    tableSpecName,
    callback,
  }
}

export const catalogUnsubscribe = (tableSpecName: string, callback: (tableInstanceName: string) => void) => {
  return {
    type: 'CATALOG.UNSUBSCRIBE',
    tableSpecName,
    callback,
  }
}
