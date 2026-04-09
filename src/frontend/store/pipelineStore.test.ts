import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api module before importing the store
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('usePipelineStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct initial state structure', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const state = usePipelineStore.getState()

    expect(state.pipelines).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should have fetchPipelines, createPipeline, updatePipeline, deletePipeline functions', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const state = usePipelineStore.getState()

    expect(typeof state.fetchPipelines).toBe('function')
    expect(typeof state.createPipeline).toBe('function')
    expect(typeof state.updatePipeline).toBe('function')
    expect(typeof state.deletePipeline).toBe('function')
  })

  it('fetchPipelines should set loading true and then false', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const api = await import('../api')
    ;(api.default.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })

    const fetchPromise = usePipelineStore.getState().fetchPipelines()
    expect(usePipelineStore.getState().loading).toBe(true)

    await fetchPromise
    expect(usePipelineStore.getState().loading).toBe(false)
  })

  it('fetchPipelines should set pipelines on success', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const api = await import('../api')
    const mockPipelines = [
      { id: '1', name: 'Pipeline 1', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Pipeline 2', status: 'inactive', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' },
    ]
    ;(api.default.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockPipelines })

    await usePipelineStore.getState().fetchPipelines()

    expect(usePipelineStore.getState().pipelines).toEqual(mockPipelines)
    expect(usePipelineStore.getState().error).toBeNull()
  })

  it('fetchPipelines should set error on failure', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const api = await import('../api')
    ;(api.default.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ message: 'Network error' })

    await usePipelineStore.getState().fetchPipelines()

    expect(usePipelineStore.getState().error).toBe('Network error')
    expect(usePipelineStore.getState().loading).toBe(false)
  })

  it('createPipeline should prepend new pipeline to list', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const api = await import('../api')
    const newPipeline = { id: '3', name: 'New Pipeline', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' }
    ;(api.default.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: newPipeline })

    usePipelineStore.setState({ pipelines: [{ id: '1', name: 'Pipeline 1', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' }] })

    const result = await usePipelineStore.getState().createPipeline({ name: 'New Pipeline' })

    expect(result).toEqual(newPipeline)
    expect(usePipelineStore.getState().pipelines[0]).toEqual(newPipeline)
  })

  it('updatePipeline should update existing pipeline in list', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const api = await import('../api')
    const updatedPipeline = { id: '1', name: 'Updated Pipeline', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' }
    ;(api.default.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: updatedPipeline })

    usePipelineStore.setState({
      pipelines: [{ id: '1', name: 'Pipeline 1', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' }],
    })

    await usePipelineStore.getState().updatePipeline('1', { name: 'Updated Pipeline' })

    expect(usePipelineStore.getState().pipelines[0].name).toBe('Updated Pipeline')
  })

  it('deletePipeline should remove pipeline from list', async () => {
    const { usePipelineStore } = await import('./pipelineStore')
    const api = await import('../api')
    ;(api.default.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({})

    usePipelineStore.setState({
      pipelines: [
        { id: '1', name: 'Pipeline 1', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' },
        { id: '2', name: 'Pipeline 2', status: 'active', sourceConfig: {}, transformConfig: {}, destinationConfig: {}, createdAt: '', updatedAt: '' },
      ],
    })

    await usePipelineStore.getState().deletePipeline('1')

    expect(usePipelineStore.getState().pipelines.length).toBe(1)
    expect(usePipelineStore.getState().pipelines[0].id).toBe('2')
  })
})
