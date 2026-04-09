import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, MoreHorizontal, Clock, Database, GitBranch, ChevronRight, Trash2, Copy, History, CheckSquare, Square, X, TrendingUp, AlertCircle, CheckCircle2, Upload, Download } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { usePipelineStore } from '../store/pipelineStore'
import { clonePipeline, batchDeletePipeline, updatePipelineStatus, exportPipelines, importPipelines } from '../api/pipeline'

interface RunInfo {
  id: string
  status: string
  inputRows: number
  outputRows: number
  startedAt: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, workspace } = useAuthStore()
  const { pipelines, loading, error, fetchPipelines } = usePipelineStore()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [recentRuns, setRecentRuns] = useState<RunInfo[]>([])

  useEffect(() => {
    fetchPipelines()
  }, [fetchPipelines])

  useEffect(() => {
    // Fetch recent runs for stats
    const fetchRuns = async () => {
      if (pipelines.length === 0) return
      try {
        const { getApiKeys } = await import('../api/pipeline')
        // Get runs from all pipelines
        const allRuns: RunInfo[] = []
        for (const p of pipelines.slice(0, 5)) {
          const res = await fetch(`/api/pipelines/${p.id}/runs`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
          })
          if (res.ok) {
            const runs = await res.json()
            allRuns.push(...runs.slice(0, 10))
          }
        }
        allRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setRecentRuns(allRuns.slice(0, 100))
      } catch {}
    }
    fetchRuns()
  }, [pipelines])

  const showMsg = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === pipelines.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pipelines.map(p => p.id)))
    }
  }

  const handleClone = async (id: string) => {
    setCloningId(id)
    try {
      await clonePipeline(id)
      await fetchPipelines()
      showMsg('Pipeline cloned')
    } catch {
      showMsg('Clone failed')
    } finally {
      setCloningId(null)
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} pipeline(s)?`)) return
    try {
      await batchDeletePipeline([...selected])
      setSelected(new Set())
      setBatchMode(false)
      await fetchPipelines()
      showMsg('Deleted')
    } catch {
      showMsg('Delete failed')
    }
  }

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const next = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      await updatePipelineStatus(id, next)
      await fetchPipelines()
    } catch {
      showMsg('Status update failed')
    }
  }

  const handleExportSelected = async () => {
    if (selected.size === 0) return
    try {
      const data = await exportPipelines([...selected])
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pipelines_export_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showMsg(`Exported ${selected.size} pipeline(s)`)
    } catch {
      showMsg('Export failed')
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const result = await importPipelines(json)
        await fetchPipelines()
        showMsg(`Imported ${result.imported} pipeline(s)`)
      } catch {
        showMsg('Import failed - invalid file')
      }
    }
    input.click()
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    active:   { label: 'Active',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    inactive: { label: 'Inactive', bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400' },
    draft:    { label: 'Draft',    bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  }

  // Stats calculations
  const totalRuns = recentRuns.length
  const successfulRuns = recentRuns.filter(r => r.status === 'completed').length
  const failedRuns = recentRuns.filter(r => r.status === 'failed').length
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0
  const totalRowsProcessed = recentRuns.reduce((sum, r) => sum + r.outputRows, 0)

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {workspace?.name ?? 'Dashboard'}
          </h1>
          <p className="text-slate-400 text-sm">Welcome back, {user?.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {batchMode ? (
            <>
              <button
                onClick={selectAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-xl text-sm hover:bg-slate-700/50 transition-all"
              >
                {selected.size === pipelines.length ? <CheckSquare size={16} /> : <Square size={16} />}
                {selected.size === pipelines.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={selected.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm hover:bg-red-500/20 transition-all disabled:opacity-30"
              >
                <Trash2 size={16} />
                Delete ({selected.size})
              </button>
              <button
                onClick={() => { setBatchMode(false); setSelected(new Set()) }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-slate-400 rounded-xl text-sm hover:bg-slate-700/50 transition-all"
              >
                <X size={16} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-xl text-sm hover:bg-slate-700/50 transition-all"
              >
                <Upload size={16} />
                Import
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleExportSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-xl text-sm hover:bg-slate-700/50 transition-all"
                >
                  <Download size={16} />
                  Export ({selected.size})
                </button>
              )}
              <button
                onClick={() => navigate('/pipelines/new')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium text-sm hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-500/25"
              >
                <Plus size={18} />
                New Pipeline
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action message toast */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm shadow-xl animate-fade-in">
          {actionMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <GitBranch size={18} className="text-indigo-400" />
            </div>
            <span className="text-slate-400 text-sm">Total Pipelines</span>
          </div>
          <p className="text-3xl font-bold text-white">{pipelines.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <span className="text-slate-400 text-sm">Success Rate</span>
          </div>
          <p className="text-3xl font-bold text-white">{successRate}%</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <TrendingUp size={18} className="text-amber-400" />
            </div>
            <span className="text-slate-400 text-sm">Rows Processed</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalRowsProcessed.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Play size={18} className="text-purple-400" />
            </div>
            <span className="text-slate-400 text-sm">Active</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {pipelines.filter(p => p.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Pipeline List */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Pipelines</h2>
        <button
          onClick={() => setBatchMode(!batchMode)}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          {batchMode ? 'Exit batch mode' : 'Batch operations'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && pipelines.length === 0 && (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <GitBranch size={28} className="text-slate-500" />
          </div>
          <h3 className="text-slate-300 font-medium mb-2">No pipelines yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create your first ETL pipeline to get started</p>
          <button
            onClick={() => navigate('/pipelines/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-all"
          >
            <Plus size={16} />
            Create Pipeline
          </button>
        </div>
      )}

      {!loading && pipelines.length > 0 && (
        <div className="grid gap-3">
          {pipelines.map((pipeline) => {
            const status = statusConfig[pipeline.status] ?? statusConfig.inactive
            const isSelected = selected.has(pipeline.id)
            const runCount = (pipeline as any)._count?.runs ?? 0
            return (
              <div
                key={pipeline.id}
                className={`group bg-slate-800/50 border rounded-2xl p-5 transition-all cursor-pointer ${
                  isSelected ? 'border-indigo-500/50 bg-slate-800/80' : 'border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {batchMode ? (
                      <button onClick={() => toggleSelect(pipeline.id)} className="text-slate-400 hover:text-white transition-colors">
                        {isSelected ? <CheckSquare size={20} className="text-indigo-400" /> : <Square size={20} />}
                      </button>
                    ) : (
                      <div
                        onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                        className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center"
                      >
                        <GitBranch size={20} className="text-indigo-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-white font-medium mb-0.5">{pipeline.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {pipeline.schedule && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {pipeline.schedule}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Database size={12} />
                          {(pipeline.destinationConfig as any)?.database ?? '—'}
                        </span>
                        <span className="text-slate-600">{runCount} runs</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!batchMode && (
                      <>
                        <button
                          onClick={() => navigate(`/pipelines/${pipeline.id}/runs`)}
                          title="Run history"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-slate-700/50 transition-all"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => handleClone(pipeline.id)}
                          disabled={cloningId === pipeline.id}
                          title="Clone pipeline"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-purple-400 hover:bg-slate-700/50 transition-all disabled:opacity-50"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => handleStatusToggle(pipeline.id, pipeline.status)}
                          title={pipeline.status === 'active' ? 'Deactivate' : 'Activate'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            pipeline.status === 'active'
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
                          }`}
                        >
                          <Play size={14} />
                        </button>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        {!batchMode && (
                          <ChevronRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
