import React, { useState } from 'react'
import { duckdbMachine, InitDuckDbParams, QueryDbParams, safeStringify } from 'xstate-duckdb'
import { useActor } from '@xstate/react'
import { DuckDBConfig, InstantiationProgress, LogLevel } from '@duckdb/duckdb-wasm'

// Simple cn helper function
const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ')
}

interface DisplayOutputResult {
  type:
    | 'query.execute'
    | 'transaction.begin'
    | 'transaction.execute'
    | 'transaction.commit'
    | 'transaction.rollback'
    | 'subscribe'
    | 'unsubscribe'
    | 'disconnect'
    | 'connect'
    | 'configure'
    | 'reset'
    | 'error'
    | 'clear'
  data?: any
  timestamp: Date
}

export const MachineExample = () => {
  const [state, send] = useActor(duckdbMachine)
  const [query, setQuery] = useState('SELECT * FROM duckdb_databases();')
  const [outputs, setOutputs] = useState<DisplayOutputResult[]>([])
  const [config, setConfig] = useState<DuckDBConfig>({
    query: {
      castBigIntToDouble: true,
      castDecimalToDouble: true,
    },
  })
  const [tablesConfig, setTablesConfig] = useState(`{
    "test_table": {
      "name": "test_table",
      "config": {
        "hasVersions": true,
        "maxVersions": 2
      }
    }
}`)

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
      case 'subscribe':
        return {
          base: 'bg-indigo-500',
          hover: 'hover:bg-indigo-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'unsubscribe':
        return {
          base: 'bg-gray-500',
          hover: 'hover:bg-gray-600',
          disabled: 'bg-gray-400 text-gray-200 cursor-not-allowed',
        }
      case 'error':
        return {
          base: 'bg-red-600',
          hover: 'hover:bg-red-700',
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
      const tablesObj = JSON.parse(tablesConfig)
      send({
        type: 'CONFIGURE',
        dbInitParams: configObj,
        tables: tablesObj,
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
    send({ type: 'SUBSCRIBE', tableName: 'example_table', callback: () => {} })
    addOutput('subscribe', 'Subscribe command sent')
  }

  const handleUnsubscribe = () => {
    send({ type: 'UNSUBSCRIBE', tableName: 'example_table', callback: () => {} })
    addOutput('unsubscribe', 'Unsubscribe command sent')
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
              disabled={
                !state.can({
                  type: 'CONFIGURE',
                  dbInitParams: { config: {}, logLevel: LogLevel.DEBUG, progress: () => {} },
                  tables: [],
                })
              }
              onClick={handleConfigure}
              className={getButtonClasses(
                'configure',
                !state.can({
                  type: 'CONFIGURE',
                  dbInitParams: { config: {}, logLevel: LogLevel.DEBUG, progress: () => {} },
                  tables: [],
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
                    resultType: 'arrow',
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
                    resultType: 'arrow',
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
                    resultType: 'arrow',
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
                    resultType: 'arrow',
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
            <button
              disabled={!state.can({ type: 'SUBSCRIBE', tableName: '', callback: () => {} })}
              onClick={handleSubscribe}
              className={getButtonClasses(
                'subscribe',
                !state.can({ type: 'SUBSCRIBE', tableName: '', callback: () => {} })
              )}
            >
              Subscribe
            </button>
            <button
              disabled={!state.can({ type: 'UNSUBSCRIBE', tableName: '', callback: () => {} })}
              onClick={handleUnsubscribe}
              className={getButtonClasses(
                'unsubscribe',
                !state.can({ type: 'UNSUBSCRIBE', tableName: '', callback: () => {} })
              )}
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
            <div className='bg-gray-50 border border-gray-200 rounded-md p-3 h-full overflow-y-auto'>
              <pre className='text-xs text-gray-700'>{JSON.stringify(state.context, null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
