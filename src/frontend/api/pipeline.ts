import api from './index'
import type { Pipeline } from '../store/pipelineStore'

// Source test result
interface SourcePreview {
  rows: string[][]
  fields: string[]
}

// Destination test result
interface DestTestResult {
  success: boolean
  message: string
}

// GET /api/pipelines/:id
export async function getPipeline(id: string): Promise<Pipeline> {
  const { data } = await api.get(`/pipelines/${id}`)
  return data
}

// PUT /api/pipelines/:id
export async function updatePipeline(id: string, payload: {
  name?: string
  description?: string
  sourceConfig?: Record<string, unknown>
  transformConfig?: Record<string, unknown>
  destinationConfig?: Record<string, unknown>
  schedule?: string
  status?: string
}): Promise<Pipeline> {
  const { data } = await api.put(`/pipelines/${id}`, payload)
  return data
}

// POST /api/sources/test — fetch source 5 rows preview
export async function testSource(config: {
  type: 'api' | 'csv'
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string>
  responsePath?: string
  csvData?: string
}): Promise<SourcePreview> {
  const { data } = await api.post('/sources/test', config)
  return data
}

// POST /api/destinations/test — test DB connection
export async function testDestination(config: {
  type: 'postgresql' | 'mysql'
  host: string
  port: number
  database: string
  username: string
  password: string
  table?: string
}): Promise<DestTestResult> {
  const { data } = await api.post('/destinations/test', config)
  return data
}

// POST /api/runs — trigger pipeline run
export async function triggerRun(pipelineId: string): Promise<{ runId: string }> {
  const { data } = await api.post('/runs', { pipelineId })
  return data
}
