import React, { useState } from 'react'
import { duckdbMachine, InitDuckDbParams, safeStringify } from 'xstate-duckdb'
import { useActor } from '@xstate/react'
import { DuckDBConfig, InstantiationProgress, LogLevel } from '@duckdb/duckdb-wasm'

export const MachineExample = () => {
  const [state, send] = useActor(duckdbMachine)
  const [query, setQuery] = useState('SELECT * FROM information_schema.tables')
  const [config, setConfig] = useState<DuckDBConfig>({
  "query": {
    "castBigIntToDouble": true,
    "castDecimalToDouble": true,
  }
})
  const [tablesConfig, setTablesConfig] = useState(`[
  {
    "name": "example_table",
    "data": [
      {"id": 1, "name": "Alice"},
      {"id": 2, "name": "Bob"}
    ]
  }
]`)
  const [output, setOutput] = useState('')

  const handleConfigure = () => {
    try {
      const configObj: InitDuckDbParams = { 
        logLevel: LogLevel.DEBUG,
        progress: (progress: InstantiationProgress) => {
          console.log('db loading progress', progress)
        },
        config,
      }
      const tablesObj = JSON.parse(tablesConfig)
      send({
        type: 'CONFIGURE',
        dbInitParams: configObj,
        tables: tablesObj,
      })
      setOutput('Configuration applied successfully')
    } catch (error) {
      setOutput(`Configuration error: ${error}`)
    }
  }

  const handleConnect = () => {
    send({ type: 'CONNECT' })
    setOutput('Connect command sent')
  }

  const handleDisconnect = () => {
    send({ type: 'DISCONNECT' })
    setOutput('Disconnect command sent')
  }

  const handleReset = () => {
    send({ type: 'RESET' })
    setOutput('Reset command sent')
  }

  const handleQuery = () => {
    send({ type: 'QUERY', query })
    setOutput(`Query sent: ${query}`)
  }

  const handleSubscribe = () => {
    send({ type: 'SUBSCRIBE' })
    setOutput('Subscribe command sent')
  }

  const handleUnsubscribe = () => {
    send({ type: 'UNSUBSCRIBE' })
    setOutput('Unsubscribe command sent')
  }

  return (
    <div className='flex h-screen bg-gray-100'>
      {/* Left Panel - Output */}
      <div className='w-1/3 bg-white shadow-lg border-r border-gray-200 p-4 flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>Output</h2>
        <div className='bg-gray-50 border border-gray-300 rounded-md p-3 flex-1 overflow-y-auto font-mono text-sm'>
          {output || 'No output yet...'}
        </div>
      </div>

      {/* Middle Panel - Controls and Configuration */}
      <div className='flex-1 flex flex-col p-4'>
        {/* Configuration Panel */}
        <div className='bg-white rounded-lg shadow-md p-4 mb-4'>
          <h2 className='text-lg font-semibold mb-2'>Configuration</h2>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <h3 className='text-sm font-medium text-gray-700 mb-2'>DuckDB Configuration</h3>
              <textarea
                value={safeStringify(config, 2)}
                onChange={e => setConfig(JSON.parse(e.target.value))}
                className='w-full h-64 p-2 border border-gray-300 rounded-md font-mono text-xs'
                placeholder='Enter DuckDB configuration JSON...'
              />
            </div>
            <div>
              <h3 className='text-sm font-medium text-gray-700 mb-2'>Tables Configuration</h3>
              <textarea
                value={tablesConfig}
                onChange={e => setTablesConfig(e.target.value)}
                className='w-full h-64 p-2 border border-gray-300 rounded-md font-mono text-xs'
                placeholder='Enter tables configuration JSON...'
              />
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className='bg-white rounded-lg shadow-md p-4 flex flex-col flex-1'>
          <h2 className='text-lg font-semibold mb-2'>Query</h2>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            className='w-full flex-1 p-2 border border-gray-300 rounded-md font-mono text-sm resize-none'
            placeholder='Enter your SQL query...'
          />

          <div className='mb-3 mt-4' />
          <div className='flex flex-wrap gap-2'>
            <button
              disabled={!state.can({type: 'CONFIGURE', config: {}, tables: []})}
              onClick={handleConfigure}
              className='px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Configure
            </button>
            <button
              disabled={!state.can({type: 'CONNECT'})}
              onClick={handleConnect}
              className='px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Connect
            </button>
            <button
              disabled={!state.can({type: 'DISCONNECT'})}
              onClick={handleDisconnect}
              className='px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Disconnect
            </button>
            <button
              disabled={!state.can({type: 'RESET'})}
              onClick={handleReset}
              className='px-3 py-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Reset
            </button>
            <button
              disabled={!state.can({type: 'QUERY', sql: query, callback: () => {}})}
              onClick={handleQuery}
              className='px-3 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Query
            </button>
            <button
              disabled={!state.can({type: 'SUBSCRIBE', tableName: '', callback: () => {}})}
              onClick={handleSubscribe}
              className='px-3 py-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Subscribe
            </button>
            <button
              disabled={!state.can({type: 'UNSUBSCRIBE', tableName: '', callback: () => {}})}
              onClick={handleUnsubscribe}
              className='px-3 py-1.5 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm'
            >
              Unsubscribe
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidepanel - Machine State */}
      <div className='w-80 bg-white shadow-lg border-l border-gray-200 p-4'>
        <h2 className='text-lg font-semibold mb-4'>Machine State</h2>
        <div className='space-y-4'>
          <div>
            <h3 className='font-medium text-gray-700 mb-2'>Current State</h3>
            <div className='bg-blue-50 border border-blue-200 rounded-md p-3'>
              <code className='text-blue-800'>{JSON.stringify(state.value, null, 2)}</code>
            </div>
          </div>

          <div>
            <h3 className='font-medium text-gray-700 mb-2'>Context</h3>
            <div className='bg-gray-50 border border-gray-200 rounded-md p-3 max-h-64 overflow-y-auto'>
              <pre className='text-xs text-gray-700'>{JSON.stringify(state.context, null, 2)}</pre>
            </div>
          </div>

          <div>
            <h3 className='font-medium text-gray-700 mb-2'>Available Events</h3>
            <div className='space-y-1'>
              {state.can('CONFIGURE') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>CONFIGURE</span>
              )}
              {state.can('CONNECT') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>CONNECT</span>
              )}
              {state.can('DISCONNECT') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>DISCONNECT</span>
              )}
              {state.can('RESET') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>RESET</span>
              )}
              {state.can('QUERY') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>QUERY</span>
              )}
              {state.can('SUBSCRIBE') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>SUBSCRIBE</span>
              )}
              {state.can('UNSUBSCRIBE') && (
                <span className='inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>UNSUBSCRIBE</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
