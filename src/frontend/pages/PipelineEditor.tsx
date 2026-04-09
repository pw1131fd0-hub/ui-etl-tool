import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Database, Globe, FileText, FileJson, ArrowRight, ArrowLeft, CheckCircle, XCircle, Loader2, Plus, Trash2, ChevronRight, Save, Play, Clock, Filter, SortAsc, SortDesc, LayoutTemplate, Download } from 'lucide-react'
import { usePipelineStore } from '../store/pipelineStore'
import { testSource, testDestination, getPipeline, updatePipeline, triggerRun, createTemplate, exportPipelines } from '../api/pipeline'
import type { Pipeline } from '../store/pipelineStore'

type SourceType = 'api' | 'csv' | 'json'
type DbType = 'postgresql' | 'mysql' | 'csv'
type WriteMode = 'INSERT' | 'UPSERT'
type TransformType = 'string' | 'integer' | 'date' | 'trim' | 'lowercase' | 'uppercase' | 'concat'
type FilterOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'

interface FieldMapping {
  id: string
  sourceField: string
  destField: string
  transform: TransformType
  transformParams?: Record<string, string>
}

interface TransformConfig {
  mappings: FieldMapping[]
  filterField?: string
  filterOperator?: FilterOperator
  filterValue?: string
  sortField?: string
  sortDirection?: 'asc' | 'desc'
}

interface SourceConfig {
  type: SourceType
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string>
  responsePath?: string
  csvData?: string
  csvColumns?: string[]
  jsonData?: string
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
  csvPath?: string
  csvDelimiter?: string
}

const STEPS = [
  { key: 'Source', icon: Globe },
  { key: 'Transform', icon: FileText },
  { key: 'Destination', icon: Database },
] as const
type StepKey = typeof STEPS[number]['key']

export default function PipelineEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updatePipeline: updatePipelineStore } = usePipelineStore()
  const isNew = !id

  const [step, setStep] = useState<StepKey>('Source')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState('')
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>({ type: 'api', method: 'GET' })
  const [transformMappings, setTransformMappings] = useState<FieldMapping[]>([])
  const [destConfig, setDestConfig] = useState<DestinationConfig>({
    type: 'postgresql', host: '127.0.0.1', port: 5432, database: 'etl_db',
    username: 'etl', password: 'etl_pass', table: '', writeMode: 'INSERT',
  })
  const [previewData, setPreviewData] = useState<string[][]>([])
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [transformPreviewData, setTransformPreviewData] = useState<string[][]>([])
  const [transformPreviewHeaders, setTransformPreviewHeaders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)

  // Transform config
  const [filterField, setFilterField] = useState('')
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('eq')
  const [filterValue, setFilterValue] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const stepIndex = STEPS.findIndex(s => s.key === step)

  useEffect(() => {
    if (!isNew && id) {
      getPipeline(id).then((data) => {
        setPipeline(data)
        setName(data.name)
        setDescription(data.description ?? '')
        setSchedule(data.schedule ?? '')
        const src = data.sourceConfig as SourceConfig
        setSourceConfig(src)
        if (src.csvColumns) setSourceFields(src.csvColumns)
        const dst = data.destinationConfig as DestinationConfig
        if (dst.type) setDestConfig((prev) => ({ ...prev, ...dst }))
        const tcfg = data.transformConfig as TransformConfig
        if (tcfg.mappings) setTransformMappings(tcfg.mappings)
        if (tcfg.filterField) setFilterField(tcfg.filterField)
        if (tcfg.filterOperator) setFilterOperator(tcfg.filterOperator)
        if (tcfg.filterValue) setFilterValue(tcfg.filterValue)
        if (tcfg.sortField) setSortField(tcfg.sortField)
        if (tcfg.sortDirection) setSortDirection(tcfg.sortDirection)
      }).catch(console.error)
    }
  }, [isNew, id])

  const handleFetchPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await testSource(sourceConfig)
      setPreviewData(result.rows)
      setSourceFields(result.fields)
      setSourceConfig((prev) => ({ ...prev, csvColumns: result.fields }))
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to fetch')
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

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      try {
        const data = JSON.parse(text)
        let rows: Record<string, unknown>[] = Array.isArray(data) ? data : [data]
        const fields = rows.length > 0 ? Object.keys(rows[0]) : []
        setSourceConfig((prev) => ({ ...prev, jsonData: text, csvColumns: fields }))
        setSourceFields(fields)
        setPreviewData(rows.slice(0, 5).map((r) => fields.map((f) => String(r[f] ?? ''))))
      } catch {
        setError('Invalid JSON file')
      }
    }
    reader.readAsText(file)
  }

  const addMapping = (sourceField: string) => {
    setTransformMappings((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), sourceField, destField: sourceField, transform: 'string' }
    ])
  }

  const removeMapping = (id: string) => setTransformMappings((prev) => prev.filter(m => m.id !== id))
  const updateMapping = (id: string, field: Partial<FieldMapping>) =>
    setTransformMappings((prev) => prev.map(m => m.id === id ? { ...m, ...field } : m))

  const applyTransform = (rows: string[][], fields: string[], mappings: FieldMapping[], filter?: { field: string; op: FilterOperator; value: string }, sort?: { field: string; dir: 'asc' | 'desc' }): { rows: string[][]; headers: string[] } => {
    if (!rows.length || !mappings.length) return { rows: [], headers: [] }

    // Build object rows for easier processing
    const objRows = rows.map(row => {
      const obj: Record<string, string> = {}
      fields.forEach((f, i) => { obj[f] = row[i] ?? '' })
      return obj
    })

    // Apply filter
    let filtered = objRows
    if (filter && filter.field) {
      filtered = objRows.filter(row => {
        const val = row[filter.field] ?? ''
        switch (filter.op) {
          case 'eq': return val === filter.value
          case 'neq': return val !== filter.value
          case 'contains': return val.includes(filter.value)
          case 'gt': return !isNaN(+val) && +val > +filter.value
          case 'lt': return !isNaN(+val) && +val < +filter.value
          case 'gte': return !isNaN(+val) && +val >= +filter.value
          case 'lte': return !isNaN(+val) && +val <= +filter.value
          default: return true
        }
      })
    }

    // Apply sort
    if (sort && sort.field) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sort.field] ?? ''
        const bVal = b[sort.field] ?? ''
        const cmp = isNaN(+aVal) || isNaN(+bVal) ? aVal.localeCompare(bVal) : +aVal - +bVal
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }

    // Apply mappings
    const destHeaders = mappings.map(m => m.destField)
    const result = filtered.map(row => {
      return mappings.map(m => {
        let val: string = row[m.sourceField] ?? ''
        switch (m.transform) {
          case 'trim': val = val.trim(); break
          case 'lowercase': val = val.toLowerCase(); break
          case 'uppercase': val = val.toUpperCase(); break
          case 'integer': val = String(Math.floor(+val) || 0); break
          case 'date': val = val; break
          case 'concat': {
            const params = m.transformParams as Record<string, string> | undefined
            val = (params?.prefix ?? '') + val + (params?.suffix ?? '')
            break
          }
          default: break
        }
        return val
      })
    })

    return { rows: result, headers: destHeaders }
  }

  const handlePreviewTransform = () => {
    const filter = filterField ? { field: filterField, op: filterOperator, value: filterValue } : undefined
    const sort = sortField ? { field: sortField, dir: sortDirection } : undefined
    const result = applyTransform(previewData, sourceFields, transformMappings, filter, sort)
    setTransformPreviewData(result.rows)
    setTransformPreviewHeaders(result.headers)
  }

  const handleTestConnection = async () => {
    setLoading(true)
    setTestStatus(null)
    try {
      await testDestination(destConfig)
      setTestStatus({ ok: true, msg: 'Connection successful!' })
    } catch (err: unknown) {
      setTestStatus({ ok: false, msg: (err as { message?: string })?.message ?? 'Connection failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      const transformConfig: TransformConfig = {
        mappings: transformMappings,
        filterField: filterField || undefined,
        filterOperator: filterField ? filterOperator : undefined,
        filterValue: filterField ? filterValue : undefined,
        sortField: sortField || undefined,
        sortDirection: sortField ? sortDirection : undefined,
      }
      const payload = { name, description, schedule: schedule || null, sourceConfig, transformConfig, destinationConfig: destConfig }
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
      setTestStatus({ ok: true, msg: 'Pipeline saved!' })
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleRun = async () => {
    // Client-side validation for Destination step
    if (step === 'Destination') {
      const missing: string[] = []
      if (destConfig.type !== 'csv') {
        if (!destConfig.host) missing.push('Host')
        if (!destConfig.database) missing.push('Database')
        if (!destConfig.username) missing.push('Username')
        if (!destConfig.table) missing.push('Table')
      }
      if (missing.length > 0) {
        setError(`Please fill in: ${missing.join(', ')}`)
        return
      }
    }
    if (!pipeline?.id) {
      await handleSave()
      return
    }
    setLoading(true)
    setError(null)
    try {
      await triggerRun(pipeline.id)
      setTestStatus({ ok: true, msg: 'Run triggered!' })
      navigate('/')
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to trigger run')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!pipeline?.id) return
    const templateName = prompt('Enter template name:', pipeline.name)
    if (!templateName) return
    setLoading(true)
    try {
      await createTemplate({
        name: templateName,
        description: pipeline.description ?? undefined,
        sourceConfig: pipeline.sourceConfig as Record<string, unknown>,
        transformConfig: pipeline.transformConfig as Record<string, unknown>,
        destinationConfig: pipeline.destinationConfig as Record<string, unknown>,
      })
      setTestStatus({ ok: true, msg: 'Template saved!' })
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!pipeline?.id) return
    try {
      const data = await exportPipelines([pipeline.id])
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pipeline.name.replace(/\s+/g, '_')}_export.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to export')
    }
  }

  const stepNum = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
              ← Back
            </button>
            <input
              className="flex-1 text-xl font-bold bg-transparent border-b border-slate-700 focus:border-indigo-500 outline-none py-1 text-white placeholder-slate-600"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pipeline Name"
            />
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="text-slate-500" />
              <input
                className="w-36 bg-transparent border-b border-slate-700 focus:border-indigo-500 outline-none py-1 text-slate-300 placeholder-slate-600 text-sm"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="*/5 * * * *"
                title="Cron schedule format&#10;*/5 * * * * = every 5 minutes&#10;0 0 * * * = daily at midnight&#10;0 * * * * = every hour"
              />
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <div key={key} className="flex items-center gap-2">
                <button
                  onClick={() => setStep(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    step === key
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                      : i < stepNum
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  {i < stepNum ? <CheckCircle size={16} /> : <Icon size={16} />}
                  {key}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 rounded ${i < stepNum ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <XCircle size={16} />
            {error}
          </div>
        )}

        {/* SOURCE STEP */}
        {step === 'Source' && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Source Configuration</h2>
              <p className="text-slate-400 text-sm mb-6">Choose where your data comes from</p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {(['api', 'csv', 'json'] as SourceType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setSourceConfig((p) => ({ ...p, type })); setPreviewData([]); setSourceFields([]) }}
                    className={`p-5 rounded-xl border text-left transition-all ${
                      sourceConfig.type === type
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {type === 'api' ? <Globe size={20} className="text-indigo-400" /> :
                       type === 'csv' ? <FileText size={20} className="text-purple-400" /> :
                       <FileJson size={20} className="text-amber-400" />}
                      <span className="font-medium text-white">
                        {type === 'api' ? 'REST API' : type === 'csv' ? 'CSV File' : 'JSON'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {type === 'api' ? 'Fetch data from any HTTP endpoint' :
                       type === 'csv' ? 'Upload a CSV file directly' :
                       'Parse JSON array or object'}
                    </p>
                  </button>
                ))}
              </div>

              {sourceConfig.type === 'api' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">URL</label>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="https://api.example.com/data"
                        value={sourceConfig.url ?? ''}
                        onChange={(e) => setSourceConfig((p) => ({ ...p, url: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Method</label>
                      <select
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={sourceConfig.method ?? 'GET'}
                        onChange={(e) => setSourceConfig((p) => ({ ...p, method: e.target.value }))}
                      >
                        <option>GET</option><option>POST</option><option>PUT</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Response JSON Path</label>
                    <input
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                      placeholder="data.items[*]"
                      value={sourceConfig.responsePath ?? ''}
                      onChange={(e) => setSourceConfig((p) => ({ ...p, responsePath: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {sourceConfig.type === 'csv' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Upload CSV File</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="block w-full text-sm text-slate-400 file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:text-indigo-400 file:font-medium file:cursor-pointer hover:file:bg-indigo-500/30 transition-all"
                  />
                </div>
              )}

              {sourceConfig.type === 'json' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Upload JSON File</label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleJsonUpload}
                      className="block w-full text-sm text-slate-400 file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:text-indigo-400 file:font-medium file:cursor-pointer hover:file:bg-indigo-500/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Or paste JSON data</label>
                    <textarea
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono h-32"
                      placeholder='[{"name": "John", "age": 30}]'
                      value={sourceConfig.jsonData ?? ''}
                      onChange={(e) => setSourceConfig((p) => ({ ...p, jsonData: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleFetchPreview}
                disabled={loading || (sourceConfig.type === 'api' && !sourceConfig.url) || (sourceConfig.type === 'csv' && !sourceConfig.csvData)}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-all"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Fetching...</> : 'Fetch Preview'}
              </button>
            </div>

            {previewData.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Preview ({previewData.length} rows)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/30">
                        {sourceFields.map((f) => (
                          <th key={f} className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-t border-slate-700/30 hover:bg-slate-700/20">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 text-slate-300 whitespace-nowrap max-w-xs truncate">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRANSFORM STEP */}
        {step === 'Transform' && (
          <div className="space-y-6">
            {/* Filter & Sort */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={16} className="text-amber-400" />
                  <h3 className="text-sm font-medium text-slate-300">Filter Rows</h3>
                </div>
                <div className="space-y-3">
                  <select
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={filterField}
                    onChange={(e) => setFilterField(e.target.value)}
                  >
                    <option value="">No filter</option>
                    {sourceFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {filterField && (
                    <div className="flex gap-2">
                      <select
                        className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filterOperator}
                        onChange={(e) => setFilterOperator(e.target.value as FilterOperator)}
                      >
                        <option value="eq">equals</option>
                        <option value="neq">not equals</option>
                        <option value="contains">contains</option>
                        <option value="gt">greater than</option>
                        <option value="lt">less than</option>
                        <option value="gte">≥</option>
                        <option value="lte">≤</option>
                      </select>
                      <input
                        className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        placeholder="Filter value"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  {sortDirection === 'asc' ? <SortAsc size={16} className="text-emerald-400" /> : <SortDesc size={16} className="text-emerald-400" />}
                  <h3 className="text-sm font-medium text-slate-300">Sort Output</h3>
                </div>
                <div className="space-y-3">
                  <select
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value)}
                  >
                    <option value="">No sort</option>
                    {sourceFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {sortField && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSortDirection('asc')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                          sortDirection === 'asc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/50 text-slate-400 border border-slate-700'
                        }`}
                      >
                        Ascending
                      </button>
                      <button
                        onClick={() => setSortDirection('desc')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                          sortDirection === 'desc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/50 text-slate-400 border border-slate-700'
                        }`}
                      >
                        Descending
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Field Mappings */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-slate-300 mb-4">Source Fields</h3>
                <div className="space-y-2">
                  {sourceFields.map((field) => {
                    const isMapped = transformMappings.some(m => m.sourceField === field)
                    return (
                      <div key={field} className="flex items-center justify-between px-4 py-3 bg-slate-900/40 rounded-xl">
                        <span className="text-sm text-slate-300 font-mono">{field}</span>
                        {!isMapped ? (
                          <button
                            onClick={() => addMapping(field)}
                            className="text-xs px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors"
                          >
                            + Map
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400">✓ Mapped</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-slate-300 mb-4">Field Mappings</h3>
                {transformMappings.length === 0 && (
                  <p className="text-sm text-slate-600 py-8 text-center">Click "Map" on source fields</p>
                )}
                <div className="space-y-3">
                  {transformMappings.map((m) => (
                    <div key={m.id} className="p-4 bg-slate-900/40 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-mono">{m.sourceField}</span>
                        <button onClick={() => removeMapping(m.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-slate-600" />
                        <input
                          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={m.destField}
                          onChange={(e) => updateMapping(m.id, { destField: e.target.value })}
                        />
                      </div>
                      <select
                        value={m.transform}
                        onChange={(e) => updateMapping(m.id, { transform: e.target.value as TransformType })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="string">String</option>
                        <option value="integer">Integer</option>
                        <option value="date">Date</option>
                        <option value="trim">Trim</option>
                        <option value="lowercase">Lowercase</option>
                        <option value="uppercase">Uppercase</option>
                        <option value="concat">Concat (prefix+suffix)</option>
                      </select>
                      {m.transform === 'concat' && (
                        <div className="flex gap-2">
                          <input
                            className="w-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="prefix"
                            value={(m.transformParams as Record<string, string>)?.prefix ?? ''}
                            onChange={(e) => updateMapping(m.id, { transformParams: { ...m.transformParams, prefix: e.target.value } })}
                          />
                          <input
                            className="w-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="suffix"
                            value={(m.transformParams as Record<string, string>)?.suffix ?? ''}
                            onChange={(e) => updateMapping(m.id, { transformParams: { ...m.transformParams, suffix: e.target.value } })}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview Transform Button */}
            {previewData.length > 0 && transformMappings.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreviewTransform}
                  title="Apply filter, sort, and field mappings to the source data and preview the transformed output"
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25"
                >
                  <CheckCircle size={16} />
                  Preview Transform Output
                </button>
                <span className="text-xs text-slate-500">Shows transformed data after filter, sort & field mappings</span>
              </div>
            )}

            {/* Transform Output Preview */}
            {transformPreviewData.length > 0 && (
              <div className="bg-slate-800/60 border border-emerald-500/30 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-emerald-400 mb-3">Transform Output Preview ({transformPreviewData.length} rows)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-emerald-500/10">
                        {transformPreviewHeaders.map((f) => (
                          <th key={f} className="px-4 py-2.5 text-left font-medium text-emerald-300 whitespace-nowrap">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transformPreviewData.map((row, i) => (
                        <tr key={i} className="border-t border-slate-700/30 hover:bg-slate-700/20">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 text-slate-300 whitespace-nowrap max-w-xs truncate">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DESTINATION STEP */}
        {step === 'Destination' && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Destination Configuration</h2>
              <p className="text-slate-400 text-sm mb-6">Configure your data destination</p>

              <div className="flex gap-3 mb-6">
                {(['postgresql', 'mysql', 'csv'] as DbType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDestConfig((p) => ({ ...p, type, port: type === 'postgresql' ? 5432 : type === 'mysql' ? 3306 : 0 }))}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      destConfig.type === type
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {type === 'postgresql' ? 'PostgreSQL' : type === 'mysql' ? 'MySQL' : 'CSV File'}
                  </button>
                ))}
              </div>

              {destConfig.type === 'csv' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Output CSV Path</label>
                    <input
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                      placeholder="./output.csv"
                      value={destConfig.csvPath ?? ''}
                      onChange={(e) => setDestConfig((p) => ({ ...p, csvPath: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Delimiter</label>
                    <select
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={destConfig.csvDelimiter ?? ','}
                      onChange={(e) => setDestConfig((p) => ({ ...p, csvDelimiter: e.target.value }))}
                    >
                      <option value=",">Comma (,)</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="\t">Tab</option>
                      <option value="|">Pipe (|)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Host</label>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.host}
                        onChange={(e) => setDestConfig((p) => ({ ...p, host: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Port</label>
                      <input
                        type="number"
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.port}
                        onChange={(e) => setDestConfig((p) => ({ ...p, port: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Database</label>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.database}
                        onChange={(e) => setDestConfig((p) => ({ ...p, database: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.username}
                        onChange={(e) => setDestConfig((p) => ({ ...p, username: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.password}
                        onChange={(e) => setDestConfig((p) => ({ ...p, password: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Table</label>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                        value={destConfig.table}
                        onChange={(e) => setDestConfig((p) => ({ ...p, table: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Write Mode</label>
                      <select
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.writeMode}
                        onChange={(e) => setDestConfig((p) => ({ ...p, writeMode: e.target.value as WriteMode }))}
                        title="INSERT: adds new rows only&#10;UPSERT: inserts new rows or updates existing rows on conflict"
                      >
                        <option value="INSERT">INSERT</option>
                        <option value="UPSERT">UPSERT (INSERT OR REPLACE)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleTestConnection}
                    disabled={loading || !destConfig.host || !destConfig.database}
                    className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Testing...</> : 'Test Connection'}
                  </button>
                </div>
              )}

              {testStatus && (
                <div className={`mt-4 p-4 rounded-xl text-sm flex items-center gap-2 ${
                  testStatus.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {testStatus.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  {testStatus.msg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(step === 'Transform' ? 'Source' : 'Transform')}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-600 transition-all"
          >
            <ArrowLeft size={16} />
            {step === 'Transform' ? 'Source' : 'Transform'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={loading || !name}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-600 disabled:opacity-50 transition-all"
            >
              <Save size={16} />
              Save
            </button>
            {pipeline?.id && (
              <button
                onClick={handleSaveAsTemplate}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-500/20 text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
              >
                <LayoutTemplate size={16} />
                Save as Template
              </button>
            )}
            {pipeline?.id && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-600 transition-all"
              >
                <Download size={16} />
                Export
              </button>
            )}
            {step === 'Destination' && (
              <button
                onClick={handleRun}
                disabled={loading || (!isNew && !pipeline?.id)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/25"
              >
                <Play size={16} />
                Run Pipeline
              </button>
            )}
            {step !== 'Destination' && (
              <button
                onClick={() => setStep(step === 'Source' ? 'Transform' : 'Destination')}
                disabled={!sourceFields.length}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/25"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
