import { useEffect, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { getActivityLogs, type ActivityLog } from '../api/pipeline'

const actionColors: Record<string, string> = {
  create: 'text-emerald-400 bg-emerald-500/10',
  update: 'text-blue-400 bg-blue-500/10',
  delete: 'text-red-400 bg-red-500/10',
  run: 'text-purple-400 bg-purple-500/10',
  import: 'text-amber-400 bg-amber-500/10',
  clone: 'text-cyan-400 bg-cyan-500/10',
}

const actionLabels: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  run: 'Ran',
  import: 'Imported',
  clone: 'Cloned',
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const limit = 20

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const data = await getActivityLogs(limit, page * limit)
        setLogs(data.logs)
        setTotal(data.total)
      } catch (err) {
        console.error('Failed to fetch activity logs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [page])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Activity size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Activity Log</h1>
            <p className="text-slate-400 text-sm">Audit trail for your workspace</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Filter size={14} />
            <span>Recent {total} activities</span>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && logs.length === 0 && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
            <Activity size={40} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-400 font-medium">No activity yet</h3>
            <p className="text-slate-600 text-sm mt-1">Your workspace activity will appear here</p>
          </div>
        )}

        {/* Log list */}
        {!loading && logs.length > 0 && (
          <div className="space-y-2">
            {logs.map((log) => {
              const colorClass = actionColors[log.action] ?? 'text-slate-400 bg-slate-500/10'
              const label = actionLabels[log.action] ?? log.action

              return (
                <div
                  key={log.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${colorClass}`}>
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                        {label}
                      </span>
                      <span className="text-slate-400 text-sm">{log.entityType}</span>
                      {log.details && typeof log.details === 'object' && 'name' in log.details && (
                        <span className="text-white text-sm font-medium">
                          {String((log.details as { name?: string }).name ?? '')}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm hover:bg-slate-700 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="text-slate-400 text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm hover:bg-slate-700 disabled:opacity-30 transition-all"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}