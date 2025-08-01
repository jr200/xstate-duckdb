import React, { useState } from 'react'
import {
  duckdbMachine,
  InitDuckDbParams,
  LoadedTableEntry,
  QueryDbParams,
  safeStringify,
  TableDefinition,
} from 'xstate-duckdb'
import { useActor, useSelector } from '@xstate/react'
import { DuckDBConfig, InstantiationProgress, LogLevel } from '@duckdb/duckdb-wasm'
import { DisplayOutputResult } from './types'
import { ProgressBar } from './ProgressBar'
import { getButtonClasses, getTypeStyles } from './styles'
import payloadContent from '/payload.b64ipc_zlib.txt?raw'

export const MachineExample = () => {
  const [state, send, actor] = useActor(duckdbMachine)
  const dbCatalogRef = useSelector(actor, state => state.children.dbCatalog)
  const dbCatalogState = useSelector(dbCatalogRef, state => state)

  const [query, setQuery] = useState('SELECT * FROM duckdb_databases();')
  const [outputs, setOutputs] = useState<DisplayOutputResult[]>([])
  const [config, setConfig] = useState<DuckDBConfig>({
    query: {
      castBigIntToDouble: true,
      castDecimalToDouble: true,
    },
  })
  const [dbCatalogConfig, setDbCatalogConfig] = useState(`[{
      "name": "test_table",
      "schema": "main",
      "isVersioned": true,
      "maxVersions": 2
  }]`)

  // New state for catalog panel
  const [tableName, setTableName] = useState('test_table')
  const [tableType, setTableType] = useState<'b64ipc' | 'json'>('b64ipc')
  const [tablePayload, setTablePayload] = useState(payloadContent)

  // New state for initialization progress
  const [initProgress, setInitProgress] = useState<InstantiationProgress | null>(null)

  const addOutput = (type: DisplayOutputResult['type'], data?: any) => {
    const newOutput: DisplayOutputResult = {
      type,
      data,
      timestamp: new Date(),
    }
    setOutputs(prev => [newOutput, ...prev])
  }

  const clearOutput = () => {
    setOutputs([])
  }

  const handleConfigure = () => {
    try {
      const configObj: InitDuckDbParams = {
        logLevel: LogLevel.DEBUG,
        progress: (progress: InstantiationProgress) => {
          setInitProgress(progress)
        },
        config,
      }
      const dbCatalogObj = JSON.parse(dbCatalogConfig)
      send({
        type: 'CONFIGURE',
        dbInitParams: configObj,
        catalogConfig: dbCatalogObj,
      })
      addOutput('configure', 'Configuration applied successfully')
    } catch (error) {
      console.error(error)
      addOutput('error', `Configuration error: ${error}`)
    }
  }

  const handleConnect = () => {
    send({ type: 'CONNECT' })
    addOutput('connect', 'Connect command sent')
  }

  const handleDisconnect = () => {
    send({ type: 'DISCONNECT' })
    addOutput('disconnect', 'Disconnect command sent')
  }

  const handleReset = () => {
    send({ type: 'RESET' })
    addOutput('reset', 'Reset command sent')
  }

  const handleQueryAutoCommit = () => {
    addOutput('query.execute', `Query sent: ${query}`)
    const queryParams: QueryDbParams = {
      sql: query,
      callback: data => {
        addOutput('query.execute', data)
      },
      description: 'execute',
      resultType: 'json',
    }
    send({
      type: 'QUERY.EXECUTE',
      queryParams,
    })
  }

  const handleSubscribe = () => {
    send({ type: 'CATALOG.SUBSCRIBE', tableSpecName: 'test_table', callback: () => {} })
    addOutput('catalog.subscribe', 'Subscribe command sent')
  }

  const handleUnsubscribe = () => {
    send({ type: 'CATALOG.UNSUBSCRIBE', tableSpecName: 'test_table', callback: () => {} })
    addOutput('catalog.unsubscribe', 'Unsubscribe command sent')
  }

  const handleTransactionBegin = () => {
    send({ type: 'TRANSACTION.BEGIN' })
    addOutput('transaction.begin', 'Transaction begin command sent')
  }

  const handleTransactionExecute = () => {
    addOutput('transaction.execute', `Query sent: ${query}`)
    const queryParams: QueryDbParams = {
      sql: query,
      callback: data => {
        addOutput('transaction.execute', data)
      },
      description: 'transaction.execute',
      resultType: 'json',
    }
    send({
      type: 'TRANSACTION.EXECUTE',
      queryParams,
    })
  }

  const handleTransactionCommit = () => {
    send({ type: 'TRANSACTION.COMMIT' })
    addOutput('transaction.commit', 'Transaction commit command sent')
  }

  const handleTransactionRollback = () => {
    send({ type: 'TRANSACTION.ROLLBACK' })
    addOutput('transaction.rollback', 'Transaction rollback command sent')
  }

  // New catalog handlers
  const handleListTables = () => {
    send({
      type: 'CATALOG.LIST_TABLES',
      callback: (tables: LoadedTableEntry[]) => {
        addOutput('catalog.list_tables', safeStringify(tables, 2))
      },
    })
  }

  const handleLoadTable = () => {
    try {
      let payload
      if (tableType === 'json') {
        payload = JSON.parse(tablePayload)
      } else {
        payload = tablePayload // For arrow, this would be base64 encoded data
      }

      send({
        type: 'CATALOG.LOAD_TABLE',
        tableName: tableName,
        tablePayload: payload,
        payloadType: tableType,
        payloadCompression: 'zlib',
        callback: (tableInstanceName: string, error?: string) => {
          addOutput('catalog.load_table', { tableInstanceName, error })
        },
      })
    } catch (error) {
      console.error(error)
      addOutput('error', `Load table error: ${error}`)
    }
  }

  const handleDropTable = () => {
    send({ type: 'CATALOG.DROP_TABLE', tableName })
    addOutput('catalog.drop_table', `Drop table command sent for: ${tableName}`)
  }

  const handleShowConfiguration = () => {
    send({
      type: 'CATALOG.LIST_DEFINITIONS',
      callback: (config: TableDefinition[]) => {
        addOutput('catalog.list_definitions', safeStringify(config, 2))
      },
    })
  }

  return (
    <div className='flex h-screen bg-gray-100'>
      {/* Left Panel - Output */}
      <div className='w-1/3 bg-white shadow-lg border-r border-gray-200 p-4 flex flex-col'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold'>Output</h2>
          <button onClick={clearOutput} className={getButtonClasses('clear')}>
            Clear
          </button>
        </div>
        <div className='bg-gray-50 border border-gray-300 rounded-md p-3 flex-1 overflow-y-auto'>
          {outputs.length === 0 ? (
            <div className='text-gray-500 text-center py-8'>No output yet...</div>
          ) : (
            <div className='space-y-3'>
              {outputs.map((output, index) => (
                <div key={index} className='bg-white rounded-lg border border-gray-200 p-3 shadow-sm'>
                  <div className='flex items-center justify-between mb-2'>
                    <span
                      className={`${getTypeStyles(output.type).base} text-white px-2 py-1 rounded text-xs font-medium uppercase`}
                    >
                      {output.type}
                    </span>
                    <span className='text-gray-500 text-xs'>{output.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <div className='font-mono text-sm text-gray-800 break-words'>
                    {typeof output.data === 'string' ? output.data : safeStringify(output.data, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                value={dbCatalogConfig}
                onChange={e => setDbCatalogConfig(e.target.value)}
                className='w-full h-64 p-2 border border-gray-300 rounded-md font-mono text-xs'
                placeholder='Enter tables configuration JSON...'
              />
            </div>
          </div>
        </div>

        {/* Catalog and Controls Panels - Side by Side */}
        <div className='flex gap-4 flex-1'>
          {/* Controls Panel */}
          <div className='w-1/2 bg-white rounded-lg shadow-md p-4 flex flex-col'>
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
                disabled={
                  !state.can({
                    type: 'CONFIGURE',
                    dbInitParams: { config: {}, logLevel: LogLevel.DEBUG, progress: () => {} },
                    catalogConfig: {},
                  })
                }
                onClick={handleConfigure}
                className={getButtonClasses(
                  'configure',
                  !state.can({
                    type: 'CONFIGURE',
                    dbInitParams: { config: {}, logLevel: LogLevel.DEBUG, progress: () => {} },
                    catalogConfig: {},
                  })
                )}
              >
                Configure
              </button>
              <button
                disabled={!state.can({ type: 'CONNECT' })}
                onClick={handleConnect}
                className={getButtonClasses('connect', !state.can({ type: 'CONNECT' }))}
              >
                Connect
              </button>
              <button
                disabled={!state.can({ type: 'DISCONNECT' })}
                onClick={handleDisconnect}
                className={getButtonClasses('disconnect', !state.can({ type: 'DISCONNECT' }))}
              >
                Disconnect
              </button>
              <button
                disabled={!state.can({ type: 'RESET' })}
                onClick={handleReset}
                className={getButtonClasses('reset', !state.can({ type: 'RESET' }))}
              >
                Reset
              </button>
              <button
                disabled={
                  !state.can({
                    type: 'QUERY.EXECUTE',
                    queryParams: {
                      sql: query,
                      callback: () => {},
                      description: 'QUERY.EXECUTE',
                      resultType: 'json',
                    },
                  })
                }
                onClick={() => handleQueryAutoCommit()}
                className={getButtonClasses(
                  'query.execute',
                  !state.can({
                    type: 'QUERY.EXECUTE',
                    queryParams: {
                      sql: query,
                      callback: () => {},
                      description: 'QUERY.EXECUTE',
                      resultType: 'json',
                    },
                  })
                )}
              >
                Query (auto-commit)
              </button>
              <button
                disabled={!state.can({ type: 'TRANSACTION.BEGIN' })}
                onClick={handleTransactionBegin}
                className={getButtonClasses('transaction.begin', !state.can({ type: 'TRANSACTION.BEGIN' }))}
              >
                Begin Transaction
              </button>
              <button
                disabled={
                  !state.can({
                    type: 'TRANSACTION.EXECUTE',
                    queryParams: {
                      sql: query,
                      callback: () => {},
                      description: 'TRANSACTION.EXECUTE',
                      resultType: 'json',
                    },
                  })
                }
                onClick={handleTransactionExecute}
                className={getButtonClasses(
                  'transaction.execute',
                  !state.can({
                    type: 'TRANSACTION.EXECUTE',
                    queryParams: {
                      sql: query,
                      callback: () => {},
                      description: 'TRANSACTION.EXECUTE',
                      resultType: 'json',
                    },
                  })
                )}
              >
                Execute
              </button>
              <button
                disabled={!state.can({ type: 'TRANSACTION.COMMIT' })}
                onClick={handleTransactionCommit}
                className={getButtonClasses('transaction.commit', !state.can({ type: 'TRANSACTION.COMMIT' }))}
              >
                Commit
              </button>
              <button
                disabled={!state.can({ type: 'TRANSACTION.ROLLBACK' })}
                onClick={handleTransactionRollback}
                className={getButtonClasses('transaction.rollback', !state.can({ type: 'TRANSACTION.ROLLBACK' }))}
              >
                Rollback
              </button>
            </div>
          </div>

          {/* Catalog Panel */}
          <div className='w-1/2 bg-white rounded-lg shadow-md p-4 flex flex-col'>
            <h2 className='text-lg font-semibold mb-2'>Catalog & Table Management</h2>
            <div className='grid grid-cols-2 gap-4 mb-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Table Name</label>
                <input
                  type='text'
                  value={tableName}
                  onChange={e => setTableName(e.target.value)}
                  className='w-full p-2 border border-gray-300 rounded-md text-sm'
                  placeholder='Enter table name...'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Table Type</label>
                <select
                  value={tableType}
                  onChange={e => setTableType(e.target.value as 'b64ipc' | 'json')}
                  className='w-full p-2 border border-gray-300 rounded-md text-sm'
                >
                  <option value='b64ipc'>IPC (Base64)</option>
                  <option value='json'>JSON</option>
                </select>
              </div>
            </div>
            <div className='flex-1 flex flex-col min-h-0'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Payload</label>
              <textarea
                value={tablePayload}
                onChange={e => setTablePayload(e.target.value)}
                className='w-full flex-1 p-2 border border-gray-300 rounded-md text-sm resize-none'
                placeholder={tableType === 'json' ? 'Enter JSON payload...' : 'Enter base64 Arrow data...'}
              />
            </div>

            <div className='flex flex-wrap gap-2 mt-4'>
              <button
                disabled={!state.can({ type: 'CATALOG.LIST_DEFINITIONS', callback: () => {} })}
                onClick={handleShowConfiguration}
                className={getButtonClasses(
                  'catalog.list_definitions',
                  !state.can({ type: 'CATALOG.LIST_DEFINITIONS', callback: () => {} })
                )}
              >
                List Definitions
              </button>

              <button
                disabled={!state.can({ type: 'CATALOG.LIST_TABLES', callback: () => {} })}
                onClick={handleListTables}
                className={getButtonClasses(
                  'catalog.list_tables',
                  !state.can({ type: 'CATALOG.LIST_TABLES', callback: () => {} })
                )}
              >
                List Tables
              </button>
              <button
                disabled={
                  !state.can({
                    type: 'CATALOG.LOAD_TABLE',
                    tableName: '',
                    tablePayload: '',
                    payloadType: 'b64ipc',
                    payloadCompression: 'none',
                  })
                }
                onClick={handleLoadTable}
                className={getButtonClasses(
                  'catalog.load_table',
                  !state.can({
                    type: 'CATALOG.LOAD_TABLE',
                    tableName: '',
                    tablePayload: '',
                    payloadType: 'b64ipc',
                    payloadCompression: 'none',
                  })
                )}
              >
                Load Table
              </button>
              <button
                disabled={!state.can({ type: 'CATALOG.DROP_TABLE', tableName: '' })}
                onClick={handleDropTable}
                className={getButtonClasses(
                  'catalog.drop_table',
                  !state.can({ type: 'CATALOG.DROP_TABLE', tableName: '' })
                )}
              >
                Drop Table
              </button>
              <button
                disabled={!state.can({ type: 'CATALOG.SUBSCRIBE', tableSpecName: tableName, callback: () => {} })}
                onClick={handleSubscribe}
                className={getButtonClasses(
                  'catalog.subscribe',
                  !state.can({ type: 'CATALOG.SUBSCRIBE', tableSpecName: tableName, callback: () => {} })
                )}
              >
                Subscribe
              </button>
              <button
                disabled={!state.can({ type: 'CATALOG.UNSUBSCRIBE', tableSpecName: tableName, callback: () => {} })}
                onClick={handleUnsubscribe}
                className={getButtonClasses(
                  'catalog.unsubscribe',
                  !state.can({ type: 'CATALOG.UNSUBSCRIBE', tableSpecName: tableName, callback: () => {} })
                )}
              >
                Unsubscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidepanel - Machine State */}
      <div className='w-80 min-w-80 max-w-96 bg-white shadow-lg border-l border-gray-200 p-4 flex flex-col h-full'>
        <h2 className='text-lg font-semibold mb-4 flex-shrink-0'>Machine State</h2>

        {/* Progress Bar - Show only during initialization */}
        {state.matches('initializing') && initProgress && <ProgressBar progress={initProgress} />}

        <div className='space-y-4 flex-1 flex flex-col min-h-0'>
          <div className='flex-shrink-0'>
            <h4 className='font-medium text-gray-700 mb-1 flex-shrink-0'>Root / Catalog</h4>
            <div className='bg-blue-50 border border-blue-200 rounded-md p-3'>
              <code className='text-sm text-blue-800'>
                {safeStringify(state.value, 2)} / {safeStringify(dbCatalogState?.value, 2)}
              </code>
            </div>
          </div>

          <div className='flex-1 flex flex-col min-h-0'>
            <h4 className='font-medium text-gray-700 mb-2 flex-shrink-0'>Root State</h4>
            <div className='bg-gray-50 border border-gray-200 rounded-md p-3 flex-1 overflow-y-auto min-h-0'>
              <pre className='text-xs text-gray-700'>{safeStringify(state.context, 2)}</pre>
            </div>
          </div>

          <div className='flex-1 flex flex-col min-h-0'>
            <h4 className='font-medium text-gray-700 mb-2 flex-shrink-0'>Catalog State</h4>
            <div className='bg-gray-50 p-3 rounded-lg flex-1 overflow-y-auto min-h-0'>
              <pre className='text-xs text-gray-700 whitespace-pre-wrap'>{safeStringify(dbCatalogState, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
