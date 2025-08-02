import React, { useState, useRef, useEffect } from 'react'

import '@xterm/xterm/css/xterm.css'
import * as shell from '@duckdb/duckdb-wasm-shell'
import { AsyncDuckDB } from '@duckdb/duckdb-wasm'
import shell_wasm from "@duckdb/duckdb-wasm-shell/dist/shell_bg.wasm?url";

export default function DbShell({ db }: { db?: AsyncDuckDB }) {
  const [isShellOpen, setIsShellOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const handleOpenShell = () => {
    setIsShellOpen(true)
  }

  useEffect(() => {
    if (isShellOpen && db && ref.current) {
      console.log('Initializing shell', db, ref.current)
      
      const config = {
        container: ref.current,
        shellModule: shell_wasm,
        resolveDatabase: async () => db,
      }

      shell.embed(config)
    }
  }, [isShellOpen, db])

  const handleCloseShell = () => {
    setIsShellOpen(false)
  }

  if (!db) {
    return (
      <button 
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        disabled={!db}
      >
        Shell
      </button>
    )
  }

  return (
    <>
      <button 
        onClick={handleOpenShell}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        Shell
      </button>
      
      {isShellOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-3/4 h-3/4 max-w-4xl max-h-3xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">DuckDB Shell</h3>
              <button
                onClick={handleCloseShell}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <div
                id='xterm_div'
                ref={ref}
                className='w-full h-full bg-black'
                style={{
                  minHeight: 0,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
