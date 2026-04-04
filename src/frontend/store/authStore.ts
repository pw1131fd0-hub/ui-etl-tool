import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  role: string
}

interface Workspace {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  workspace: Workspace | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, workspace: Workspace, accessToken: string, refreshToken: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      workspace: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, workspace, accessToken, refreshToken) =>
        set({ user, workspace, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: () =>
        set({ user: null, workspace: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' }
  )
)
