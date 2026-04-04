import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePipelineStore } from '../store/pipelineStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, workspace, logout } = useAuthStore()
  const { pipelines, loading, error, fetchPipelines } = usePipelineStore()

  useEffect(() => {
    fetchPipelines()
  }, [fetchPipelines])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">UI ETL Tool</h1>
            <p className="text-sm text-gray-500">{workspace?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Pipelines</h2>
          <button
            onClick={() => navigate('/pipelines/new')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Pipeline
          </button>
        </div>

        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && pipelines.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500 mb-4">No pipelines yet. Create your first one!</p>
          </div>
        )}

        {!loading && pipelines.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Schedule</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Updated</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.map((pipeline) => (
                  <tr
                    key={pipeline.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{pipeline.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        pipeline.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {pipeline.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{pipeline.schedule ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(pipeline.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
