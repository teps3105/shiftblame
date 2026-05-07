# STAFF — 員工呼叫規格

> 三名員工：claude（Claude Code）、codex（Codex）、gemini（Gemini CLI）。
> 三方 CLI 必須分別使用不同呼叫路徑，某條失敗時診斷根因並修復，不要 fallback。

## 員工名單

| 別名 | 名稱 | 呼叫路徑 |
|------|------|---------|
| claude | Claude Code | `terminal()` + `claude -p` |
| codex | Codex | `terminal()` + `codex exec`（必須 `pty: true`）|
| gemini | Gemini CLI | `terminal()` + `gemini -p` |

## claude — Claude Code

**唯讀：**
```bash
claude -p "<prompt>" --output-format text
```

**寫入：**
```bash
claude -p "<prompt>" --dangerously-skip-permissions --output-format text
```

已知問題：`claude mcp serve` 不載入 agents，`mcp_claude_code_Agent` 無法使用。解法：`terminal()` 直接呼叫。

## codex — Codex

**唯讀/寫入：**
```bash
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
```

此環境 bubblewrap sandbox 啟動失敗（`bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`），必須帶 `--dangerously-bypass-approvals-and-sandbox`。

**Codex exec 注意事項：**
- **必須 PTY 模式**：非 PTY 環境會卡 stdin。`terminal()` 必須帶 `pty: true`
- `~/.codex/skills/` 下的 SKILL.md 缺 frontmatter 會報錯（不影響執行）
- **exit_code 124**：偶發
- **禁止 pipe 到 tail/head**：pipe buffer 64KB 塞滿會卡死

**MCP 不相容：** Codex MCP server 發送非標準 `codex/event` 通知，MCP client 驗證失敗 → 恆定 timeout。結論：`terminal()` 直接呼叫。

## gemini — Gemini CLI

**唯讀：**
```bash
GEMINI_CLI_TRUST_WORKSPACE=true gemini -p "prompt" -o text
```

**寫入（yolo）：**
```bash
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
```

> `--approval-mode` 必須在 `-p` 之前，否則解析失敗。

**讀取框架定義檔：**
```bash
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text \
  --include-directories="<框架定義檔路徑>" \
  -p "prompt"
```

**Workspace 存取限制：**
- `read_file` 拒絕 `.gitignore` 內路徑（如 `.shiftblame/`）→ prompt 中指示用 `cat` 讀取
- 框架定義檔不在 workspace → 需 `--include-directories` 指定路徑

**Approval Mode 與工具：**

| 模式 | write_file | run_shell_command | 結論 |
|------|-----------|-----------------|------|
| default | 攔截 | 攔截 | 不可寫入 |
| auto_edit | 攔截 | 攔截 | 不可寫入 |
| yolo | 可用 | 可用 | 寫入必用 |
| plan | 不可用 | 不可用 | 純唯讀 |

**完整工具清單（13）：** update_topic, list_directory, read_file, grep_search, glob, google_web_search, enter_plan_mode, invoke_agent, activate_skill, replace, write_file, run_shell_command, ask_user

**已知問題：** 429 MODEL_CAPACITY_EXHAUSTED — Google 伺服器端容量問題，內建 retry with backoff。

## Prompt 模板

### Proposal 階段（只分析不執行）

```text
你是 <DEPT> 部門的 <cli> 員工。

【步驟 1】讀取以下檔案：
- 用 cat 讀取 <通訊目錄>/task.md
- 用 cat 讀取 <框架定義檔路徑>/DEPT/<DEPT>.md
- 用 cat 讀取 <框架定義檔路徑>/MANAGER.md
- 用 cat 讀取 <框架定義檔路徑>/STAFF.md

【步驟 2】根據 task.md 進行分析

【步驟 3】將分析結果寫入 <通訊目錄>/<cli>/proposal.md

重要：
- 用繁體中文產出
- 這是提案階段，只分析不執行
- 用 write_file() 寫入自己子目錄的 proposal.md
- 禁止寫入其他員工子目錄、task.md、consensus.md 等管理者文件
- 必須引用具體檔案內容
- .shiftblame/ 下的檔案一律用 cat 讀取
```

### Result 階段 — 主執行者（依共識執行，僅執行部門）

```text
你是 <DEPT> 部門的 <cli> 員工（主執行者）。

【步驟 1】讀取以下檔案：
|- 用 cat 讀取 <通訊目錄>/task.md
|- 用 cat 讀取 <通訊目錄>/consensus.md（001）/ 沿用 001 的 consensus.md（002+）
|- 用 cat 讀取 <通訊目錄>/<cli>/review.md（002+ 時讀取上一輪 review 作為修正依據）
|- 用 cat 讀取上一個執行部門的 result.md（循環上游輸入）
|- 用 cat 讀取 <框架定義檔路徑>/DEPT/<DEPT>.md
|- 用 cat 讀取 <框架定義檔路徑>/MANAGER.md
|- 用 cat 讀取 <框架定義檔路徑>/STAFF.md

【步驟 2】依 consensus.md 執行分工任務（002+ 依 review.md 修正）

【步驟 3】將結果寫入 <通訊目錄>/<cli>/result.md

重要：
|- 用繁體中文產出
|- 用 write_file() 寫入自己子目錄的 result.md
|- 禁止寫入其他員工子目錄、task.md、consensus.md 等管理者文件
|- worktree 權限依 task.md 與 MANAGER.md 規則判定（僅 DEV 可修改 worktree）
|- .shiftblame/ 下的檔案一律用 cat 讀取
|- result.md 必須包含實際執行成果（完成的檔案、測試結果、驗證證據）
```

### Review 階段 — 輔助者（檢視不修改，僅執行部門 001+）

```text
你是 <DEPT> 部門的 <cli> 員工（輔助者）。

【步驟 1】讀取以下檔案：
|- 用 cat 讀取 <通訊目錄>/task.md
|- 用 cat 讀取 <通訊目錄>/consensus.md
|- 用 cat 讀取 <通訊目錄>/<主執行者>/result.md（主執行者的實際成果）
|- 用 cat 讀取上一個執行部門的 result.md（循環上游輸入）
|- 用 cat 讀取 <框架定義檔路徑>/DEPT/<DEPT>.md
|- 用 cat 讀取 <框架定義檔路徑>/MANAGER.md
|- 用 cat 讀取 <框架定義檔路徑>/STAFF.md

【步驟 2】檢視主執行者的 result.md，對照 consensus.md 驗證：
|- 任務完成度：所有 AT 是否已實作
|- 測試結果：是否全綠、數量是否達標
|- 安全對照：SA 斷言是否全部滿足
|- 規格一致性：是否符合 DEPT 定義的產出規格

【步驟 3】將檢視結果寫入 <通訊目錄>/<cli>/review.md

重要：
|- 用繁體中文產出
|- 用 write_file() 寫入自己子目錄的 review.md
|- review.md 只檢視不修改：發現問題列出來，不直接修改 worktree
|- 禁止寫入其他員工子目錄、task.md、consensus.md 等管理者文件
|- .shiftblame/ 下的檔案一律用 cat 讀取
|- review.md 格式：通過項目 / 問題清單（附具體證據）/ 判定建議（PASS 或 NEEDS_FIX）
```

### 各員工讀取補充

**claude / codex：** task.md 和定義檔用 cat 讀取，write_file() 寫入 proposal.md / result.md / review.md。

**gemini：** `.shiftblame/` 下檔案一律用 cat 讀取（不要用 read_file），框架定義檔可直接用 read_file，write_file() 寫入。

### 管理者 Poll 流程

1. 派工三方 background process（notify_on_complete=true）
2. 每 30 秒 poll 各子目錄 proposal.md / result.md / review.md 是否有內容（嗅探機制）
3. 研究部門：三方 proposal.md 完成 → 管理者彙整 conclusion.md
4. 執行部門 001：三方 proposal.md → 管理者寫 consensus.md → 主執行者 result.md + 輔助者 review.md → 管理者判定
5. 執行部門 002+：主執行者 result.md + 輔助者 review.md → 管理者判定（通過或開新 NNN）

管理者不代寫員工的 proposal.md / result.md。權限問題時診斷根因並修復參數。

## MCP 配置

### 各員工原生 MCP 管理

**Claude Code：** 配置在 `~/.claude/settings.json` 的 `mcpServers` 或 plugin 安裝。

**Codex：**
```bash
codex mcp add <NAME> -- <COMMAND> [ARGS...]
codex mcp list
codex mcp remove <NAME>
```

**Gemini：**
```bash
gemini mcp add -s user <NAME> <COMMAND> [ARGS...]
gemini mcp list
```

### 已配置 MCP servers

| Server | Claude | Codex | Gemini |
|--------|:------:|:-----:|:------:|
| searxng（SEARXNG_URL=localhost:30045） | ✓ | ✓ | ✓ |
| chrome-devtools-mcp | ✓（plugin） | ✓ | ✓ |

### MCP Server 註冊狀態（透過調度器）

| Server | Command | Tools | 狀態 |
|--------|---------|-------|------|
| claude-code | `claude mcp serve` | 24 | Agent tool 不可用，Bash/Read/Edit/Write 正常 |
| codex | `codex mcp-server` | 2 | 恆定 timeout（通知不相容） |
| searxng | `npx -y mcp-searxng` | all | 正常 |
| chrome-devtools | `npx -y chrome-devtools-mcp` | all | 正常 |

### MCP 除錯

**Circuit Breaker：** 3 次連續失敗，60 秒冷卻，半開探測。依調度器指令重設 MCP 連線。

**Timeout：** 預設 120 秒。依調度器配置調整。

**MCP 通知：** 調度器只處理 ToolListChanged / PromptListChanged / ResourceListChanged。未知類型忽略。

## 失敗處理

### 失敗代碼

| 代碼 | 情境 | 處理 |
|------|------|------|
| CLI_UNAVAILABLE | 服務不可用 | 重試 1-2 次，仍失敗吸收或退回 |
| RATE_LIMITED | 速率限制（429） | 等待後重試 |
| QUOTA_EXCEEDED | 配額用盡 | 吸收或退回上游 |
| TIMEOUT | 執行超時 | 重試，仍失敗吸收或退回 |
| EXEC_FAILED | 執行失敗 | 吸收或退回 |
| EMPTY_OUTPUT | 輸出為空 | 重試，仍失敗吸收或退回 |
| AUTH_FAILURE | 認證失敗 | 診斷根因，報告管理者 |
| SERVICE_OVERLOADED | 服務過載（503/529） | 等待後重試 |

### 吸收策略

1. **重試**（內建 retry）
2. **吸收**：其餘兩個員工接手份額
3. **退回上游**：全部失敗回報管理者

## 已知問題

- **background process 禁止 pipe 到 tail/head/awk**：輸出量大時 pipe buffer 64KB 塞滿卡死
- **併發重試**：三方併發容易失敗時，確認調度器重試次數 ≥ 3

## 用語

- **CLI = 員工本人**：不用 Proxy 或 subagent 稱呼
- **搜尋一律用 searxng MCP**：員工需要搜尋時用 searxng 工具，禁止 web_search
