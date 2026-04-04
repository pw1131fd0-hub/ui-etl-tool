import { create } from 'zustand'
import api from '../api'

export interface Pipeline {
  id: string
  name: string
  description?: string
  status: string
  schedule?: string
  sourceConfig: Record<string, unknown>
  transformConfig: Record<string, unknown>
  destinationConfig: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface PipelineState {
  pipelines: Pipeline[]
  loading: boolean
  error: string | null
  fetchPipelines: () => Promise<void>
  createPipeline: (data: Partial<Pipeline>) => Promise<Pipeline>
  updatePipeline: (id: string, data: Partial<Pipeline>) => Promise<void>
  deletePipeline: (id: string) => Promise<void>
}

export const usePipelineStore = create<PipelineState>((set) => ({
  pipelines: [],
  loading: false,
  error: null,
  fetchPipelines: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/pipelines')
      set({ pipelines: data, loading: false })
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message ?? 'Failed to fetch pipelines', loading: false })
    }
  },
  createPipeline: async (pipelineData) => {
    const { data } = await api.post('/pipelines', pipelineData)
    set((state) => ({ pipelines: [data, ...state.pipelines] }))
    return data
  },
  updatePipeline: async (id, pipelineData) => {
    const { data } = await api.put(`/pipelines/${id}`, pipelineData)
    set((state) => ({
      pipelines: state.pipelines.map((p) => (p.id === id ? data : p)),
    }))
  },
  deletePipeline: async (id) => {
    await api.delete(`/pipelines/${id}`)
    set((state) => ({
      pipelines: state.pipelines.filter((p) => p.id !== id),
    }))
  },
}))
