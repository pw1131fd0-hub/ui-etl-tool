import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Database, RefreshCw } from 'lucide-react'
import api from '../api/index'

interface Run {
  id: string
  status: 'running' | 'success' | 'failed' | 'cancelled'
  inputRows: number
  outputRows: number
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
}

export default function RunHistory() {
  const { id } = useParams<{ id: string }>()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pipelineName, setPipelineName] = useState('')

  async function fetchRuns() {
    if (!id) return
    setLoading(true)
    try {

      const [pipelinesRes, runsRes] = await Promise.all([
        api.get('/pipelines'),
        api.get(`/pipelines/${id}/runs`),
      ])
      const pipeline = (pipelinesRes.data as any[]).find((p: any) => p.id === id)
      setPipelineName(pipeline?.name ?? 'Pipeline')
      setRuns(runsRes.data as Run[])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuns()
  }, [id])

  const statusConfig = {
    running:  { label: 'Running',   icon: Loader2,      color: 'text-blue-400',   bg: 'bg-blue-500/10',   dot: 'bg-blue-400',   animate: true  },
    success:  { label: 'Success',   icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', animate: false },
    failed:    { label: 'Failed',    icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-500/10',     dot: 'bg-red-400',     animate: false },
    cancelled: { label: 'Cancelled', icon: XCircle,      color: 'text-slate-400',   bg: 'bg-slate-500/10',   dot: 'bg-slate-400',   animate: false },
  }

  function formatDuration(startedAt: string, completedAt: string | null) {
    if (!completedAt) return '—'
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const stats = {
    total: runs.length,
    success: runs.filter(r => r.status === 'success').length,
    failed: runs.filter(r => r.status === 'failed').length,
    running: runs.filter(r => r.status === 'running').length,
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{pipelineName}</h1>
            <p className="text-slate-400 text-sm">Run History</p>
          </div>
        </div>
        <button
          onClick={fetchRuns}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-xl text-sm hover:bg-slate-700/50 transition-all"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Runs', value: stats.total, color: 'text-white' },
          { label: 'Success', value: stats.success, color: 'text-emerald-400' },
          { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          { label: 'Running', value: stats.running, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <p className="text-slate-400 text-sm mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="text-indigo-400 animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && runs.length === 0 && (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
          <Clock size={40} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-slate-300 font-medium mb-2">No runs yet</h3>
          <p className="text-slate-500 text-sm">Run this pipeline to see execution history</p>
        </div>
      )}

      {/* Run list */}
      {!loading && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map(run => {
            const cfg = statusConfig[run.status as keyof typeof statusConfig] ?? statusConfig.cancelled
            const Icon = cfg.icon
            return (
              <div key={run.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/50 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Icon
                      size={20}
                      className={`${cfg.color} ${cfg.animate ? 'animate-spin' : ''}`}
                    />
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.animate ? 'animate-pulse' : ''}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(run.startedAt)}
                    </span>
                    <span>{formatDuration(run.startedAt, run.completedAt)}</span>
                  </div>
                </div>

                {/* Row stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-slate-500" />
                    <span className="text-slate-400">Input</span>
                    <span className="text-white font-medium">{run.inputRows.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-slate-500" />
                    <span className="text-slate-400">Output</span>
                    <span className="text-white font-medium">{run.outputRows.toLocaleString()}</span>
                  </div>
                  {run.inputRows > 0 && (
                    <span className="text-slate-500 text-xs">
                      {((run.outputRows / run.inputRows) * 100).toFixed(1)}% success rate
                    </span>
                  )}
                </div>

                {/* Error message */}
                {run.errorMessage && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs font-mono">
                    {run.errorMessage}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
