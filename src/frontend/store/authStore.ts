import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const API = '/api'

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
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      workspace: null,
      accessToken: null,
      refreshToken: null,

      login: async (email: string, password: string) => {
        const { data } = await axios.post(`${API}/auth/login`, { email, password })
        set({
          user: data.user,
          workspace: data.workspace,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        })
      },

      register: async (email: string, password: string) => {
        const { data } = await axios.post(`${API}/auth/register`, { email, password })
        set({
          user: data.user,
          workspace: data.workspace,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        })
      },

      logout: () =>
        set({ user: null, workspace: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' }
  )
)
