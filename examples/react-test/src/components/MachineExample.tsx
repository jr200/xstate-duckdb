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
import { cn } from '../utils'

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
  const [tablePayload, setTablePayload] = useState('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')

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

  const getTypeStyles = (type: DisplayOutputResult['type']) => {
    switch (type) {
      case 'error':
        return {
          base: 'bg-red-500',
          hover: 'hover:bg-red-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'configure':
        return {
          base: 'bg-blue-500',
          hover: 'hover:bg-blue-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'connect':
        return {
          base: 'bg-green-500',
          hover: 'hover:bg-green-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'disconnect':
        return {
          base: 'bg-red-500',
          hover: 'hover:bg-red-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'reset':
        return {
          base: 'bg-yellow-500',
          hover: 'hover:bg-yellow-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'query.execute':
        return {
          base: 'bg-purple-500',
          hover: 'hover:bg-purple-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'transaction.begin':
        return {
          base: 'bg-teal-500',
          hover: 'hover:bg-teal-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'transaction.execute':
        return {
          base: 'bg-indigo-500',
          hover: 'hover:bg-indigo-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'transaction.commit':
        return {
          base: 'bg-emerald-500',
          hover: 'hover:bg-emerald-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'transaction.rollback':
        return {
          base: 'bg-rose-500',
          hover: 'hover:bg-rose-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'catalog.subscribe':
        return {
          base: 'bg-indigo-500',
          hover: 'hover:bg-indigo-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'catalog.unsubscribe':
        return {
          base: 'bg-purple-500',
          hover: 'hover:bg-purple-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'catalog.list_tables':
        return {
          base: 'bg-blue-500',
          hover: 'hover:bg-blue-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'catalog.load_table':
        return {
          base: 'bg-emerald-500',
          hover: 'hover:bg-emerald-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'catalog.drop_table':
        return {
          base: 'bg-red-600',
          hover: 'hover:bg-red-700',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'catalog.get_configuration':
        return {
          base: 'bg-cyan-500',
          hover: 'hover:bg-cyan-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'clear':
        return {
          base: 'bg-orange-500',
          hover: 'hover:bg-orange-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      default:
        return {
          base: 'bg-gray-500',
          hover: 'hover:bg-gray-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
    }
  }

  const getButtonClasses = (type: DisplayOutputResult['type'], disabled: boolean = false) => {
    const baseClasses = 'px-3 py-1.5 text-white rounded-md transition-colors text-sm'
    const styles = getTypeStyles(type)

    return cn(baseClasses, disabled ? styles.disabled : cn(styles.base, styles.hover))
  }

  const handleConfigure = () => {
    try {
      const configObj: InitDuckDbParams = {
        logLevel: LogLevel.DEBUG,
        progress: (progress: InstantiationProgress) => {
          console.log('db loading progress', progress)
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
    send({ type: 'CATALOG.SUBSCRIBE', tableName: 'example_table', callback: () => {} })
    addOutput('catalog.subscribe', 'Subscribe command sent')
  }

  const handleUnsubscribe = () => {
    send({ type: 'CATALOG.UNSUBSCRIBE', tableName: 'example_table', callback: () => {} })
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
      type: 'CATALOG.GET_CONFIGURATION',
      callback: (config: TableDefinition[]) => {
        addOutput('catalog.get_configuration', safeStringify(config, 2))
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
                  !state.can({ type: 'CATALOG.LOAD_TABLE', tableName: '', tablePayload: '', payloadType: 'b64ipc', payloadCompression: 'none' })
                }
                onClick={handleLoadTable}
                className={getButtonClasses(
                  'catalog.load_table',
                  !state.can({ type: 'CATALOG.LOAD_TABLE', tableName: '', tablePayload: '', payloadType: 'b64ipc', payloadCompression: 'none' })
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
                disabled={!state.can({ type: 'CATALOG.GET_CONFIGURATION', callback: () => {} })}
                onClick={handleShowConfiguration}
                className={getButtonClasses(
                  'catalog.get_configuration',
                  !state.can({ type: 'CATALOG.GET_CONFIGURATION', callback: () => {} })
                )}
              >
                Get Metadata
              </button>
              <button
                disabled={!state.can({ type: 'CATALOG.SUBSCRIBE', tableName: '', callback: () => {} })}
                onClick={handleSubscribe}
                className={getButtonClasses(
                  'catalog.subscribe',
                  !state.can({ type: 'CATALOG.SUBSCRIBE', tableName: '', callback: () => {} })
                )}
              >
                Subscribe
              </button>
              <button
                disabled={!state.can({ type: 'CATALOG.UNSUBSCRIBE', tableName: '', callback: () => {} })}
                onClick={handleUnsubscribe}
                className={getButtonClasses(
                  'catalog.unsubscribe',
                  !state.can({ type: 'CATALOG.UNSUBSCRIBE', tableName: '', callback: () => {} })
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
        <div className='space-y-4 flex-1 flex flex-col min-h-0'>
          <div className='flex-shrink-0'>
            <h3 className='font-medium text-gray-700 mb-2'>Current State</h3>
            <div className='bg-blue-50 border border-blue-200 rounded-md p-3'>
              <code className='text-sm text-blue-800'>
                {safeStringify(state.value, 2)} / {safeStringify(dbCatalogState?.value, 2)}
              </code>
            </div>
          </div>

          <div className='flex-1 flex flex-col min-h-0'>
            <h3 className='font-medium text-gray-700 mb-2 flex-shrink-0'>Context</h3>
            <div className='bg-gray-50 border border-gray-200 rounded-md p-3 flex-1 overflow-y-auto min-h-0'>
              <pre className='text-xs text-gray-700'>{safeStringify(state.context, 2)}</pre>
            </div>
          </div>

          <div className='flex-1 flex flex-col min-h-0'>
            <h4 className='text-md font-semibold text-gray-700 mb-2 flex-shrink-0'>Catalog State</h4>
            <div className='bg-gray-50 p-3 rounded-lg flex-1 overflow-y-auto min-h-0'>
              <pre className='text-xs text-gray-700 whitespace-pre-wrap'>{safeStringify(dbCatalogState, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
