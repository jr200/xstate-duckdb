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
    | 'catalog.load_table'
    | 'catalog.drop_table'
    | 'catalog.get_configuration'
  data?: any
  timestamp: Date
}
