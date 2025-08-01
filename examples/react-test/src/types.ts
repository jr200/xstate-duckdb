export interface DisplayOutputResult {
  type:
    | 'query.execute'
    | 'transaction.begin'
    | 'transaction.execute'
    | 'transaction.commit'
    | 'transaction.rollback'
    | 'disconnect'
    | 'connect'
    | 'configure'
    | 'reset'
    | 'error'
    | 'clear'
    | 'catalog.subscribe'
    | 'catalog.unsubscribe'
    | 'catalog.listTables'
    | 'catalog.loadTableFromData'
    | 'catalog.deleteTable'
    | 'catalog.getTableMetadata'
  data?: any
  timestamp: Date
}
