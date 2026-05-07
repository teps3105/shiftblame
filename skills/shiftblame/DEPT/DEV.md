# DEV — 開發部門

> 適用模式：L2 + L3 + L4

## 職責

- 依 PRD 的 DAG 與測試區分，按模組拓撲實作
- 實作順序：DB → 後端 → 前端
- TDD 開發至測試全綠（unit + integration，不含 E2E）
- DAG 中 QC 可操作介面必須完整實作
- 測試全綠後啟動應用驗證功能可運行
- Commit 前語法檢查（parse check / lint）
- 撰寫 devlog

## 執行模型

開發部門。execution_model: lead_executor。
主執行者固定為 claude，codex 與 gemini 固定擔任監督者（各從不同面向）。001 三方 proposal → 管理者寫 conclusion（純規劃）→ 002 管理者發布 task.md → claude 實作 → codex 與 gemini 各從不同面向監督。
003+ 修正循環：管理者重新發布 task.md → claude 依 review.md 修正 → codex 與 gemini 重新檢視。退回時仍由 claude 擔任主執行者。
**主執行者獨佔 worktree 編輯權與 Git 操作權。**
監督者寫 review.md 檢視成果，不修改 worktree。具備受限寫入權（限 typo、版本號不一致、小規格偏差），修正後由主執行者 commit。

### 監督者面向分工

兩位監督者從不同面向檢視主執行者成果：

| 監督者 | 面向 | 檢視重點 |
|--------|------|----------|
| codex | 邏輯正確性 + 測試覆蓋度 | 靜態分析、代碼審查、邏輯分支完整性、測試覆蓋度、邊界條件處理 |
| gemini | 功能完整性 + 規格一致性 | 對照 PRD 驗證需求覆蓋、功能端到端完整性、規格偏差、遺漏功能 |

## 產出規格

路徑：`.shiftblame/<slug>/DEV/<NNN>/`
- `claude/result.md` — claude 寫入（固定主執行者）
- `codex/review.md` — codex 寫入（固定監督者，面向：邏輯正確性 + 測試覆蓋度）
- `gemini/review.md` — gemini 寫入（固定監督者，面向：功能完整性 + 規格一致性）

### devlog 必備
1. 實作檔案清單與路徑（按職能分組）
2. 各職能產出摘要
3. 關鍵設計決定
4. 已執行的重構
5. 踩坑與繞行記錄
6. 綠燈執行證據（terminal() 輸出摘要）
7. 啟動應用驗證證據
8. 參考的團隊歷史檔名

### 完工回報強制欄位
- 測試指令與 stdout 尾 10 行
- failed、error、collection error 數
- build 或 check 指令與 exit code（有前端改動時）
- 本輪 commit hash

## 運作規則

**R1 以 PRD DAG 為唯一實作依據**
按模組拓撲順序落地，避免跳接或逆序。DAG 是唯一藍圖。

**R2 分層相依順序實作**
資料層 → 服務層 → 介面層，先完成下游依賴再往上層整合。

**R3 TDD 全綠**
至少 unit + integration。DEV 不跑 E2E。完成標準：所有測試通過。

**R4 QC 可操作介面完整落地**
DAG 標示為 QC 可操作的介面必須完整實作，不可留空 UI 或 API 端點。

**R5 啟動驗證不可替代**
測試全綠後必須實際啟動應用驗證可運行。不能以測試結果替代啟動驗證。

**R6 Commit 前語法檢查**
執行對應技術棧的 parse/check/lint，確保基本可編譯。

**R7 撰寫 devlog**
每次循環記錄變更檔案、關鍵決策、重構、踩坑、驗證證據。

**R8 桌面驗證**
DEV 驗證標準：應用/服務成功啟動，核心功能可操作。最低證據：`terminal()` 啟動日誌 + health check 回應。

**R9 分歧內部解決**
實作分歧由 CLI 辯論收斂（最多 2 輪），異議須附替代方案與可驗證證據。僅需求不明時透過管理者與老闆溝通。

**R10 全量測試順序執行**
一次只跑一條線（sequential），不 parallel，避免搶 mock 服務導致 flaky。

**R11 DAG 常規執行**
L2/L3/L4 模式皆依 DAG 常規執行，按模組拓撲順序落地。

## 管理者 E2E 實際驗證閘門

DEV 部門監督者 review 通過後，進入 QC 之前，**管理者必須親自執行 E2E 實際驗證，通過後交由老闆覆核**。

### 驗證流程

1. 管理者讀取 DEV 最終 conclusion.md + claude/result.md
2. 管理者實際啟動應用，以使用者身份操作端到端流程
3. 管理者驗證：
   - 核心功能路徑端到端走通（非單一功能點）
   - 前端介面實際可操作（Web SPA 透過 chrome-devtools-mcp）
   - QA 斷言覆蓋的核心場景可重現
4. 管理者寫入 E2E 驗證結果到 DEV conclusion.md（追加段落）
5. 管理者 E2E 判定：
   - 不通過 → 退回 DEV 開新 NNN 修正，修正後管理者再次 E2E 驗證
   - 通過 → 呈報老闆覆核（`clarify`）
6. **老闆覆核**：管理者呈報 E2E 驗證結果，老闆判定：
   - 確認通過 → 推進 QC
   - 不通過或有疑慮 → 退回 DEV 開新 NNN 修正，修正後重新走 E2E + 老闆覆核

### QC 退回 DEV 後的 E2E

QC 退回 DEV 修正完成後，管理者**必須再次執行 E2E 實際驗證 + 老闆覆核**，通過後才可重新進入 QC。不可跳過。

### 最低證據

- 應用啟動 terminal() 輸出
- 端到端操作步驟紀錄（含截圖路徑或 console logs）
- 管理者判定結論（PASS / FAIL）
- 老闆覆核結果

## 認知模型

**品質基線**：主執行者產出須通過監督者 review.md 逐條驗證（codex 面向邏輯正確性+測試覆蓋度、gemini 面向功能完整性+規格一致性），再通過管理者 E2E 實際驗證 + 老闆覆核，才可進入 QC。
**執行隔離改變除錯**：除錯依賴 stdout/stderr 而非斷點。每個步驟都必須有可觀察的 terminal() 輸出。
