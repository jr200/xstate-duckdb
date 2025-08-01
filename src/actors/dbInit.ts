import { fromPromise } from 'xstate'
import { AsyncDuckDB, ConsoleLogger, getJsDelivrBundles, selectBundle } from '@duckdb/duckdb-wasm'
import { InitDuckDbParams } from '../lib/types'

export const initDuckDb = fromPromise(async ({ input }: { input: InitDuckDbParams }) => {
  const bundles = getJsDelivrBundles()
  const bundle = await selectBundle(bundles)

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript',
    })
  )

  const worker = new Worker(workerUrl)
  const db = new AsyncDuckDB(new ConsoleLogger(input.dbLogLevel), worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker, input.dbProgressHandler ?? undefined)
  URL.revokeObjectURL(workerUrl)

  if (input.dbInitParams) {
    console.debug('initDuckDb with config', input.dbInitParams)
    await db.open(input.dbInitParams)
  }

  const version = await db.getVersion()

  return {
    db,
    version,
  }
})

export const closeDuckDb = fromPromise(async ({ input }: { input: { db: AsyncDuckDB | null } }) => {
  if (input.db) {
    await input.db.terminate()
  }

  return {
    db: null,
  }
})
