import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Database, Globe, FileText, FileJson, ArrowRight, ArrowLeft, CheckCircle, XCircle, Loader2, Plus, Trash2, ChevronRight, Save, Play, Clock, Filter, SortAsc, SortDesc, LayoutTemplate, Download, HelpCircle } from 'lucide-react'
import { usePipelineStore } from '../store/pipelineStore'
import { testSource, testDestination, getPipeline, updatePipeline, triggerRun, createTemplate, exportPipelines } from '../api/pipeline'
import type { Pipeline } from '../store/pipelineStore'
import { applyTransform } from '../utils/transformUtils'
import type { FieldMapping, TransformType, FilterOperator } from '../utils/transformUtils'
import { Tooltip, InlineHint } from '../components/ui/Tooltip'

type SourceType = 'api' | 'csv' | 'json'
type DbType = 'postgresql' | 'mysql' | 'csv'
type WriteMode = 'INSERT' | 'UPSERT'

interface TransformConfig {
  mappings: FieldMapping[]
  filterField?: string
  filterOperator?: FilterOperator
  filterValue?: string
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  flattenNested?: boolean
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)

  // Transform config
  const [filterField, setFilterField] = useState('')
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('eq')
  const [filterValue, setFilterValue] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [flattenNested, setFlattenNested] = useState(false)

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
        if (tcfg.flattenNested) setFlattenNested(tcfg.flattenNested)
      }).catch(console.error)
    }
  }, [isNew, id])

  // Auto-save: debounced auto-save after changes (only for existing pipelines)
  useEffect(() => {
    if (!pipeline?.id || isNew) return
    setAutoSaveStatus('idle')
    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        const transformConfig: TransformConfig = {
          mappings: transformMappings,
          filterField: filterField || undefined,
          filterOperator: filterField ? filterOperator : undefined,
          filterValue: filterField ? filterValue : undefined,
          sortField: sortField || undefined,
          sortDirection: sortField ? sortDirection : undefined,
          flattenNested: flattenNested || undefined,
        }
        const payload = { name, description, schedule: schedule || null, sourceConfig, transformConfig, destinationConfig: destConfig }
        await updatePipeline(pipeline.id, payload)
        setAutoSaveStatus('saved')
        setLastAutoSave(new Date())
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      } catch {
        setAutoSaveStatus('error')
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [name, description, schedule, sourceConfig, destConfig, transformMappings, filterField, filterOperator, filterValue, sortField, sortDirection])

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

  const handlePreviewTransform = () => {
    const filter = filterField ? { field: filterField, op: filterOperator, value: filterValue } : undefined
    const sort = sortField ? { field: sortField, dir: sortDirection } : undefined
    const result = applyTransform({ rows: previewData, fields: sourceFields, mappings: transformMappings, filter, sort, flattenNested })
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
        flattenNested: flattenNested || undefined,
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
              />
              <Tooltip
                icon="help"
                content={
                  <div className="space-y-1">
                    <div className="font-medium text-white">Cron Schedule Format</div>
                    <div><span className="text-slate-400">*/5 * * * *</span> — every 5 minutes</div>
                    <div><span className="text-slate-400">0 * * * *</span> — every hour</div>
                    <div><span className="text-slate-400">0 0 * * *</span> — daily at midnight</div>
                    <div><span className="text-slate-400">0 9 * * 1-5</span> — 9am weekdays</div>
                  </div>
                }
                position="bottom"
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

          {/* Pipeline Flow Diagram */}
          <div className="mt-4">
            <p className="text-xs text-slate-600 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Pipeline Flow — live preview as you configure
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Source Node */}
              <div className={`flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border rounded-xl transition-all ${
                sourceFields.length > 0 ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'border-slate-700/50'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${sourceFields.length > 0 ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' : 'bg-slate-600'}`} />
                <Globe size={14} className={sourceConfig.type === 'api' ? 'text-indigo-400' : sourceConfig.type === 'csv' ? 'text-purple-400' : 'text-amber-400'} />
                <span className="text-xs font-medium text-white">
                  {sourceConfig.type === 'api' ? (sourceConfig.url ? new URL(sourceConfig.url).hostname : 'API') : sourceConfig.type.toUpperCase()}
                </span>
                {sourceFields.length > 0 && (
                  <span className="text-xs text-emerald-400">{sourceFields.length} fields</span>
                )}
              </div>

              <ArrowRight size={14} className="text-slate-500" />

              {/* Transform Node */}
              <div className={`flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border rounded-xl transition-all ${
                transformMappings.length > 0 ? 'border-indigo-500/30 shadow-lg shadow-indigo-500/5' : 'border-slate-700/50'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${transformMappings.length > 0 ? 'bg-indigo-400 shadow-lg shadow-indigo-400/50 animate-pulse' : 'bg-slate-600'}`} />
                <FileText size={14} className="text-indigo-400" />
                <span className="text-xs font-medium text-white">
                  {transformMappings.length > 0 ? `${transformMappings.length} mapping${transformMappings.length > 1 ? 's' : ''}` : 'Transform'}
                </span>
                {(filterField || sortField) && (
                  <span className="text-xs text-amber-400">
                    {[filterField && 'filter', sortField && 'sort'].filter(Boolean).join('+')}
                  </span>
                )}
              </div>

              <ArrowRight size={14} className="text-slate-500" />

              {/* Destination Node */}
              <div className={`flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border rounded-xl transition-all ${
                destConfig.table ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'border-slate-700/50'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${destConfig.table ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' : 'bg-slate-600'}`} />
                <Database size={14} className="text-emerald-400" />
                <span className="text-xs font-medium text-white">
                  {destConfig.type === 'postgresql' ? 'PostgreSQL' : destConfig.type === 'mysql' ? 'MySQL' : 'CSV'}
                </span>
                {destConfig.table && (
                  <span className="text-xs text-emerald-400 font-mono">{destConfig.table}</span>
                )}
              </div>

              {/* Auto-save status */}
              {pipeline?.id && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                  {autoSaveStatus === 'saving' && (
                    <><Loader2 size={12} className="animate-spin text-slate-500" /><span className="text-slate-500">Saving...</span></>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <><CheckCircle size={12} className="text-emerald-400" /><span className="text-emerald-400">Saved</span></>
                  )}
                  {autoSaveStatus === 'error' && (
                    <><XCircle size={12} className="text-red-400" /><span className="text-red-400">Save failed</span></>
                  )}
                  {autoSaveStatus === 'idle' && lastAutoSave && (
                    <span className="text-slate-600">Saved {lastAutoSave.toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>
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
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-white">Source Configuration</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <span className="text-xs text-indigo-400">Step 1 of 3</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-0.5 mb-6">Choose where your data comes from</p>

              {/* Source type cards with descriptions */}
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

              {/* Inline hint for source configuration */}
              {sourceConfig.type === 'api' && (
                <div className="mb-4 px-4 py-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                  <Globe size={14} className="text-indigo-400 shrink-0" />
                  Enter the full URL of your REST API endpoint. For authenticated requests, add headers below the URL field.
                </div>
              )}
              {sourceConfig.type === 'csv' && (
                <div className="mb-4 px-4 py-3 bg-purple-500/5 border border-purple-500/20 rounded-xl text-xs text-purple-300 flex items-center gap-2">
                  <FileText size={14} className="text-purple-400 shrink-0" />
                  Upload a CSV file with a header row. First row should contain column names, data starts from row 2.
                </div>
              )}
              {sourceConfig.type === 'json' && (
                <div className="mb-4 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <FileJson size={14} className="text-amber-400 shrink-0" />
                  Upload a JSON file containing an array of objects, or paste JSON data directly. Each object = one row.
                </div>
              )}

              {sourceConfig.type === 'api' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">URL</label>
                        <Tooltip
                          icon="help"
                          content="The full HTTP endpoint URL. Supports GET, POST, PUT methods. Include authentication tokens in headers if needed."
                          position="right"
                        />
                      </div>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="https://api.example.com/data"
                        value={sourceConfig.url ?? ''}
                        onChange={(e) => setSourceConfig((p) => ({ ...p, url: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Method</label>
                        <Tooltip
                          icon="help"
                          content={<div><span className="text-emerald-400">GET</span> — retrieve data<br /><span className="text-amber-400">POST</span> — send data to create<br /><span className="text-blue-400">PUT</span> — update existing data</div>}
                          position="right"
                        />
                      </div>
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
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Response JSON Path</label>
                      <Tooltip
                        icon="help"
                        content={<div>Dot-notation path to extract the data array from the API response.<br />Example: <span className="text-indigo-300 font-mono">data.items[*]</span> extracts the <span className="text-indigo-300 font-mono">items</span> array</div>}
                        position="right"
                      />
                    </div>
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
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Upload CSV File</label>
                    <Tooltip
                      icon="help"
                      content="Upload a CSV file from your computer. The first row should contain column headers. Maximum recommended size: 50MB for optimal preview performance."
                      position="right"
                    />
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="block w-full text-sm text-slate-400 file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:text-indigo-400 file:font-medium file:cursor-pointer hover:file:bg-indigo-500/30 transition-all"
                  />
                  <p className="text-xs text-slate-600 mt-2">Supports .csv files with header row • UTF-8 encoding</p>
                </div>
              )}

              {sourceConfig.type === 'json' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Upload JSON File</label>
                      <Tooltip
                        icon="help"
                        content="Upload a JSON file containing an array of objects. Each object represents one row of data."
                        position="right"
                      />
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleJsonUpload}
                      className="block w-full text-sm text-slate-400 file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:text-indigo-400 file:font-medium file:cursor-pointer hover:file:bg-indigo-500/30 transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Or paste JSON data</label>
                      <Tooltip
                        icon="help"
                        content={"Paste a JSON array directly, e.g. [{\"name\": \"John\", \"age\": 30}]"}
                        position="right"
                      />
                    </div>
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
              {sourceFields.length > 0 && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                  <CheckCircle size={12} />
                  Found {sourceFields.length} fields — data is ready to preview
                </p>
              )}
            </div>

            {previewData.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-300">Preview ({previewData.length} rows)</h3>
                  <p className="text-xs text-slate-500">First 5 rows from your data source</p>
                </div>
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
            {/* Step indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-xs text-slate-400">
                <FileText size={14} className="text-indigo-400" />
                Configure filter, sort, and field mappings to transform your data before writing to destination
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <span className="text-xs text-indigo-400">Step 2 of 3</span>
              </div>
            </div>

            {/* Filter, Sort & Flatten */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={16} className="text-amber-400" />
                  <h3 className="text-sm font-medium text-slate-300">Filter Rows</h3>
                  <Tooltip
                    icon="help"
                    content="Filter removes rows that don't match your criteria before writing to destination. Example: keep only rows where status equals 'active'."
                    position="right"
                  />
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
                  <Tooltip
                    icon="help"
                    content="Sort orders the output rows before writing. Ascending (A→Z, 1→9), Descending (Z→A, 9→1). Applied after filtering."
                    position="right"
                  />
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

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={16} className="text-purple-400" />
                  <h3 className="text-sm font-medium text-slate-300">Flatten Nested</h3>
                  <Tooltip
                    icon="help"
                    content="Expand nested JSON objects into flat fields. Example: {'user': {'name': 'John'}} becomes {'user.name': 'John'}. Enables dot-notation mapping like user.name → name."
                    position="right"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flattenNested}
                      onChange={(e) => setFlattenNested(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-300">Enable flatten</span>
                  </label>
                  <p className="text-xs text-slate-500">
                    {flattenNested
                      ? 'Nested fields will be exposed as flat dot-notation keys (e.g., user.profile.name)'
                      : 'Enable to handle deeply nested JSON data with dot-notation field mapping'}
                  </p>
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
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-medium text-slate-300">Field Mappings</h3>
                  <Tooltip
                    icon="help"
                    content="Map source fields to destination columns. Each mapping transforms the data from its original format to your target schema."
                    position="right"
                  />
                </div>
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
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-white">Destination Configuration</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <span className="text-xs text-indigo-400">Step 3 of 3</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-0.5 mb-6">Configure your data destination</p>

              {/* Destination type hint */}
              <div className="mb-4 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Database size={14} className="text-emerald-400 shrink-0" />
                {destConfig.type === 'csv'
                  ? 'Output file will be created at the specified path. Existing file will be overwritten.'
                  : 'Enter your database connection details. Test Connection validates the link before saving.'}
              </div>

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
                        placeholder="127.0.0.1"
                      />
                      <p className="text-xs text-slate-600 mt-1">Database server hostname or IP</p>
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
                      <p className="text-xs text-slate-600 mt-1">Database login name</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={destConfig.password}
                        onChange={(e) => setDestConfig((p) => ({ ...p, password: e.target.value }))}
                      />
                      <p className="text-xs text-slate-600 mt-1">Stored securely, never exposed in logs</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Table</label>
                      <input
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                        value={destConfig.table}
                        onChange={(e) => setDestConfig((p) => ({ ...p, table: e.target.value }))}
                        placeholder="my_table"
                      />
                      <p className="text-xs text-slate-600 mt-1">Target table name (auto-created if not exists)</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Write Mode</label>
                      <Tooltip
                        icon="help"
                        content={
                          <div className="space-y-1">
                            <div><span className="text-emerald-400 font-medium">INSERT</span> — adds new rows only. Fails if row already exists.</div>
                            <div><span className="text-amber-400 font-medium">UPSERT</span> — inserts new rows OR updates existing rows when a conflict is detected on the primary key.</div>
                          </div>
                        }
                        position="left"
                      />
                    </div>
                      <select
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
