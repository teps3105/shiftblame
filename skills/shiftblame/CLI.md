# CLI.md — CLI 員工呼叫機制

> 三名 CLI 員工：claude（Claude Code）、codex（Codex）、gemini（Gemini）。

## 1. CLI 員工名單

| 別名 | CLI 名稱 |
|------|---------|
| claude | Claude Code |
| codex | Codex |
| gemini | Gemini CLI |

## 2. 呼叫規格

### claude（Claude Code）

**唯讀模式：**
```bash
claude -p "<prompt>" --output-format text
```

**寫入模式（bypass）：**
```bash
claude -p "<prompt>" --dangerously-skip-permissions --output-format text
```

**已知問題：**
- `claude mcp serve`（MCP server 模式）**不載入 agents**。CLI 互動模式有 16 個 agents（含 general-purpose），但 MCP server 回報 "Available agents:" 為空。因此 `mcp_claude_code_Agent` 工具無法使用。
- 解法：不走 Hermes MCP wrapper，改用 `terminal()` 直接呼叫 `claude -p`。
- `--dangerously-skip-permissions` 需要 sandbox 環境配合（無網路存取）。

### codex（Codex）

**唯讀/寫入模式（full-access）：**
```bash
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
```

> ⚠️ 此環境中 bubblewrap sandbox 啟動失敗（`bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`），導致所有 shell 命令無法執行。**必須**使用 `--dangerously-bypass-approvals-and-sandbox` 完全跳過 sandbox。`-c approval_policy=never` 或 `-s read-only` 不夠，因為 sandbox 本身就啟動不了。

**已知問題 — Hermes MCP 不相容：**
- Codex MCP server（`codex mcp-server`）發送非標準 `codex/event` 通知方法。
- Hermes MCP client 使用 Pydantic 嚴格驗證通知 method，只接受 MCP spec 定義的通知類型（`notifications/tools/list_changed` 等），遇到 `codex/event` 直接拋 `literal_error`。
- Codex 在寫入操作時發送 `apply_patch_approval_request`，Hermes 不處理此事件，導致 Codex 等待 approval 永遠不來 → timeout。
- Circuit breaker（3 次連續失敗）觸發後需等 60 秒冷卻。
- **結論**：Codex MCP server 目前與 Hermes MCP client 不相容。解法：不走 Hermes MCP wrapper，改用 `terminal()` 直接呼叫 `codex exec`。

**Codex exec 注意事項：**
- **⚠️ 必須使用 PTY 模式**：`codex exec` 在非 PTY 環境下會嘗試讀 stdin（顯示 "Reading additional input from stdin..."）然後無限期卡住。派工時**必須**帶 `pty: true`，否則 codex 永遠不會開始執行。即使帶了 `--dangerously-bypass-approvals-and-sandbox` 也一樣會卡 stdin。
- `~/.codex/skills/` 下的 SKILL.md 若缺少 YAML frontmatter 會報錯（不影響執行）。
- **exit_code 124**：已知問題，codex 偶爾以 124 退出。
- **⚠️ 禁止 pipe 到 tail/head/awk 等緩慢消費者**：codex 輸出量大，若透過 pipe 傳給 `tail -5` 等只消費少量資料的命令，Linux pipe buffer（64KB）會塞滿，導致 codex 的 stdout write 被 block，程序無限期卡死。background process 派工時不要加 `| tail`。

### gemini（Gemini CLI）

**唯讀指令：**
```bash
GEMINI_CLI_TRUST_WORKSPACE=true gemini -p "prompt" -o text
```

**寫入指令（yolo 模式）：**
```bash
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
```

> ⚠️ **參數順序很重要**：`--approval-mode` 必須放在 `-p` **之前**。若寫成 `gemini -p "prompt" --approval-mode yolo`，gemini 會把 `--approval-mode` 之後的所有內容當成 prompt 的一部分，導致解析失敗（exit code 1）。

**讀取 skill 目錄（需額外參數）：**
```bash
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text \
  --include-directories="/home/derek/.hermes/skills/shiftblame" \
  -p "prompt"
```

**⚠️ Workspace 存取限制：**
- gemini 的 `read_file` 工具**會拒絕讀取 `.gitignore` 內的路徑**（如 `.shiftblame/`）。即使加了 `--include-directories` 也無法繞過 `read_file` 的限制。
- 解法：在 prompt 中指示 gemini 用 `cat` shell 命令讀取 `.shiftblame/` 下的檔案（已驗證可行）。
- `~/.hermes/skills/` 不在 workspace 內，必須用 `--include-directories` 加入才能讓 gemini 的 `read_file` 存取。

**⚠️ Approval Mode 決定工具可用性：**

| 模式 | write_file | run_shell_command | 結論 |
|---|---|---|---|
| `default`（預設） | 被攔截 | 被攔截 | 不可寫入 |
| `auto_edit` | 被攔截 | 被攔截 | 不可寫入 |
| `yolo` | 可用 | 可用 | 寫入必用此模式 |
| `plan` | 不可用 | 不可用 | 純唯讀 |

寫入任務**必須**加 `--approval-mode yolo`，否則 `write_file` 和 `run_shell_command` 會被 Policy Engine 攔截。模型回報自己有這些工具但實際呼叫時被拒絕。

**完整工具清單（13 個）：**
update_topic, list_directory, read_file, grep_search, glob, google_web_search, enter_plan_mode, invoke_agent, activate_skill, replace, write_file, run_shell_command, ask_user

**已知問題：**
- **429 MODEL_CAPACITY_EXHAUSTED**: Google 伺服器端容量問題（非帳號限額），所有模型（gemini-3-flash-preview、gemini-3.1-pro-preview、gemini-2.5-pro）都可能遇到。Gemini CLI 內建 retry with backoff，首次 429 後通常幾秒內 retry 成功。無需本地修復，等待即可。GitHub 有大量相同報告（#25552、#23986）。

## 3. Prompt 模板

### Proposal 階段（提案，只分析不執行）

```text
你是 <DEPT> 部門的 <cli> 員工。

【步驟 1】讀取以下檔案：
- 用 cat 讀取 <通訊目錄>/task.md
- 用 cat 讀取 ~/.hermes/skills/shiftblame/DEPT/<DEPT>.md
- 用 cat 讀取 ~/.hermes/skills/shiftblame/DEPT.md
- 用 cat 讀取 ~/.hermes/skills/shiftblame/CLI.md

【步驟 2】根據 task.md 進行分析

【步驟 3】將分析結果寫入 <通訊目錄>/<cli>/proposal.md

重要：
- 用繁體中文產出
- 這是提案階段，只分析不執行
- 用 write_file() 將完整提案寫入自己子目錄的 proposal.md
- 禁止寫入其他 CLI 的子目錄、task.md、consensus.md 等主管檔
- 必須引用具體檔案內容
- .shiftblame/ 下的檔案一律用 cat 讀取
```

### Result 階段（依共識執行，僅執行部門）

```text
你是 <DEPT> 部門的 <cli> 員工。

【步驟 1】讀取以下檔案：
- 用 cat 讀取 <通訊目錄>/task.md
- 用 cat 讀取 <通訊目錄>/consensus.md
- 用 cat 讀取 ~/.hermes/skills/shiftblame/DEPT/<DEPT>.md
- 用 cat 讀取 ~/.hermes/skills/shiftblame/DEPT.md
- 用 cat 讀取 ~/.hermes/skills/shiftblame/CLI.md

【步驟 2】依 consensus.md 執行分工任務

【步驟 3】將結果寫入 <通訊目錄>/<cli>/result.md

重要：
- 用繁體中文產出
- 用 write_file() 將完整結果寫入自己子目錄的 result.md
- 禁止寫入其他 CLI 的子目錄、task.md、consensus.md 等主管檔
- worktree 權限依 task.md 與 DEPT.md 規則判定（僅 DEV 可修改 worktree）
- .shiftblame/ 下的檔案一律用 cat 讀取
```

### CLI 特殊指令補充

派工時根據 CLI 工具特性，在 prompt 中加入對應補充：

#### claude
```
- task.md 和 DEPT 定義檔用 cat 讀取
- 用 write_file() 寫入自己的 proposal.md / result.md
```

#### codex
```
- task.md 和 DEPT 定義檔用 cat 讀取
- 用 write_file() 寫入自己的 proposal.md / result.md
```

#### gemini
```
- .shiftblame/ 下的檔案一律用 cat 讀取，不要用 read_file 工具
- skill 目錄的檔案可直接用 read_file 讀取
- 用 write_file() 寫入自己的 proposal.md / result.md
```

### 主管 Poll 流程

1. 派工三方 background process（notify_on_complete=true）
2. 每 30 秒 poll 檢查各 CLI 子目錄的 proposal.md 是否有內容（見嗅探機制）
3. 研究部門：三方 proposal.md 完成 → 主管讀取彙整寫入 conclusion.md
4. 執行部門階段0：三方 proposal.md 完成 → 主管讀取彙整寫入 consensus.md；階段1：三方 result.md 完成 → 主管確認

⚠️ 主管不代寫 CLI 的 proposal.md / result.md。若 CLI 因權限問題無法寫入，診斷根因並修復派工參數，不要改用 stdout 中轉模式。

## 4. MCP 工具配置

### 各 CLI 原生 MCP Server 管理

三方 CLI 各自有 MCP server 管理指令，可獨立於 Hermes 註冊 MCP 工具。

#### Claude Code

MCP 配置寫在 `~/.claude/settings.json` 的 `mcpServers` 區段（全域）或專案級 `.claude/settings.json`。也可透過 plugin 系統安裝（如 chrome-devtools-mcp）。

```bash
# 查看已註冊的 MCP servers
cat ~/.claude/settings.json | grep -A5 mcpServers
```

chrome-devtools-mcp 透過 plugin 安裝（`~/.claude/settings.json` → `enabledPlugins`），searxng 透過 `mcpServers` 區段手動配置。

#### Codex

```bash
# 加入 MCP server（stdio）
codex mcp add <NAME> -- <COMMAND> [ARGS...]
# 帶環境變數
codex mcp add <NAME> --env KEY=VALUE -- <COMMAND> [ARGS...]
# 列出
codex mcp list
# 移除
codex mcp remove <NAME>
```

⚠️ 語法差異：環境變數用 `--env KEY=VALUE`（雙橫線 + env），不是 `-e`。

#### Gemini

```bash
# 加入 MCP server（stdio，user scope）
gemini mcp add -s user <NAME> <COMMAND> [ARGS...]
# 帶環境變數
gemini mcp add -s user <NAME> <COMMAND> [ARGS...] -e KEY=VALUE
# 列出
gemini mcp list
```

⚠️ 語法差異：環境變數用 `-e KEY=VALUE`，放在 command 之後。scope 用 `-s user`（全域）或 `-s project`（專案級，預設）。

### 目前已配置的 MCP servers（2026-05-06）

| Server | Claude | Codex | Gemini |
|--------|:------:|:-----:|:------:|
| searxng（SEARXNG_URL=localhost:30045） | ✓ | ✓ | ✓ |
| chrome-devtools-mcp | ✓（plugin） | ✓ | ✓ |

### Hermes MCP Server 註冊狀態

目前已註冊但部分不可用：

| Server | Command | Tools | 狀態 |
|--------|---------|-------|------|
| claude-code | `claude mcp serve` | 24 | Agent tool 不可用（不載入 agents），Bash/Read/Edit/Write 正常 |
| codex | `codex mcp-server` | 2 | 恆定 timeout（通知不相容） |
| searxng | `npx -y mcp-searxng` | all | 正常 |
| chrome-devtools | `npx -y chrome-devtools-mcp` | all | 正常 |

## 5. CLI 失敗代碼

| 回報代碼 | 情境 | 處理 |
|---|---|---|
| `CLI_UNAVAILABLE` | CLI 服務不可用 | 重試 1-2 次，仍失敗則吸收或退回 |
| `RATE_LIMITED` | 觸發速率限制（HTTP 429） | 等待後重試 |
| `QUOTA_EXCEEDED` | 配額用盡 | 吸收或退回上游部門 |
| `TIMEOUT` | 執行超時 | 重試，仍失敗則吸收或退回 |
| `EXEC_FAILED` | 執行失敗 | 吸收或退回 |
| `EMPTY_OUTPUT` | 輸出為空 | 重試，仍失敗則吸收或退回 |
| `AUTH_FAILURE` | 認證失敗 | 診斷根因，報告主管 |
| `SERVICE_OVERLOADED` | 服務過載（HTTP 503/529） | 等待後重試 |

### CLI 失敗吸收策略

當某個 CLI 員工遇到失敗：
1. **重試**（內建 retry 机制）
2. **吸收**：其餘兩個 CLI 員工接手失敗者的份額
3. **退回上游**：若全部失敗，則回報主管

## 6. 已知問題與除錯

### 共性問題

- **background process 禁止 pipe 到 tail/head/awk**：codex/gemini 輸出量大時，pipe buffer（64KB）會塞滿，導致 CLI stdout write 被 block，程序無限期卡死。直接讓 stdout 進背景 buffer 即可。
- **api_max_retries 影響併發派工**：`hermes config` 的 `agent.api_max_retries` 低於 3 時，`terminal()` 三方併發容易失敗（interrupted）。確認值為 3：`hermes config set agent.api_max_retries 3`。修改後需重啟 Hermes。

### Hermes MCP Client 除錯筆記

**Circuit Breaker：**
- 閾值：3 次連續失敗
- 冷卻：60 秒
- 半開探測：冷卻後允許一次嘗試
- 重設方法：`hermes mcp remove <name>` + `hermes mcp add <name>`

**Timeout 配置：**
- 預設 per-tool-call timeout：120 秒
- 可在 `~/.hermes/config.yaml` 的 server config 加 `timeout` 和 `connect_timeout`

**MCP 通知處理：**
- Hermes 的 `_make_message_handler()` 只處理 `ToolListChangedNotification`、`PromptListChangedNotification`、`ResourceListChangedNotification`
- 未知通知類型走 `case _:` 直接忽略（不報錯）
- 但 Pydantic 驗證在更底層（`mcp/shared/session.py` L397-428），驗證失敗會 warning 但不 crash
- 真正的 hang 可能是 Codex 在等 `apply_patch_approval_request` 的回應

## 7. 派工策略

三方 CLI 必須分別使用不同的呼叫路徑：
- claude: `terminal()` + `claude -p`
- codex: `terminal()` + `codex exec`（必須帶 `pty: true`）
- gemini: `terminal()` + `gemini -p`

不要退回單一 `delegate_task` 路徑或 ACP 模式。某條 CLI 失敗時，診斷根因並修復，不要建議 fallback 到「穩定的路徑」。
