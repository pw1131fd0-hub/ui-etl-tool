# UI ETL Tool - SA v1.0 (System Architecture)

## 1. 系統架構圖

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (React)                     │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS (REST API)
┌─────────────────────▼───────────────────────────────────┐
│              API Gateway (Express.js)                    │
│  - JWT Authentication                                   │
│  - Rate Limiting                                        │
│  - Pipeline CRUD                                        │
└──────┬──────────────────┬──────────────────┬───────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼──────┐  ┌────────▼──────┐
│  Job Queue  │  │  ETL Engine   │  │  Auth Service │
│  (Bull/Redis)│  │  (Node.js)   │  │               │
└──────┬──────┘  └────────┬──────┘  └───────────────┘
       │                  │
┌──────▼──────┐  ┌────────▼──────┐
│   Worker    │  │  PostgreSQL   │
│  (Background)│  │  - pipelines  │
│             │  │  - runs_log   │
│             │  │  - users      │
└──────┬──────┘  └───────────────┘
       │
┌──────▼──────┐
│ Destinations│
│ PG / MySQL │
└────────────┘
```

## 2. 核心資料模型

### 2.1 Pipeline
```
Pipeline {
  id: UUID (PK)
  name: string
  description: string?
  workspace_id: UUID (FK)
  source_config: JSON  // { type: 'api' | 'csv' | 'pdf', config: {} }
  transform_config: JSON  // { mappings: [{from, to, type}] }
  destination_config: JSON  // { type: 'postgres' | 'mysql', config: {} }
  schedule: string?  // cron expression
  status: 'active' | 'inactive' | 'error'
  created_at: timestamp
  updated_at: timestamp
}
```

### 2.2 Run
```
Run {
  id: UUID (PK)
  pipeline_id: UUID (FK)
  status: 'running' | 'success' | 'failed'
  input_rows: integer
  output_rows: integer
  error_message: string?
  started_at: timestamp
  completed_at: timestamp?
}
```

### 2.3 User / Workspace
```
User {
  id: UUID (PK)
  email: string (unique)
  password_hash: string
  workspace_id: UUID (FK)
  role: 'owner' | 'member'
}

Workspace {
  id: UUID (PK)
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  pipeline_limit: integer
}
```

### 2.4 APIKey
```
APIKey {
  id: UUID (PK)
  workspace_id: UUID (FK)
  name: string
  key_hash: string
  created_at: timestamp
}
```

## 3. API 介面規格

### 3.1 Pipeline
- `GET /api/pipelines` - 列表
- `POST /api/pipelines` - 建立
- `GET /api/pipelines/:id` - 取得單一
- `PUT /api/pipelines/:id` - 更新
- `DELETE /api/pipelines/:id` - 刪除
- `POST /api/pipelines/:id/run` - 手動執行
- `GET /api/pipelines/:id/runs` - 執行歷史

### 3.2 Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### 3.3 Source
- `POST /api/sources/test` - 測試連線（fetch sample data）

### 3.4 Destination
- `POST /api/destinations/test` - 測試連線

## 4. ETL Engine 流程

1. **Fetch Source**
   - API: HTTP GET/POST → parse JSON → extract array
   - CSV: stream parse → extract array

2. **Transform**
   - For each row: apply field mappings
   - Type conversion (string → number, date parse, trim)
   - Skip rows that fail validation (log as error)

3. **Write Destination**
   - Batch INSERT or UPSERT (configurable)
   - Commit per batch (default: 1000 rows)

4. **Log Result**
   - Write Run record with stats
   - Emit event for webhook (v1.1)

## 5. 安全性
- JWT access token (15min) + refresh token (7 days)
- Password: bcrypt (cost 12)
- API Key: SHA-256 hash stored
- All DB passwords in env vars (not in config JSON)
- CORS restricted to known origins
