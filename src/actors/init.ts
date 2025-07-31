import { fromPromise } from "xstate"
import { DuckDBConfig } from "@duckdb/duckdb-wasm"

export const initDuckDb = fromPromise(async ({ input }: { input: { config: DuckDBConfig | null } }) => {
  console.log('initDuckDb', input)
  return {
    db: null
  }
})
  