# UI ETL Tool - SD v1.0 (System Design)

## 1. 技術選型理由

### 前端：React + TypeScript
- 理由：React Flow 社群豐富，適合視覺化 pipeline editor
- Alternative considered: Vue (社群稍弱), Angular (過重)
- State: Zustand（比 Redux 輕量，比 React Query 適合全域 UI 狀態）

### 後端：Node.js + Express
- 理由：前後端同語言，迭代快，社群豐富
- Alternative: Python FastAPI（第二階段評估）
- ORM: Prisma（型別安全，migration 方便）

### Job Queue: Bull + Redis
- 理由：Node.js 原生，支援 retry / priority / delayed jobs
- Alternative: BQ (simple queue), pg-boss (不用額外 Redis)

### DB: PostgreSQL
- 理由：pipeline 設定用 JSONB 儲存很方便，pg 是業界標準
- Alternative: MySQL（也支援，但 JSONB 效能較差）

## 2. Pipeline 設定儲存格式

```json
// Source Config (API)
{
  "type": "api",
  "config": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "headers": { "Authorization": "Bearer {{API_KEY}}" },
    "params": { "page": 1 },
    "responsePath": "data.items",
    "pagination": { "type": "page_param", "param": "page", "max": 10 }
  }
}

// Source Config (CSV)
{
  "type": "csv",
  "config": {
    "source": "upload",
    "fileId": "uuid",
    "delimiter": ",",
    "hasHeader": true,
    "encoding": "utf8"
  }
}

// Transform Config
{
  "mappings": [
    { "from": "customer_id", "to": "id", "type": "string" },
    { "from": "amount", "to": "amount_cents", "type": "integer" },
    { "from": "created_at", "to": "created_at", "type": "date", "format": "yyyy-MM-dd" }
  ],
  "skipOnError": true,
  "batchSize": 1000
}

// Destination Config
{
  "type": "postgres",
  "config": {
    "connectionString": "{{DB_URL}}",
    "table": "orders",
    "writeMode": "upsert",
    "upsertKey": ["customer_id", "order_date"]
  }
}
```

## 3. 欄位對應 UI 設計

```
┌─────────────────────────────────────────────────────────┐
│  Source Fields          │  Transform    │  Dest Fields │
│  ─────────────────────  │  ──────────   │  ──────────  │
│  ☑ customer_id          │  → id         │  ☑ id        │
│  ☑ customer_name   ─────│  → name       │  ☑ name      │
│  ☑ amount           ─────│  → amt_cents  │  ☑ amt_cents │
│  ☑ created_at       ─────│  → created_at│  ☑ created_at│
│  ☑ skip_this_field      │  ✗ (delete)   │              │
└─────────────────────────────────────────────────────────┘
```

拖曳：Source field → Dest field
點擊：選擇 Transform type (string / integer / date / trim / lowercase)

## 4. 執行流程時序圖

```
User Click "Run"
    │
    ▼
Frontend ──POST /api/pipelines/:id/run──▶ API Gateway
                                            │
                                            ▼
                                      Job Queue (Bull)
                                            │
                              ┌─────────────┴─────────────┐
                              │ 1. Fetch Source           │
                              │    - API: curl + parse    │
                              │    - CSV: fs.read + parse  │
                              │ 2. Transform rows         │
                              │    - Apply mappings        │
                              │    - Type conversion       │
                              │ 3. Write Destination       │
                              │    - Batch INSERT/UPSERT   │
                              │ 4. Log result              │
                              │    - Write Run record       │
                              └─────────────────────────────┘
                                            │
                                            ▼
                                   WebSocket / Poll
                                            │
                                            ▼
Frontend ◀────── Run Complete ────────────
```

## 5. 安全性設計

### 環境變數（不進 Git）
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
CORS_ORIGIN=https://yourapp.com
```

### Secrets 處理
- API Key / DB Password：用 `{{SECRET_NAME}}` placeholder
- 實際值存在 `.env`，Worker 執行時替換
- 不允許直接存 raw secrets 在 pipeline config

### 網路安全
- HTTPS only
- API Rate Limiting: 100 req/min per user
- CORS: 白名單 only

## 6. 部署架構

```
Development:
  - Docker Compose (PG + Redis + API + Frontend)

Production:
  ┌──────────────────────────────────┐
  │       Railway / Render           │
  │  ┌─────────┐  ┌─────────────┐  │
  │  │  API     │  │  Worker     │  │
  │  │  (Node)  │  │  (Bull)     │  │
  │  └────┬────┘  └──────┬──────┘  │
  │       │              │          │
  │  ┌────▼──────────────▼────┐    │
  │  │     PostgreSQL (RDS)   │    │
  │  └─────────────────────────┘    │
  │  ┌─────────────────────────┐    │
  │  │     Redis (Upstash)    │    │
  │  └─────────────────────────┘    │
  └──────────────────────────────────┘
```

## 7. MVP 實作順序

### Phase 1: 骨架 + Auth（1-2天）
1. Docker Compose 環境
2. Prisma Schema + Migration
3. JWT Auth (register / login)
4. 基本 CRUD API scaffold

### Phase 2: Pipeline CRUD（2-3天）
1. Pipeline CRUD API
2. React: Pipeline List + Create Form
3. Source Config: API + CSV (no preview yet)
4. Destination Config: PostgreSQL connect

### Phase 3: Transform Editor（2-3天）
1. React Flow 欄位拖曳對應 UI
2. Transform type selector
3. Source data preview (fetch 5 rows)

### Phase 4: ETL Engine（2-3天）
1. Bull Queue integration
2. Source fetcher (API + CSV)
3. Transformer (mappings + type conv)
4. Destination writer (Postgres INSERT/UPSERT)
5. Run Log API

### Phase 5: 排程 + 收尾（1-2天）
1. Cron scheduler (node-cron)
2. Run history UI
3. Error handling + retry
4. Basic Dashboard stats
