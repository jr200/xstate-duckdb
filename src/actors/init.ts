import { fromPromise } from "xstate"
import { AsyncDuckDB, ConsoleLogger, DuckDBConfig, getJsDelivrBundles, InstantiationProgressHandler, LogLevel, selectBundle } from "@duckdb/duckdb-wasm"

export interface InitDuckDbParams {
  config: DuckDBConfig | null
  logLevel: LogLevel
  progress: InstantiationProgressHandler
}

export const initDuckDb = fromPromise(async ({ input }: { input: InitDuckDbParams }) => {
  const bundles = getJsDelivrBundles()
  const bundle = await selectBundle(bundles)

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript',
    })
  )

  const worker = new Worker(workerUrl)
  const db = new AsyncDuckDB(new ConsoleLogger(input.logLevel), worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker, input.progress)
  URL.revokeObjectURL(workerUrl)

  if (input.config) {
    console.debug('initDuckDb with config', input.config)
    await db.open(input.config)
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