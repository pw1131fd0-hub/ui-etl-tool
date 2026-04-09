import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// Mock axios before importing the store
vi.mock('axios')
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual('zustand/middleware')
  return { ...actual as object }
})

// We need to test the auth store behavior
// Since it uses Zustand persist, we test the interface contract
describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct initial state structure', async () => {
    // Dynamic import to ensure mocks are set up first
    const { useAuthStore } = await import('./authStore')
    const state = useAuthStore.getState()

    expect(state.user).toBeNull()
    expect(state.workspace).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
  })

  it('should have login, register, logout, setTokens functions', async () => {
    const { useAuthStore } = await import('./authStore')
    const state = useAuthStore.getState()

    expect(typeof state.login).toBe('function')
    expect(typeof state.register).toBe('function')
    expect(typeof state.logout).toBe('function')
    expect(typeof state.setTokens).toBe('function')
  })

  it('setTokens should update tokens', async () => {
    const { useAuthStore } = await import('./authStore')
    useAuthStore.getState().setTokens('new-access-token', 'new-refresh-token')

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('new-access-token')
    expect(state.refreshToken).toBe('new-refresh-token')
  })

  it('logout should clear all state', async () => {
    const { useAuthStore } = await import('./authStore')
    useAuthStore.getState().setTokens('token', 'refresh')
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.workspace).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
  })

  it('login should call axios.post with correct endpoint', async () => {
    const { useAuthStore } = await import('./authStore')
    ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        user: { id: '1', email: 'test@example.com', role: 'owner' },
        workspace: { id: 'ws1', name: 'Test Workspace' },
        accessToken: 'access123',
        refreshToken: 'refresh123',
      },
    })

    await useAuthStore.getState().login('test@example.com', 'password123')

    expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('login should set user, workspace, and tokens on success', async () => {
    const { useAuthStore } = await import('./authStore')
    const mockData = {
      user: { id: '1', email: 'test@example.com', role: 'owner' },
      workspace: { id: 'ws1', name: 'Test Workspace' },
      accessToken: 'access123',
      refreshToken: 'refresh123',
    }
    ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData })

    await useAuthStore.getState().login('test@example.com', 'password123')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockData.user)
    expect(state.workspace).toEqual(mockData.workspace)
    expect(state.accessToken).toBe(mockData.accessToken)
    expect(state.refreshToken).toBe(mockData.refreshToken)
  })

  it('register should call axios.post with correct endpoint', async () => {
    const { useAuthStore } = await import('./authStore')
    ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        user: { id: '2', email: 'new@example.com', role: 'owner' },
        workspace: { id: 'ws2', name: 'New Workspace' },
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      },
    })

    await useAuthStore.getState().register('new@example.com', 'password123')

    expect(axios.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'new@example.com',
      password: 'password123',
    })
  })

  it('register should set user, workspace, and tokens on success', async () => {
    const { useAuthStore } = await import('./authStore')
    const mockData = {
      user: { id: '2', email: 'new@example.com', role: 'owner' },
      workspace: { id: 'ws2', name: 'New Workspace' },
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    }
    ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData })

    await useAuthStore.getState().register('new@example.com', 'password123')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockData.user)
    expect(state.workspace).toEqual(mockData.workspace)
  })
})
