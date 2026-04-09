# 執行計劃 — UI ETL Tool UX/功能修復

## 現有基礎

- **技術棧**：
- **現有功能**：
- **docs/ 目錄現況**：

---

## 部署規劃

> Worker 執行前由老闆填寫，完成後寫入 `docs/.deploy_info.json`

| 欄位 | 內容 |
|------|------|
| 部署方式 | python3 http.server / Docker / PM2 / npm start |
| Port |  |
| 子網域 | e.g. myapp.qoqsworld.com |
| 反向代理 | Caddy / Nginx / Cloudflare Tunnel |
| 健康檢查 | /health 或 title 關鍵字 |
| 備註 |  |

---

## PRD 評估

- **狀態**：
- **缺的項目**：

---

## SA/SD 評估

- **狀態**：

---

## 建議執行階段

### Phase 1：PRD 階段（需 85 分，每項 >= 50 字）

| 項目 | 內容 |
|------|------|
| 產品願景 | 一段話清楚說明：這是什麼、給誰用、解決什麼問題 |
| User Story | 至少 3 個，格式：作為...我希望...以便... |
| P0/P1/P2 功能 | 每級至少 10 個具體功能，不能只有大標題，具體到工程師可以直接實作的程度 |
| 非功能需求 | 效能/可用性/擴展性/安全性 各起碼一項具體指標 |
| 技術選型 | 前端+後端+資料庫+部署工具各一個，附選擇理由 |
| UI/UX 色彩計劃 | 主色/副色/字體/佈局原則，具體色碼或方向 |
| 成功指標 | 至少 2 個可量化的 KPI |

### Phase 2：SA+SD 階段（需 85 分）

| 文件 | 內容要求 |
|------|----------|
| SA.md | 架構圖、元件職責、資料流、部署方式 |
| SD.md | API 規格、DB Schema、錯誤處理、模組介面 |

### Phase 3：dev 階段（需 90 分）

dev 階段又被細分為多個步驟，每步完成後更新 `docs/.dev_status.json` 的 `iteration` + `quality_score`：

#### Step 3.1：環境建置（10%）
- [ ] 初始化專案（package.json / docker-compose / etc）
- [ ] 設定 Git（.gitignore、branch 命名規範）
- [ ] 設定 CI/CD（如有）
- [ ] 建立第一個可運行的「空殼」並驗證 build
- [ ] Commit: `chore: initial project scaffold`

#### Step 3.2：P0 功能實作（40%）
對照 PRD 的 P0 功能，逐項實作：

- [ ] P0 功能 1
- [ ] P0 功能 2
- [ ] （依實際數量調整）
- [ ] 每完成一項即 commit（feat: implement P0 feature X）
- [ ] 完成後本地 build 驗證

#### Step 3.3：P1 功能實作（30%）
對照 PRD 的 P1 功能：

- [ ] P1 功能 1
- [ ] P1 功能 2
- [ ] （依實際數量調整）
- [ ] 每完成一項即 commit

#### Step 3.4：P2 功能實作（20%）
對照 PRD 的 P2 功能（如時間允許）：

- [ ] P2 功能 1
- [ ] P2 功能 2
- [ ] （依實際數量調整）

#### dev 階段品質標準

| 指標 | 標準 |
|------|------|
| API 實現 | 對照 SD.md 的所有端點，100% 實作 |
| 代碼質量 | 無 TODO、程式碼一致姓、無明顯壞味道 |
| 可運行 | 能啟動、build 通過、基本功能可操作 |
| Git commit | 有新 commit、消息遵守 Conventional Commits |
| 測試 | P0/P1 功能有單元測試覆蓋 |

### Phase 4：test 階段（需 95 分）

| 項目 | 標準 |
|------|------|
| 單元測試 | 覆蓋率 >= 80% |
| 整合測試 | 覆蓋所有 API |
| 測試通過率 | 100% |

### Phase 5：security 階段（需 95 分）

| 項目 | 內容 |
|------|------|
| OWASP Top 10 | 檢查常見資安漏洞 |
| 依賴漏洞掃描 | npm audit / pip audit |
| 敏感資料處理 | 確認無明文儲存 |

### Phase 6：done

所有 quality gate 達標，文件完整，部署成功。

---

## Quality Gate 路徑

```
PRD (85) → SA+SD (85) → dev (90) → test (95) → security (95) → done
```

---

## 確認事項

請老闆確認：

1. 現有基礎評估是否正確？
2. 優先修復清單是否有遺漏？
3. 執行階段順序是否同意？

確認後回覆「可以，開始」，Worker 就會正式執行。
