import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/frontend/main.tsx', 'src/frontend/index.css', 'src/frontend/vite-env.d.ts', 'src/backend/workers/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/frontend/main.tsx',
        'src/frontend/index.css',
        'src/frontend/vite-env.d.ts',
        'src/backend/workers/*.ts',
        'src/backend/index.ts',
        'src/backend/scheduler.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/frontend'),
    },
  },
})
