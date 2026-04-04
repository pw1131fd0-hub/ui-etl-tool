# DEV_LOG.md - UI ETL Tool

## Phase 1: 骨架 + Auth (2026-04-04)

### Completed Steps

#### Step 1: 初始化專案
- `npm init -y` → package.json created
- Frontend deps: react, react-dom, react-router-dom, @xyflow/react, zustand, axios, tailwindcss@3, postcss, autoprefixer, vite@6, @vitejs/plugin-react
- Backend deps: express@4, @prisma/client@5, prisma@5, jsonwebtoken, bcryptjs, bull, ioredis, node-cron, csv-parse, axios, cors, dotenv, zod
- Dev deps: typescript@5, @types/react, @types/react-dom, @types/node, @types/express@4, @types/jsonwebtoken, @types/bcryptjs, @types/cors, tsx, concurrently, prisma
- tsconfig.json (frontend), tsconfig.backend.json, vite.config.ts, tailwind.config.js, postcss.config.js

#### Step 2: Docker Compose
- docker-compose.yml: PostgreSQL 15 + Redis 7
- ⚠️ Docker not available on this host; docker compose commands documented for dev machine

#### Step 3: Prisma Schema
- prisma/schema.prisma: User, Workspace, Pipeline, Run, ApiKey models
- `npx prisma generate` → ✅ exit 0
- Note: downgraded from Prisma 7 (unsupported config) to Prisma 5.22.0

#### Step 4: 後端程式碼
- src/backend/index.ts: Express server on port 3005
- src/backend/config/prisma.ts: Prisma singleton
- src/backend/middleware/auth.ts: JWT middleware (15min access token)
- src/backend/routes/auth.ts: register/login/refresh/me
- src/backend/routes/pipelines.ts: CRUD endpoints
- src/backend/routes/runs.ts: POST /run, GET /runs
- Backend starts successfully ✅

#### Step 5: 前端程式碼
- src/frontend/index.html, main.tsx, App.tsx (react-router-dom)
- src/frontend/pages/Login.tsx, Register.tsx, Dashboard.tsx
- src/frontend/api/index.ts: axios + JWT interceptor + refresh logic
- src/frontend/store/authStore.ts: Zustand persist
- src/frontend/store/pipelineStore.ts: Zustand pipeline store
- src/index.css + src/frontend/index.css: Tailwind
- Frontend vite builds successfully ✅

#### Step 6: 環境變數
- .env.example created
- .env created (dev, port 3005)
- Note: ports 3000/3001 occupied on this host; using 3005

#### Step 7: package.json scripts
- dev, dev:backend, dev:frontend, build, docker:up, docker:down, prisma:generate, prisma:migrate

### Technical Notes
- Express 4.21.0 (downgraded from 5.x)
- Tailwind CSS 3.4.0 (downgraded from 4.x which has breaking config changes)
- Prisma 5.22.0 (downgraded from 7.x which requires new config format)
- Backend runs on port 3005 (3000/3001 occupied on host)
