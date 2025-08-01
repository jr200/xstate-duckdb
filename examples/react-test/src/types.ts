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
    | 'catalog.list_tables'
    | 'catalog.load_table_from_data'
    | 'catalog.drop_table'
    | 'catalog.get_table_metadata'
  data?: any
  timestamp: Date
}
