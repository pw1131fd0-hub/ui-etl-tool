# UI ETL Tool - PRD v1.0

## 1. 產品願景
工程師導向的視覺化 ETL 工具，讓工程師用 UI 設定取代大量客製化 pipeline 代碼。支援 API / CSV / JSON 多資料來源，目標市場 B2B 企業。產品願景是成為「工程師首選的無程式碼 ETL 平台」，讓資料同步任務在 10 分鐘內從零到生產。

## 2. User Story（PRD Quality Gate 要求：格式「作為...我希望...以便...」）

**身為 PM（資料工程師）**
作為一個專案經理，我希望在不需要工程師幫忙的情況下，自己建立一個從 API 拉資料到資料庫的 Pipeline，以便每週固定時間自動更新競爭對手價格資料到 BigQuery，省下每週手動處理的時間。

**身為資料工程師**
作為一個資料工程師，我希望把重複性的資料轉換邏輯封裝成可複用的 Pipeline 範本，以便讓團隊成員直接使用範本建立自己的 Pipeline，降低人為錯誤率，並且所有 Pipeline 集中管理有 Audit Log。

**身為營運人員**
作為一個營運人員，我希望把 CSV 檔案上傳就能轉換並寫入 PostgreSQL，不需要寫任何指令碼，以便每週把供應商報價表匯入內部系統，省去手動複製貼上的時間。

## 3. P0 / P1 / P2 功能分級

### P0（MVP — 必備，影響產品核心價值）

1. **Pipeline 3步驟編輯器**
   - Source：REST API（GET/POST）、CSV 上傳、JSON 上傳/粘貼
   - Transform：Filter（eq/neq/contains/gt/lt）、Sort（asc/desc）、Field Mapping（string/integer/date/trim/lowercase/uppercase/concat）
   - Destination：PostgreSQL、MySQL、CSV 輸出；支援 INSERT / UPSERT

2. **Pipeline 管理 Dashboard**
   - Pipeline 清單檢視（名稱、狀態、schedule、資料庫、執行次數）
   - 批次選取刪除、一鍵 Clone、Active/Inactive 切換
   - Import / Export Pipeline 為 JSON

3. **即時資料預覽（當前重大缺失）**
   - Source Fetch Preview：顯示前5筆資料與欄位名稱
   - Transform Output Preview：**使用者做完 Transform 設定後，必須能看見 filter/sort/mapping 後的最終輸出結果，否則無法信任設定是否正確**

4. **身份驗證與 Workspace**
   - Email + 密碼登入（JWT，15min access / 7d refresh）
   - 每個 Workspace 獨立 Pipeline、API Keys、Audit Log

### P1（完整產品 — 影響用戶留存）

5. **排程自動化**：Cron 語法（`*/5 * * * *` 每5分鐘、`0 0 * * *` 每日凌晨）

6. **Pipeline 範本市集**：儲存 Pipeline 為範本、分類（api/csv/database/custom）、usageCount 追蹤

7. **Webhook 觸發**：API Key + POST `/api/runs/webhook/:apiKey` 外部觸發執行

8. **執行歷程**：每次 Pipeline 運行的成敗、input/output rows、執行時間；Activity Log  Audit Trail

### P2（增強功能 — 長期競爭力）

9. **PDF 作為 Source**
10. **即時協作（多人同時編輯）**
11. **OpenAPI 文件自動生成**
12. **即時監控 Alert（Telegram / Email）**

## 4. 非功能需求

### 效能
- Pipeline 執行時間：< 10,000 列資料，目標 < 5 秒完成
- API 端點回應：一般 CRUD < 200ms，檔案上傳相關 < 2s

### 可用性
- 系統可用性目標 99.9%（每月停機 < 8.7 小時）
- 登入成功率 > 99.5%

### 擴展性
- 每 Workspace 支援至少 50 個 Pipeline（Free plan 限 1 個）
- Pipeline 執行併發數可水平擴展

### 安全性
- 密碼 bcrypt hash，cost >= 12
- JWT access token 15分鐘過期，refresh token 7天過期
- API Key 使用 SHA-256 hash 儲存
- 敏感資料（密碼、API Key）不在 client-side 儲存
- CORS 白名單限制

## 5. 技術選型

| 層 | 選擇 | 理由 |
|----|------|------|
| 前端框架 | React 18 + TypeScript | 元件化架構，型別安全 |
| 構建工具 | Vite | 快速 HMR，build 效率高 |
| CSS 框架 | Tailwind CSS | 快速 UI 建構，dark theme slate-900 |
| 路由 | React Router v6 | 標準 SPA 路由 |
| 狀態管理 | Zustand | 輕量，比 Redux 適合 UI 狀態 |
| HTTP Client | Axios + Interceptor | JWT refresh 機制 |
| 後端框架 | Express.js + TypeScript | 標準 REST API |
| ORM | Prisma | 型別安全，migration 方便 |
| 主要資料庫 | PostgreSQL | JSONB 儲存 pipeline config 方便 |
| 訊息佇列 | Bull + Redis | 支援 retry/delay job（預留） |
| 密碼 Hash | bcryptjs | 業界標準 |
| 輸入驗證 | Zod | 型別安全的 runtime 驗證 |
| 容器化 | Docker Compose | 開發與生產一致部署 |

## 6. UI/UX 色彩計劃

### 主題
- **Dark Mode Only**：`bg-slate-900` (#0f172a) 為主背景，不提供 Light Mode

### 色彩系統（當前實作）
| 用途 | 色彩 | Tailwind Class |
|------|------|---------------|
| 主背景 | #0f172a | `bg-slate-900` |
| 卡片背景 | #1e293b 80% | `bg-slate-800/80` |
| 邊框 | #334155 50% | `border-slate-700/50` |
| 主 CTA 漸層 | Indigo-500 → Purple-500 | `from-indigo-500 to-purple-500` |
| 成功/Active | Emerald-400 | `text-emerald-400` / `bg-emerald-500/10` |
| 危險/錯誤 | Red-400 | `text-red-400` / `bg-red-500/10` |
| 警告 | Amber-400 | `text-amber-400` |
| 內文主要 | White | `text-white` |
| 內文次要 | Slate-400 | `text-slate-400` |
| 內文Placeholder | Slate-600 | `text-slate-600` |
| 主色圖示 | Indigo-400 | `text-indigo-400` |
| Template 紫色 | Purple-400 | `text-purple-400` |

### 字體
- 系統字體：`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Monospace（欄位名、程式碼）：`'SF Mono', 'Fira Code', Consolas, monospace`

### 佈局原則
- Sidebar：`w-64`（256px），`min-h-screen`
- 主要內容：`max-w-5xl` 居中
- Stats 卡片：`grid grid-cols-4 gap-4`
- Pipeline 卡片列表：`gap-3` 垂直堆疊
- 卡片：`rounded-2xl`（24px）；按鈕/輸入框：`rounded-xl`（12px）
- Scrollbar：寬 6px，track `bg-slate-800/50`，thumb `bg-slate-600`

### 動畫
- Spinner：`@keyframes spin 1s linear infinite`
- Hover：`transition-all`
- Toast：`fixed top-4 right-4 z-50`，3秒自動消失

## 7. 成功指標（KPI）

### 產品健康指標
| KPI | 目標值 | 測量方式 |
|-----|--------|---------|
| Pipeline 建立完成率 | > 80% | 建立的 Pipeline 最進到 "Active" 狀態的比例 |
| 用戶首次成功執行 ETL | < 10 分鐘 | 從帳號建立到第一次觸發 run 的時間中位數 |
| Pipeline 執行成功率 | > 95% | completed / (completed + failed)，滾動30天 |
| Dashboard 跳出率 | < 40% | 單次 session 只瀏覽 Dashboard 不操作就離開 |

### 工程指標
| KPI | 目標值 | 現況 |
|-----|--------|------|
| 單元測試覆蓋率 | > 80% statements | 70/70 tests passing |
| 前端 JS Bundle | < 350KB gzip | 105KB gzip ✅ |
| 前端 CSS | < 25KB gzip | 4.89KB gzip ✅ |
| API 回應時間 | < 200ms P50 | 待優化 |
| Build | Success | ✅ |
