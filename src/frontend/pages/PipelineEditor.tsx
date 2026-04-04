import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePipelineStore } from '../store/pipelineStore'
import { testSource, testDestination, getPipeline, updatePipeline, triggerRun } from '../api/pipeline'
import type { Pipeline } from '../store/pipelineStore'

type SourceType = 'api' | 'csv'
type DbType = 'postgresql' | 'mysql'
type WriteMode = 'INSERT' | 'UPSERT'
type TransformType = 'string' | 'integer' | 'date' | 'trim' | 'lowercase'

interface FieldMapping {
  id: string
  sourceField: string
  destField: string
  transform: TransformType
}

interface SourceConfig {
  type: SourceType
  // API
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string>
  responsePath?: string
  // CSV
  csvData?: string
  csvColumns?: string[]
}

interface DestinationConfig {
  type: DbType
  host: string
  port: number
  database: string
  username: string
  password: string
  table: string
  writeMode: WriteMode
}

const STEPS = ['Source', 'Transform', 'Destination'] as const
type Step = typeof STEPS[number]

export default function PipelineEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updatePipeline: updatePipelineStore } = usePipelineStore()
  const isNew = !id

  // State
  const [step, setStep] = useState<Step>('Source')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>({ type: 'api' })
  const [transformMappings, setTransformMappings] = useState<FieldMapping[]>([])
  const [destConfig, setDestConfig] = useState<DestinationConfig>({
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    table: '',
    writeMode: 'INSERT',
  })
  const [previewData, setPreviewData] = useState<string[][]>([])
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)

  // Load existing pipeline
  useEffect(() => {
    if (!isNew && id) {
      getPipeline(id).then((data) => {
        setPipeline(data)
        setName(data.name)
        setDescription(data.description ?? '')
        const src = data.sourceConfig as SourceConfig
        setSourceConfig(src)
        if (src.csvColumns) setSourceFields(src.csvColumns)
        const dst = data.destinationConfig as DestinationConfig
        if (dst.type) setDestConfig((prev) => ({ ...prev, ...dst }))
        const tcfg = data.transformConfig as { mappings?: FieldMapping[] }
        if (tcfg.mappings) setTransformMappings(tcfg.mappings)
      }).catch(console.error)
    }
  }, [isNew, id])

  // --- Source Handlers ---
  const handleSourceTypeChange = (type: SourceType) => {
    setSourceConfig((prev) => ({ ...prev, type }))
    setPreviewData([])
    setSourceFields([])
  }

  const handleFetchPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await testSource(sourceConfig)
      setPreviewData(result.rows)
      setSourceFields(result.fields)
      setSourceConfig((prev) => ({ ...prev, csvColumns: result.fields }))
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to fetch preview')
    } finally {
      setLoading(false)
    }
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) return
      const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1, 6).map((line) =>
        line.split(',').map((v) => v.trim().replace(/"/g, ''))
      )
      setSourceConfig((prev) => ({ ...prev, csvData: text, csvColumns: headers }))
      setSourceFields(headers)
      setPreviewData(rows)
    }
    reader.readAsText(file)
  }

  // --- Transform Handlers ---
  const addMapping = (sourceField: string) => {
    const mapping: FieldMapping = {
      id: Math.random().toString(36).slice(2),
      sourceField,
      destField: sourceField,
      transform: 'string',
    }
    setTransformMappings((prev) => [...prev, mapping])
  }

  const removeMapping = (mappingId: string) => {
    setTransformMappings((prev) => prev.filter((m) => m.id !== mappingId))
  }

  const updateMapping = (mappingId: string, field: Partial<FieldMapping>) => {
    setTransformMappings((prev) =>
      prev.map((m) => (m.id === mappingId ? { ...m, ...field } : m))
    )
  }

  // --- Destination Handlers ---
  const handleTestConnection = async () => {
    setLoading(true)
    setTestStatus(null)
    try {
      await testDestination(destConfig)
      setTestStatus('✅ Connection successful!')
    } catch (err: unknown) {
      setTestStatus(`❌ ${(err as { message?: string })?.message ?? 'Connection failed'}`)
    } finally {
      setLoading(false)
    }
  }

  // --- Save & Run ---
  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      const transformConfig = { mappings: transformMappings }
      const payload = {
        name,
        description,
        sourceConfig,
        transformConfig,
        destinationConfig: destConfig,
      }
      let saved: Pipeline
      if (isNew) {
        const { createPipeline } = usePipelineStore.getState()
        saved = await createPipeline(payload)
      } else {
        await updatePipeline(id!, payload)
        saved = (await getPipeline(id!)) as Pipeline
      }
      updatePipelineStore(saved.id, saved)
      setPipeline(saved)
      setTestStatus('✅ Pipeline saved!')
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!pipeline?.id) {
        await handleSave()
        return
      }
      await triggerRun(pipeline.id)
      setTestStatus('🚀 Run triggered! Check the Runs tab.')
      navigate('/')
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to trigger run')
    } finally {
      setLoading(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <input
            className="text-xl font-bold bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pipeline Name"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Step Tabs */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : i < stepIndex
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {i < stepIndex ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Source Tab */}
        {step === 'Source' && (
          <div className="space-y-6 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold">Source Configuration</h2>

            {/* Source Type Selector */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sourceConfig.type === 'api'}
                  onChange={() => handleSourceTypeChange('api')}
                />
                REST API
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sourceConfig.type === 'csv'}
                  onChange={() => handleSourceTypeChange('csv')}
                />
                CSV File
              </label>
            </div>

            {/* API Config */}
            {sourceConfig.type === 'api' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <input
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://api.example.com/data"
                    value={sourceConfig.url ?? ''}
                    onChange={(e) => setSourceConfig((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={sourceConfig.method ?? 'GET'}
                    onChange={(e) => setSourceConfig((p) => ({ ...p, method: e.target.value }))}
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    rows={2}
                    placeholder='{"Authorization": "Bearer token"}'
                    value={JSON.stringify(sourceConfig.headers ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        setSourceConfig((p) => ({ ...p, headers: JSON.parse(e.target.value) }))
                      } catch {}
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Query Params (JSON)</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    rows={2}
                    placeholder='{"page": "1"}'
                    value={JSON.stringify(sourceConfig.params ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        setSourceConfig((p) => ({ ...p, params: JSON.parse(e.target.value) }))
                      } catch {}
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Response JSON Path</label>
                  <input
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="data.items[*]"
                    value={sourceConfig.responsePath ?? ''}
                    onChange={(e) => setSourceConfig((p) => ({ ...p, responsePath: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <button
                    onClick={handleFetchPreview}
                    disabled={loading || !sourceConfig.url}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Fetching...' : 'Fetch Preview (5 rows)'}
                  </button>
                </div>
              </div>
            )}

            {/* CSV Config */}
            {sourceConfig.type === 'csv' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
                  />
                </div>
                <button
                  onClick={handleFetchPreview}
                  disabled={loading || !sourceConfig.csvData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Parsing...' : 'Parse CSV Preview'}
                </button>
              </div>
            )}

            {/* Preview Table */}
            {previewData.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Preview ({previewData.length} rows)</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {sourceFields.map((f) => (
                          <th key={f} className="px-3 py-2 text-left font-medium text-gray-600">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-t">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-gray-800">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setStep('Transform')}
                disabled={!sourceFields.length}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Transform →
              </button>
            </div>
          </div>
        )}

        {/* Transform Tab */}
        {step === 'Transform' && (
          <div className="space-y-6 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold">Field Mappings</h2>

            <div className="grid grid-cols-2 gap-8">
              {/* Source Fields */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Source Fields</h3>
                <div className="space-y-2">
                  {sourceFields.map((field) => {
                    const isMapped = transformMappings.some((m) => m.sourceField === field)
                    return (
                      <div key={field} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{field}</span>
                        {!isMapped && (
                          <button
                            onClick={() => addMapping(field)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            + Map
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mappings */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Active Mappings</h3>
                {transformMappings.length === 0 && (
                  <p className="text-sm text-gray-400">Click "Map" on source fields to create mappings</p>
                )}
                <div className="space-y-3">
                  {transformMappings.map((mapping) => (
                    <div key={mapping.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Source → Dest</span>
                        <button
                          onClick={() => removeMapping(mapping.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 px-2 py-1 border rounded text-sm"
                          value={mapping.sourceField}
                          disabled
                        />
                        <span className="text-gray-400">→</span>
                        <input
                          className="flex-1 px-2 py-1 border rounded text-sm"
                          value={mapping.destField}
                          onChange={(e) => updateMapping(mapping.id, { destField: e.target.value })}
                          placeholder="destination field"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Transform</label>
                        <select
                          className="w-full mt-1 px-2 py-1 border rounded text-sm"
                          value={mapping.transform}
                          onChange={(e) => updateMapping(mapping.id, { transform: e.target.value as TransformType })}
                        >
                          <option value="string">String</option>
                          <option value="integer">Integer</option>
                          <option value="date">Date</option>
                          <option value="trim">Trim</option>
                          <option value="lowercase">Lowercase</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('Source')}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('Destination')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Destination →
              </button>
            </div>
          </div>
        )}

        {/* Destination Tab */}
        {step === 'Destination' && (
          <div className="space-y-6 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold">Destination Configuration</h2>

            {/* DB Type Selector */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={destConfig.type === 'postgresql'}
                  onChange={() => setDestConfig((p) => ({ ...p, type: 'postgresql', port: 5432 }))}
                />
                PostgreSQL
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={destConfig.type === 'mysql'}
                  onChange={() => setDestConfig((p) => ({ ...p, type: 'mysql', port: 3306 }))}
                />
                MySQL
              </label>
            </div>

            {/* Connection Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="localhost"
                  value={destConfig.host}
                  onChange={(e) => setDestConfig((p) => ({ ...p, host: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={destConfig.port}
                  onChange={(e) => setDestConfig((p) => ({ ...p, port: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Database</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="mydb"
                  value={destConfig.database}
                  onChange={(e) => setDestConfig((p) => ({ ...p, database: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="user"
                  value={destConfig.username}
                  onChange={(e) => setDestConfig((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                  value={destConfig.password}
                  onChange={(e) => setDestConfig((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="target_table"
                  value={destConfig.table}
                  onChange={(e) => setDestConfig((p) => ({ ...p, table: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Write Mode</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={destConfig.writeMode}
                  onChange={(e) => setDestConfig((p) => ({ ...p, writeMode: e.target.value as WriteMode }))}
                >
                  <option value="INSERT">INSERT</option>
                  <option value="UPSERT">UPSERT (INSERT OR REPLACE)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={loading || !destConfig.host || !destConfig.database}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>

            {testStatus && (
              <div className={`p-3 rounded-lg text-sm ${testStatus.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {testStatus}
              </div>
            )}

            {/* Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Pipeline Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Source:</span>
                  <p className="font-medium">{sourceConfig.type === 'api' ? `API: ${sourceConfig.url}` : 'CSV Upload'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Transforms:</span>
                  <p className="font-medium">{transformMappings.length} mappings</p>
                </div>
                <div>
                  <span className="text-gray-500">Destination:</span>
                  <p className="font-medium">{destConfig.type} → {destConfig.table}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('Transform')}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading || !name}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Pipeline'}
                </button>
                <button
                  onClick={handleRun}
                  disabled={loading || !pipeline?.id}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Running...' : '🚀 Run Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
