import api from './index'
import type { Pipeline } from '../store/pipelineStore'

interface SourcePreview { rows: string[][]; fields: string[] }
interface DestTestResult { success: boolean; message: string }

export async function getPipeline(id: string): Promise<Pipeline> {
  const { data } = await api.get(`/pipelines/${id}`)
  return data
}

export async function updatePipeline(id: string, payload: {
  name?: string; description?: string
  sourceConfig?: Record<string, unknown>; transformConfig?: Record<string, unknown>
  destinationConfig?: Record<string, unknown>; schedule?: string; status?: string
}): Promise<Pipeline> {
  const { data } = await api.put(`/pipelines/${id}`, payload)
  return data
}

export async function clonePipeline(id: string): Promise<Pipeline> {
  const { data } = await api.post(`/pipelines/${id}/clone`)
  return data
}

export async function deletePipeline(id: string): Promise<void> {
  await api.delete(`/pipelines/${id}`)
}

export async function batchDeletePipeline(ids: string[]): Promise<{ deleted: number }> {
  const { data } = await api.post('/pipelines/batch-delete', { ids })
  return data
}

export async function updatePipelineStatus(id: string, status: string): Promise<Pipeline> {
  const { data } = await api.patch(`/pipelines/${id}/status`, { status })
  return data
}

export async function testSource(config: {
  type: 'api' | 'csv' | 'json'; url?: string; method?: string
  headers?: Record<string, string>; params?: Record<string, string>
  responsePath?: string; csvData?: string; jsonData?: string
}): Promise<SourcePreview> {
  const { data } = await api.post('/sources/test', config)
  return data
}

export async function testDestination(config: {
  type: 'postgresql' | 'mysql' | 'csv'; host?: string; port?: number
  database?: string; username?: string; password?: string; table?: string; csvPath?: string
}): Promise<DestTestResult> {
  const { data } = await api.post('/destinations/test', config)
  return data
}

export async function triggerRun(pipelineId: string): Promise<{ runId: string }> {
  const { data } = await api.post('/runs', { pipelineId })
  return data
}

// API Keys
interface ApiKey { id: string; name: string; createdAt: string; key?: string }

export async function getApiKeys(): Promise<ApiKey[]> {
  const { data } = await api.get('/apikeys')
  return data
}

export async function createApiKey(name: string): Promise<ApiKey> {
  const { data } = await api.post('/apikeys', { name })
  return data
}

export async function deleteApiKey(id: string): Promise<void> {
  await api.delete(`/apikeys/${id}`)
}
