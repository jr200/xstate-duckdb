import { fromPromise } from 'xstate/actors'

export const loadTableIntoDuckDb = fromPromise(async ({ input, context }: any) => {
  console.log('loadTable', input, context, input.duckDbHandle)
  const nextTableId = input.nextTableId

  // create catalog entry for the table
  // get the version and table name to create
  // unmarshal and load the payload into the table
  // callback the result


  input.callback?.({tableName: input.tableName, tableVersion: nextTableId, error: undefined})
})
