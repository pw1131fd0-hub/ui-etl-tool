import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutTemplate, Plus, Copy, Trash2, Play, Search, Globe, Lock, ChevronRight, Loader2 } from 'lucide-react'
import { getTemplates, deleteTemplate, instantiateTemplate, type PipelineTemplate } from '../api/pipeline'
import { usePipelineStore } from '../store/pipelineStore'

const categories = ['all', 'api', 'csv', 'database', 'custom']

export default function TemplatesPage() {
  const navigate = useNavigate()
  const { fetchPipelines } = usePipelineStore()
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [instantiating, setInstantiating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)
      try {
        const data = await getTemplates()
        setTemplates(data)
      } catch (err) {
        console.error('Failed to fetch templates:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const handleInstantiate = async (id: string) => {
    setInstantiating(id)
    try {
      const pipeline = await instantiateTemplate(id)
      await fetchPipelines()
      navigate(`/pipelines/${pipeline.id}`)
    } catch (err) {
      console.error('Failed to create pipeline from template:', err)
    } finally {
      setInstantiating(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    setDeleting(id)
    try {
      await deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Failed to delete template:', err)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || t.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <LayoutTemplate size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Pipeline Templates</h1>
              <p className="text-slate-400 text-sm">Start fast with pre-built pipeline configurations</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  category === cat
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
            <LayoutTemplate size={40} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-400 font-medium">No templates found</h3>
            <p className="text-slate-600 text-sm mt-1">
              {search ? 'Try a different search term' : 'Save a pipeline as a template to see it here'}
            </p>
          </div>
        )}

        {/* Template grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                    <LayoutTemplate size={18} className="text-purple-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    {template.isPublic ? (
                      <Globe size={14} className="text-slate-500" />
                    ) : (
                      <Lock size={14} className="text-slate-500" />
                    )}
                    <span className="text-xs text-slate-500 capitalize">{template.category}</span>
                  </div>
                </div>

                <h3 className="text-white font-medium mb-1">{template.name}</h3>
                <p className="text-slate-500 text-xs line-clamp-2 mb-3">
                  {template.description ?? 'No description'}
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <Play size={12} />
                  <span>{template.usageCount} uses</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleInstantiate(template.id)}
                    disabled={instantiating === template.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-500/30 transition-all disabled:opacity-50"
                  >
                    {instantiating === template.id ? (
                      <><Loader2 size={14} className="animate-spin" /> Creating...</>
                    ) : (
                      <><Plus size={14} /> Use Template</>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    disabled={deleting === template.id}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}