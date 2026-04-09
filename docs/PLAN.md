# 執行計劃 — UI ETL Tool UX/功能修復

## 現有基礎

### 技術棧
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + Zustand + React Router v7 + @xyflow/react
- **後端**: Express.js + TypeScript + Prisma ORM
- **資料庫**: PostgreSQL + Redis (Bull job queue)
- **認證**: JWT + bcryptjs + Zod
- **其他**: Docker Compose, node-cron

### 現有功能
- Pipeline CRUD（3步驟：Source → Transform → Destination）
- JWT 登入/註冊，Workspace 隔離
- Source 類型：REST API、CSV 上傳、JSON 粘貼
- Transform：Filter / Sort / Field Mapping（含 concat）
- Destination：PostgreSQL、MySQL、CSV 輸出，支援 INSERT/UPSERT
- Pipeline 管理 Dashboard（List / Clone / Active-Inactive / Import-Export）
- 手動觸發 Run、執行歷程、Activity Log
- API Keys 管理與 Webhook 觸發
- Pipeline 範本儲存
- Cron 排程

### docs/ 目錄現況
| 檔案 | 狀態 |
|------|------|
| PRD.md | 存在，完整（7項全部 >= 50字） |
| SA.md | 存在，完整 |
| SD.md | 存在，完整 |

---

## PRD 評估
- **狀態**: 存在且完整
- **各項內容**: 全部 >= 50字，符合 quality gate 要求

---

## SA/SD 評估
- **狀態**: SA.md + SD.md 均存在且完整
- **Quality Gate**: 達 85 分門檻，可進入 dev

---

## 建議執行階段

- **Phase 1**: 直接進 dev（PRD 85分達標，SA/SD 85分達標）
- **Phase 2**: dev 迭代修復 → test → security → done

---

## 優先修復清單（dev 切入時）

### 🔴 P0 — 影響核心價值（必須修）

1. **Transform 步輸出 Preview 缺失**
   - **檔案**: `src/frontend/pages/PipelineEditor.tsx`
   - **問題**: 使用者做完 Transform 設定（Filter / Sort / Field Mapping）後，只能看見 Source Preview，無法看到 Transform 後的最終輸出結果。使用者無法信任設定是否正確。
   - **修復**: 在 Transform step 新增「Transform Output Preview」區塊，點擊「Preview Transform」按鈕後，套用 filter / sort / mapping 到 source data，顯示 transformed rows（含 transformed field 值）。可在 Dashboard Stats 旁或 Pipeline Editor Transform step 內呈現。

2. **Dashboard 取樣邏輯未告知用戶**
   - **檔案**: `src/frontend/pages/Dashboard.tsx` 第 39 行
   - **問題**: 取樣只取前 5 個 pipelines，每個取 10 筆 runs (`pipelines.slice(0, 5)` + `runs.slice(0, 10)`)。當用戶有超過 5 個 pipelines 時，取樣結果不代表全貌，但 UI 上沒告知。Stats 的 Success Rate / Rows Processed 數值會誤導。
   - **修復**: 兩選項（優先選項 A）：
     - **A**: 直接改為抓取全部 pipelines 的 runs（全量，精確）
     - **B**: 保留取樣但在 UI 上標記「Sampling: showing last N runs from M pipelines」，並在下拉選單提供時間範圍篩選

### 🟠 P1 — 影響用戶留存（應修）

3. **Destination 跳轉前無驗證**
   - **檔案**: `src/frontend/pages/PipelineEditor.tsx`
   - **問題**: 從 Destination step 點擊「Next」或「Run Pipeline」時，若用戶未輸入必要欄位（host / database / table），直接點擊「Run Pipeline」會触发 API 錯誤，而非提前預防。
   - **修復**: 在 `handleRun` 前新增 client-side 驗證，或在 Destination step 「Next」按鈕 disabled 邏輯中加入必填欄位檢查。至少要有明確的錯誤提示，而非網路錯誤後才知。

4. **零引導零 Tooltips**
   - **檔案**: 全域 UI，特別是 `PipelineEditor.tsx`
   - **問題**: 新用戶第一次使用時，沒有任何 onboarding 引導。Cron 輸入框沒有說明，Transform 的 Filter/Sort 功能沒有說明，Source/Transform/Destination 各步驟的用途不明確。處處都是「裸」的 UI。
   - **修復**: 至少在以下位置新增 tooltip：
     - Cron 輸入框 hover tooltip：「e.g. `*/5 * * * *` = 每5分鐘，`0 0 * * *` = 每日凌晨」
     - Transform Output Preview 按鈕 tooltip
     - Destination Write Mode 選項 tooltip（INSERT vs UPSERT 差異）
     - 建議使用 React tooltip library 或 custom popover

### 🟡 P2 — 長期競爭力（可分期）

5. **無 auto-save、無 flow diagram、無密碼強度指標**
   - **問題 A（auto-save）**: Pipeline Editor 編輯時，沒有定時自動儲存。若用戶關閉分頁則內容丢失。建議每 30 秒自動偵測變更並背景儲存（debounce）。
   - **問題 B（flow diagram）**: PRD 提到 Transform Editor 使用 React Flow 視覺化拖曳對應 UI，但實際實作是靜態表格式（Source Fields → input → Mapping → output → Dest）。建議在 Transform step 引入 React Flow node 視覺化。
   - **問題 C（password strength）**: Login/Register 頁面密碼輸入無強度視覺化指標（需 >= 8 字元，含數字/特殊字符等）。
   - **修復**: 列入 Phase 2，若時間允許再實作。Phase 1 專注修 P0/P1。

---

## Quality Gate 路徑

```
PRD (85) → SA+SD (85) → dev (90) → test (95) → security (95) → done
   ✅              ✅          ↑
                      Phase 1: 直接進 dev，修復優先清單
```

---

## 確認事項

請老闆確認：
1. **現有基礎評估是否正確？**（技術棧、功能清單、文件狀態）
2. **優先修復清單是否有遺漏？**（注意 Notion 提到「畫面有開但很裸，UX 不合格」）
3. **執行階段順序是否同意？**（直接進 dev，修 P0→P1→P2）

確認後回覆「可以，開始」，Worker 就會正式執行。