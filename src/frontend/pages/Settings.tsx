import { useEffect, useState } from 'react'
import { Key, Plus, Trash2, Copy, CheckCircle, AlertCircle, Settings, User, Shield } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getApiKeys, createApiKey, deleteApiKey } from '../api/pipeline'

interface ApiKeyInfo {
  id: string
  name: string
  createdAt: string
  key?: string
}

export default function Settings() {
  const { user, workspace } = useAuthStore()
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    setLoading(true)
    try {
      const keys = await getApiKeys()
      setApiKeys(keys)
    } catch (err) {
      console.error('Failed to load API keys:', err)
    } finally {
      setLoading(false)
    }
  }

  const showMsg = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
    try {
      const key = await createApiKey(newKeyName.trim())
      setApiKeys((prev) => [key, ...prev])
      setNewKeyName('')
      setShowNewKey(key.key!)
      showMsg('API key created')
    } catch {
      showMsg('Failed to create API key')
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    try {
      await deleteApiKey(id)
      setApiKeys((prev) => prev.filter((k) => k.id !== id))
      showMsg('API key deleted')
    } catch {
      showMsg('Failed to delete API key')
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    showMsg('Copied to clipboard')
  }

  return (
    <div className="min-h-screen p-8">
      {/* Action message toast */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm shadow-xl">
          {actionMsg}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        {/* Workspace Info */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <User size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Account</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Email</label>
              <p className="text-white">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Role</label>
              <p className="text-white capitalize">{user?.role ?? 'member'}</p>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Shield size={18} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Workspace</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Name</label>
              <p className="text-white">{workspace?.name}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Plan</label>
              <p className="text-white capitalize">{workspace?.plan}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Pipeline Limit</label>
              <p className="text-white">{workspace?.pipelineLimit}</p>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Key size={18} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">API Keys</h2>
                <p className="text-sm text-slate-500">Use these keys to trigger pipelines via webhook</p>
              </div>
            </div>
          </div>

          {/* Create new key */}
          <div className="flex gap-3 mb-6">
            <input
              className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="Key name (e.g., Production Webhook)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            />
            <button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-all"
            >
              <Plus size={16} />
              Create Key
            </button>
          </div>

          {/* New key display */}
          {showNewKey && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                <CheckCircle size={16} />
                Copy your new API key — it won't be shown again
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-900 rounded-lg text-slate-300 font-mono text-sm break-all">
                  {showNewKey}
                </code>
                <button
                  onClick={() => copyKey(showNewKey)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => setShowNewKey(null)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Key list */}
          {loading && apiKeys.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No API keys yet. Create one to trigger pipelines via webhook.
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 bg-slate-900/40 rounded-xl">
                  <div>
                    <p className="text-white font-medium">{key.name}</p>
                    <p className="text-xs text-slate-500">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Webhook Info */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertCircle size={18} className="text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Webhook Usage</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Trigger a pipeline run using a POST request to:
          </p>
          <code className="block px-4 py-3 bg-slate-900 rounded-xl text-slate-300 font-mono text-sm break-all">
            POST /api/runs/webhook/:apiKey {'{"}'}pipelineId": "your-pipeline-id"{'}'}
          </code>
        </div>
      </div>
    </div>
  )
}