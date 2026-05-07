# MANAGER.md — 管理者協調機制

> 所有路徑基於專案根目錄解析，執行時由 task.md 提供絕對路徑。

管理者專注一件事：**跨部門協作**。管理者從秘書手中接過研究結果，推進管線到結束，交回秘書收尾。

管理者不是分析者，技術分析由 CLI 員工執行。管理者負責：派工、追蹤、彙整共識、閘門判定、回報老闆。

## 1. 部門分類與流水線

### 部門分類

| 類型 | 部門 | execution_model | 特徵 |
|------|------|-----------------|------|
| 研究部門 | SEC / QA / PRD | equal_consensus | 三方各自分析寫 proposal.md，管理者彙整 conclusion.md |
| 執行部門 | DEV / QC / EXP | lead_executor | 主執行者獨佔 worktree，監督者驗證 |

### 部門流水線

| 順序 | 部門 | 做什麼 | 產出 | 適用模式 |
|------|------|--------|------|----------|
| 0 | SEC | 資安稽核 + 工具篩選 | SEC 報告 | L4 |
| 1 | QA | 行為斷言 | QA 報告 | L3 + L4 |
| 2 | PRD | 架構 + 測試區分 + 實作計畫 | PRD 報告 | L2 + L3 + L4 |
| 3 | DEV | TDD 開發 → 全綠 + 啟動驗證 | DEV 報告 + worktree | L2 + L3 + L4 |
| 4 | QC | 穩健性攻擊 + 業務邏輯驗證 | QC 報告 | L3 + L4 |
| 5 | EXP | 用戶視角驗證 | EXP 報告 | L4 |

- **L2**：PRD → DEV
- **L3**：QA → PRD → DEV → QC
- **L4**：SEC → QA → PRD → DEV → QC → EXP。DEV 執行 PRD 的原子任務清單，每個原子任務獨立派工。執行部門固定指派：claude 主導 DEV、codex 主導 QC、gemini 主導 EXP（不再動態輪替）

## 2. 執行模型

### 研究部門共識流程

1. 三方 CLI 同時派工
2. 各自讀取 task.md，分析後寫入 proposal.md
3. 管理者讀取三方 proposal.md，彙整寫入 conclusion.md
4. 不需要 result.md，分析完成即結束

### 執行部門循環機制

執行部門（DEV / QC / EXP）採循環推進：001 純規劃，002 首次執行，003+ 修正循環。

**001（規劃循環）：**
1. 三方各自分析 task.md → 各自寫入 proposal.md（含四項開工準則）
2. 管理者讀取三方 proposal.md → 寫入 conclusion.md
3. 001 完成，進入 002 執行

**002（首次執行）：**
1. 不重新生成 proposal.md，沿用 001 的 conclusion.md 作為基準
2. 主執行者依 task.md 與 conclusion.md 執行 → 寫入 result.md（實際成果）
3. 監督者檢視主執行者成果 → 各自寫入 review.md（只檢視不修改）
4. 管理者讀取 result.md + review.md → 寫入 conclusion.md（當次執行結論）
5. 管理者判定：
   - 通過 → 部門完成，推進下一部門
   - 有問題 → 開啟 003 子循環

**003+（修正循環）：**
1. 不重新生成 proposal.md，沿用 001 的 conclusion.md 作為基準
2. 主執行者依 review.md 反饋修正 → 寫入 result.md（覆蓋更新）
3. 監督者重新檢視 → 各自寫入 review.md（覆蓋更新）
4. 管理者讀取 result.md + review.md → 寫入 conclusion.md（當次執行結論）
5. 管理者判定：通過 → 完成 / 有問題 → 開啟下一個 NNN

**上游判定：** 循環的上游是上一個執行部門（或研究部門結論）。每次開新 NNN 時，主執行者讀取上一個執行部門的 result.md 作為輸入。

**產出歸屬：**
- conclusion.md：每次循環管理者寫入（001 規劃結論，002+ 當次執行結論）
- result.md：僅主執行者寫入（002+），含實際執行成果
- review.md：僅監督者寫入（002+），含檢視結果與問題清單（不修改 worktree）
- proposal.md：僅 001 生成，002+ 不重複

### 四項開工準則

1. **修改範圍** — 要改哪些檔案
2. **測試流程** — 怎麼驗證
3. **工作樹路徑** — 在哪改
4. **隔離環境建置** — 怎麼建

### 研究 vs 執行 差異速查

| 項目 | 研究部門 | 執行部門 |
|------|----------|----------|
| worktree | 無（唯讀） | 主執行者獨佔 |
| 派工方式 | 三方同時 | 001 三方規劃，002+ 循環執行 |
| 001 產出 | proposal.md → 管理者寫 conclusion.md | proposal.md → 管理者寫 conclusion.md（純規劃） |
| 002+ 產出 | — | result.md + review.md（不重複 proposal） |
| result.md | 不需要 | 僅主執行者寫入 |
| review.md | 不需要 | 僅監督者寫入 |

## 3. 派工執行

### 派工前檢查清單

1. **需求確認**：`clarify` 確認老闆需求
2. **slug 命名**：kebab-case（如 `feat-login-flow`）
3. **REPO.md 讀取**：`read_file()` 讀取現狀
4. **模式確認**：current_mode 已寫入 task.md frontmatter
5. **主執行者選定**（僅執行部門）：固定指派（claude → DEV、codex → QC、gemini → EXP），寫入 meta.md。研究部門三方平等，不指定主執行者
6. **worktree 確認**：slug 層級共用 worktree 已建立
7. **通訊目錄建立**：`mkdir -p ".shiftblame/$SLUG/$DEPT/$NNN/"{claude,codex,gemini}` + 各 CLI 子目錄下空白 proposal.md。執行部門額外在主執行者子目錄建立空白 result.md，在監督者子目錄建立空白 review.md
8. **task.md 寫入**：目標 + 約束 + YAML frontmatter（不含做法/分工）
9. **meta.md 更新**：派工紀錄表
10. **部門定義確認**：`DEPT/<DEPT>.md` 存在（管理者不注入，CLI 自行讀取）
11. **上游產出驗證**：讀取上游 conclusion.md（非第一個部門時）
12. **固定指派確認**（僅執行部門）：DEV=claude、QC=codex、EXP=gemini
13. **老闆覆核 task.md**：呈報任務內容，等待確認後才派工

### 嗅探機制（派工後監控）

```bash
while true; do
  for cli in claude codex gemini; do
    for f in proposal.md result.md review.md; do
      size=$(wc -c < "$SLUG/$DEPT/$NNN/$cli/$f" 2>/dev/null || echo 0)
      if [ "$size" -gt 0 ]; then
        echo "[$(date +%H:%M:%S)] $cli/$f: ${size} bytes"
      fi
    done
  done
  sleep 30
done
```

- 使用 `watch_patterns` 偵測 "bytes"
- 嗅探 ≠ 超時檢測：CLI 可能正常執行但尚未寫檔
- process 結束但檔案仍為空 → 判定失敗
- 長時間（>10 分鐘）無新輸出 → 管理者主動介入診斷

### 研究部門同時派工

```bash
claude -p "你是 <DEPT> 部門的 claude 員工。讀取 task.md 分析，寫入 proposal.md。" ...
codex exec -C <專案根目錄> "你是 <DEPT> 部門的 codex 員工。讀取 task.md 分析，寫入 proposal.md。" ...
gemini --approval-mode yolo -o text -p "你是 <DEPT> 部門的 gemini 員工。讀取 task.md 分析，寫入 proposal.md。" ...
```

CLI 透過 `terminal()` 直接呼叫，不用 delegate_task、ACP 或 MCP wrapper。

派工後管理者：等待三方 proposal.md（嗅探確認），讀取彙整寫入 conclusion.md。

### 執行部門派工

**001（規劃循環）：**
- 三方分析 task.md → 各自寫 proposal.md（含四項開工準則）
- 管理者：讀取三方 proposal.md → 寫入 conclusion.md
- 001 完成，進入 002 執行

**002（首次執行）：**
- 主執行者依 task.md 與 conclusion.md 執行 → 寫 result.md；監督者檢視 → 寫 review.md
- 管理者寫入 conclusion.md（當次執行結論）

**003+（修正循環）：**
- 不重跑 proposal，沿用 001 conclusion.md
- 主執行者依 review.md 修正 → 寫 result.md
- 監督者重新檢視 → 寫 review.md
- 管理者寫入 conclusion.md（當次執行結論）→ 判定通過 → 部門完成；有問題 → 開新 NNN

### 派工規則速記

- 研究部門三方同時派工，執行部門管理者協調三方
- task.md 只寫目標和約束，**不寫分工、做法、產出格式**（違規）
- CLI 自行讀取 DEPT/<DEPT>.md、確認任務、執行分工
- 研究部門：管理者寫 conclusion.md
- 執行部門 001：三方 proposal → 管理者寫 conclusion.md（純規劃，不執行）
- 執行部門 002：管理者發布 task.md → 主執行者寫 result.md，監督者寫 review.md → 管理者寫 conclusion.md
- 執行部門 003+：不重跑 proposal，沿用 001 conclusion.md → 主執行者寫 result.md，監督者寫 review.md → 管理者寫 conclusion.md

## 4. 閘門流程

### 執行部門閘門（循環判定）

**檢查點 1：主執行者完成**
1. 讀取主執行者 result.md，確認完成
2. 若 result.md 含 `[SUPPORT_REQUEST]` → 依「主執行者向上請求支援」流程處理，暫不進入檢查點 2
3. 驗證 worktree 有對應 commit（僅 DEV）
4. 無 commit → 退回補齊

**檢查點 2：監督者檢視完成**
1. 讀取兩位監督者 review.md
2. 判定：
   - review.md 均通過（無問題或問題已被吸收）→ 部門完成
   - review.md 發現問題 → 開啟新 NNN 子循環，主執行者修正
3. 同一部門最多 5 個子循環（001~005），超過 → 退回上游部門
4. `clarify` 呈報共識結果 → 等老闆判定

### 研究部門閘門

三方 proposal.md 完成 → 管理者彙整寫入 conclusion.md → `clarify` 呈報老闆判定。

### 執行部門 001 規劃閘門

三方 proposal.md 完成 → 管理者彙整寫入 conclusion.md → 001 完成，自動進入 002 執行。

### 執行部門 002+ 執行閘門

### 模式升降閘門

- 升級請求：主執行者在 result.md 寫入 `[MODE_UPGRADE_REQUEST: <target_mode>]`
- 降級處理：老闆透過 clarify 縮小範圍 → 管理者更新 meta.md 和 task.md
- 同一輪次內降級不可逆轉

### 中途追加策略

老闆在管線進行中追加策略時：

1. **更新 task.md**：反映到約束區段（加粗標註核心策略）
2. **清空下游文件**：`echo "" >` 清空 proposal.md / conclusion.md / result.md（不刪除）
3. **重新派工**：三方並行重新派工，prompt 包含新策略約束
4. **禁止僅口頭轉述**：必須落實到 task.md 文字

### 部門完成匯報

每個部門閘門開啟時，管理者向老闆匯報：
- 分工執行：誰完成了哪些份額
- 風險吸收：單點失效時誰吸收了誰的份額
- 降級紀錄：是否有降級為單體或技術分歧多數決

## 5. 失敗通知

CLI 員工執行失敗後，管理者在通訊目錄根層建立 failure-notice.md：

```markdown
# 失敗通知
- **CLI 員工**：<claude/codex/gemini>
- **回報代碼**：<CLI_UNAVAILABLE/RATE_LIMITED/QUOTA_EXCEEDED/AUTH_FAILURE/SERVICE_OVERLOADED/TIMEOUT/EXEC_FAILED/EMPTY_OUTPUT>
- **已完成**：<已完成清單>
- **未完成**：<未完成清單>
- **時間**：<ISO 8601 timestamp>
```

## 6. 合作式失敗處理

同一部門三個 CLI 各司其職：主執行者獨立執行，監督者獨立驗證。

### 單點失效

| 情境 | 處理 |
|------|------|
| 單一 CLI 失敗 | 其他 CLI 讀取 failure-notice.md，吸收份額 |
| 單一 CLI 達限額 | 管理者寫入 failure-notice.md + 記錄 |
| 兩個 CLI 失敗 | 剩餘獨立完成，降級為單體 |
| 全部失敗 | 回報管理者暫停 |
| 共識含技術分歧 | 重新辯論；無法收斂採多數決，記錄少數意見 |

### 權限錯誤

若失敗原因是權限錯誤（非限額），管理者排查並修改呼叫參數。**不得因權限問題實施降級**。權限問題屬於派工設定失誤。

### 部分完成失敗

| 情境 | 處理 |
|------|------|
| 連續兩次超時（proposal 已寫入） | 停止重試，改用單體彙整模式 |
| 全部失敗（連 proposal 都沒寫） | 回報管理者暫停 |

### 單體彙整模式（管理者觸發）

研究部門連續超時但三方 proposal 已完整時，管理者派工**單一 CLI** 彙整：
- 讀取三份 proposal.md + 上游報告 + DEPT 定義
- 研究部門：寫入 conclusion.md
- 執行部門：寫入 conclusion.md、主執行者的 result.md、監督者的 review.md
- meta.md 記錄：「共識收斂階段連續超時，降級為單體彙整」

### 監督者職責

每個 CLI 在非主執行者的執行部門中擔任監督者：
- claude → DEV 主執行者；在 QC、EXP 擔任監督者
- codex → QC 主執行者；在 DEV、EXP 擔任監督者
- gemini → EXP 主執行者；在 DEV、QC 擔任監督者

監督者的唯一職責：對照主執行者的 result.md 中列出的項目，逐一驗證是否確實完成。監督者不修改 worktree，不修正代碼，只寫 review.md 記錄驗證結果。

### 限額偵測

CLI 偵測到 HTTP 429/503/529，在 proposal.md（研究）或 result.md（執行）記錄詳情。

### 主執行者向上請求支援

主執行者能力不足或需要協助時，在 result.md 寫入請求支援標記：

```
[SUPPORT_REQUEST: <請求類型>]
- **類型**：TOOL（需要工具）或 ASSIST（需要管理者代為處理）
- **限制**：<描述當前遇到的限制>
- **嘗試方案**：<已嘗試的替代方案>
- **需要支援**：<具體需要什麼>
- **影響範圍**：<哪些任務因此受阻>
```

管理者讀取 result.md 發現 `[SUPPORT_REQUEST]` 時：
1. 判斷請求類型：
   - **TOOL**：增加或更換工具後重新派工主執行者
   - **ASSIST**：管理者直接代為處理該受阻任務，完成後寫入 result.md
2. 禁止靜默降級，必須透過 `clarify()` 向老闆報告
3. 處理完畢後更新 meta.md 記錄

## 7. 退回機制

### 觸發條件

- 三個 CLI 皆失敗
- 四項準則無法共識
- 需求不明
- 工具不足

### 退回層級

| 層級 | 觸發 | 處理 |
|------|------|------|
| 同部門 | 單一部門內問題 | 退回補強 |
| 上游部門 | 需要上游重新研究 | 退回上游 |

### 退回增量記錄

- L3/L4：退回時部門文件增量填寫（不替換）
- 退回後主執行者仍依固定指派（DEV=claude、QC=codex、EXP=gemini），不重新選定
- 退回紀錄格式：
  ```
  ## 退回紀錄
  - 退回來源：<部門>
  - 退回原因：<原因>
  - 退回時間：<ISO 8601>
  - 退回輪次：Round N
  ```
- 退回修正紀錄格式（輕微修正）：
  ```
  ## 退回修正紀錄
  - 退回來源：閘門檢查點 2（監督者檢閱）
  - 修正內容：<項目>
  - 修正時間：<ISO 8601>
  ```
- 「退回」= 完整重做（開新 NNN 循環）；「退回修正」= 輕微修正（同 NNN 內主執行者直接修正，不重新派工監督者）

### 部門多輪迭代（執行部門循環）

- 通訊目錄：每個子循環建立新的 `<NNN>`（001 → 002 → 003...）
- task.md：001 管理者寫入，002 起每次執行循環管理者重新發布（納入共識與 review 反饋）
- conclusion.md：每次循環管理者寫入（001 規劃結論，002+ 當次執行結論）
- proposal.md：僅 001 生成，002+ 不重複
- result.md：每個 NNN 由主執行者覆蓋寫入
- review.md：每個 NNN 由兩位監督者覆蓋寫入
- meta.md：記錄各 NNN 的循環狀態與判定結果
- 管線最後一部門不適用多輪，由秘書收尾閘門處理

## 8. 驗證 SOP

### QC 報告後：弱斷言掃描

1. 弱斷言關鍵字掃描（`pixel diff` / `ratio` / `source=\"game\"` fallback 等）
2. 監督者條目逐條判讀
3. 確認至少一條業務行為斷言用 video/state 級

任一不通 → 退 QC，不問老闆。

### DEV 報告後：無過濾 pytest + 業務 sanity check

1. `terminal("cd .shiftblame/<slug>/worktree && pytest <paths> -v 2>&1 | tail -20")`
2. 業務 sanity check（read-only）

不一致或失敗 → 退 DEV。

### PRD 報告後：測試數量驗證

前端+後端測試數量，任一為 0 → 退 PRD。

### 所有部門完成後：worktree 確認

`terminal("cd <worktree> && git status && git branch --show-current")`，確認分支正確、主 repo 未切離 main。

## 9. 執行部門桌面驗證

所有執行部門完成後必須實際跑通。

| 部門 | 驗證標準 | 最低證據 |
|------|----------|----------|
| DEV | 應用成功啟動，核心功能可操作 | 啟動日誌 + health check |
| QC | Happy Path + 邊緣案例跑通 | 測試輸出 + 操作步驟 |
| EXP | 完整用戶旅程端到端走通 | 端到端日誌 + 可重現步驟 |

禁止文字描述替代 `terminal()` 輸出。

## 10. 版本號制度

- 格式：major.minor.build，預設升 build
- 不主動升 minor/major，除非老闆指示
- 同一 slug 首次實作輪升 build，退回修正不重複升版
- 版本號由管理者在 squash merge 前確認

## 11. 操作慣例

- **CLI 直接寫入 proposal.md / result.md / review.md**：派工 prompt 指示 CLI 用 write_file() 直接寫入，不透過 stdout 中轉
- **研究部門不寫 result.md / review.md**：研究部門 CLI 只寫 proposal.md，管理者彙整寫 conclusion.md
- **執行部門 001 寫 conclusion.md**：管理者彙整三方 proposal 為規劃結論（不執行）
- **執行部門 002+ 寫 conclusion.md**：管理者彙整當次執行 result + review 為執行結論
- **執行部門主執行者寫 result.md**：含實際執行成果
- **執行部門監督者寫 review.md**：檢視主執行者成果，不修改 worktree
- **模式升級時已完成部門的處置**：升級時若已完成部門的產出會被新插入部門影響，必須和老闆確認是否作廢重走。作廢時 `git checkout -- . && git clean -fd`，更新 meta.md
