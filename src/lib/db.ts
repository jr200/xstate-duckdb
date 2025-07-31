import {
  AsyncDuckDB,
  ConsoleLogger,
  DuckDBConfig,
  getJsDelivrBundles,
  LogLevel,
  selectBundle,
} from '@duckdb/duckdb-wasm'
import { InstantiationProgress } from '@duckdb/duckdb-wasm'

let globalDuckDbInstance: AsyncDuckDB | null = null

export async function initDuckDb(
  config: DuckDBConfig | undefined,
  logLevel: LogLevel,
  progress: (progress: InstantiationProgress) => void
): Promise<AsyncDuckDB> {
  // Clean up any existing instance first
  if (globalDuckDbInstance) {
    console.log('🧹 Cleaning up existing DuckDB instance before creating new one')
    try {
      await globalDuckDbInstance.terminate()
    } catch (error) {
      console.error('Error cleaning up existing DuckDB:', error)
    }
    globalDuckDbInstance = null
  }

  const bundles = getJsDelivrBundles()
  const bundle = await selectBundle(bundles)

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript',
    })
  )

  // const worker = new Worker(workerUrl)
  const db = new AsyncDuckDB(new ConsoleLogger(logLevel))
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker, progress)

  URL.revokeObjectURL(workerUrl)

  if (config) {
    console.debug('initDuckDb with config', config)
    await db.open(config)
  }

  // Store globally for cleanup
  globalDuckDbInstance = db

  return db
}
