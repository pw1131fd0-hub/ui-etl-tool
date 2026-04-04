# UI ETL Tool - PRD v1.0

## 1. 產品定位
工程師導向的視覺化 ETL 工具，讓工程師用 UI 設定取代大量客製化 pipeline 代碼。支援 API / CSV / PDF 多資料來源，目標市場 B2B 企業。

## 2. MVP 核心功能（v1.0）

### 2.1 Pipeline 管理
- 建立、編輯、刪除、複製、版本歷史
- 每個 Pipeline 包含：Source → Transform → Destination → Schedule → Runs

### 2.2 輸入 Source（v1.0）
- REST API（GET/POST），支援 Query Params / Headers / Body
- CSV 檔案上傳（拖放或 URL）
- PDF 結構化提取（第二階段）

### 2.3 轉換 Transform
- UI 拖曳欄位對應（Source Field → Destination Field）
- 基本資料型別轉換（string → int, date format, trim, null handling）
- 不做複雜 join/聚合（第二階段）

### 2.4 輸出 Destination（v1.0）
- PostgreSQL（INSERT / UPSERT）
- MySQL（INSERT / UPSERT）
- 之後擴充：BigQuery, Snowflake, Data Warehouse

### 2.5 觸發 Trigger
- 手動立即執行
- Cron 排程（標準 cron expression，格式：`*/5 * * * *`）
- Webhook觸發（第二階段）

### 2.6 執行日誌 Runs
- 每次跑的 input rows / output rows
- 錯誤攔截與詳細錯誤訊息
- 執行耗時
- 最多保留 30 天日誌

## 3. 使用者介面

### 3.1 登入與認證
- 工程師 Email + 密碼登入（JWT）
- API Key 管理（M2M 用途）
- 組織 Workspace（多人協作）

### 3.2 Pipeline Editor
- 左側：Source / Transform / Destination 三個步驟的分頁
- 中間：主視覺化區（欄位拖曳對應）
- 右側：設定面板（API endpoint、DB 連線等）
- 下方：即時預覽（Fetch 5 rows 顯示）

### 3.3 Dashboard
- Pipeline 列表（狀態：啟用/停用/錯誤）
- 執行歷史（最近 100 筆）
- 成功率 / 失敗率統計

## 4. 技術架構

### 4.1 前端
- React 18 + TypeScript
- Tailwind CSS
- React Flow（流程圖視覺化）
- Zustand（狀態管理）

### 4.2 後端
- Node.js + Express
- Prisma（ORM）
- Bull + Redis（Job Queue）

### 4.3 資料庫
- PostgreSQL（pipeline 設定 + 執行日誌 + 用戶資料）

### 4.4 部署
- Docker（frontend nginx + backend + PG + Redis）
- 托管：Railway / Render / VPS

## 5. 商業模式
- Freemium：1 pipeline 免費，專業版 \$29/mo 起
- 企業版：自架 on-prem + 客製化支援

## 6. 第二階段功能（v1.1+）
- PDF 作為輸入 source
- Python 後端支援
- CDC / 即時串流
- 多輸出支援
