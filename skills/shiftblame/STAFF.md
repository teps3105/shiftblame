# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 目前 CLI | 直接執行 |
| 執行者 | 目前 CLI | 直接執行或本環境子代理 |
| 紅隊 | 非目前 CLI 之一 | `Bash` + CLI；限額時依降級策略補位 |
| 藍隊 | 非目前 CLI 之一 | `Bash` + CLI；限額時依降級策略補位 |

## 環境角色映射

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude CLI | claude | codex | gemini |
| Codex CLI | codex | claude | gemini |
| Gemini CLI | gemini | claude | codex |

固定原則：目前 CLI 永遠同時是管理者與執行者。管理者負責寫入 `task.md`、發布任務與協調；執行者負責寫入 `result.md`。預設由另外兩個 CLI 寫入 `red.md`、`blue.md`；外部 CLI 限額或 429 時依降級策略補位。檔案結構與管線語意不得因環境改變。

## 執行者呼叫

```bash
# Claude CLI 可用 Agent 子代理派工
Agent(subagent_type="general-purpose", prompt="...")

# Codex CLI 由目前 Codex session 直接執行，或使用 worker subagent

# Gemini CLI 由目前 Gemini session 直接執行
```

## 跨 CLI 呼叫

```bash
# claude
claude --dangerously-skip-permissions --output-format text -p "prompt"
# codex
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
# gemini
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
```

依「環境角色映射」選擇紅隊/藍隊實際命令；除限額 / 單點降級策略外，不得把目前 CLI 再派成紅隊或藍隊。

CLI 旗標規範：

- **Claude CLI**：必須使用 `--dangerously-skip-permissions --output-format text -p`，不得只用 `claude -p`，也不得只用 `--permission-mode bypassPermissions`。單純 `claude -p` 或 permission-mode 可能在工具執行、寫檔或權限確認時卡住，無法穩定產出 `red.md` / `blue.md`。
- **Codex CLI**：必須使用 `codex exec --dangerously-bypass-approvals-and-sandbox`，確保非互動執行。
- **Gemini CLI**：必須使用 `GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p`。`--approval-mode` 在 `-p` 之前。

跨 CLI 呼叫若 120 秒內無輸出且目標檔案未產生，視為卡住；管理者應中止程序並用正確旗標重派。Claude 寫入與工具規劃時間通常較長，timeout 不得低於 120 秒。

## 限額 / 單點降級策略

外部 CLI 回報 429、rate limit、quota exceeded、billing limit、暫時不可用，或 120 秒內無輸出且重派後仍無法產生目標檔案時，視為該 CLI 本輪不可用。

降級順序：

1. 單一外部 CLI 不可用：由另一個可用的外部 CLI 補上缺少的 `red.md` 或 `blue.md`。同一外部 CLI 可在本輪同時產出紅隊與藍隊，但兩份檔案必須分兩次呼叫、使用不同 prompt，且各自遵守紅隊/藍隊部門規則。
2. 兩個外部 CLI 都不可用，只剩目前 CLI 可用：管理者改用目前 CLI 開兩個本環境子代理，分別扮演紅隊與藍隊並寫入 `red.md`、`blue.md`。
3. 使用子代理補位時，prompt 必須明確標示「限額降級補位」，並要求只寫入指定檔案，不修改 `task.md`、`result.md` 或其他輸出。

降級不得跳過閘門；`result.md`、`red.md`、`blue.md` 三份產出仍必須齊全後才能進入 `AskUserQuestion`。

### `.shiftblame/` 讀寫權限規則

跨 CLI 派工時，prompt 必須包含以下硬性指示：

```text
重要權限規則：
- .shiftblame/ 已被 .gitignore 排除。
- 讀取 .shiftblame/ 內檔案時，只能使用 shell 指令，例如 cat、sed -n、test -f、find。
- 不要使用 read_file、Read、內建檔案讀取工具或任何會遵守 .gitignore 而拒絕讀取的工具讀 .shiftblame/。
- 若需檢查產品程式碼，可讀取 <slug>/worktree/ 內檔案；若需讀取協作文件，仍用 shell/cat/sed。
- 最終只寫入本次角色負責的 result.md、red.md 或 blue.md，不修改其他檔案。
```

若員工回報 `.shiftblame/` 檔案被 ignore/permission 拒絕，管理者不得等待其自行修復；立即中止該員工程序，改用上述硬性指示重派，或由管理者代讀內容後以 prompt 摘要提供。

## Worktree 工作規範

所有部門的 Demo、開發、測試等產物一律寫入 `<slug>/worktree/`，不得寫入主分支工作目錄。

- **PRD**：Demo 原型寫入 worktree
- **QA**：測試腳本與測試產物寫入 worktree
- **DEV**：程式碼實作與測試寫入 worktree
- **QC**：驗證腳本與結果寫入 worktree

收尾 squash merge 時，僅合併正式程式碼。Demo 原型、測試腳本、測試產物等不隨 merge 進入主分支。

## Prompt 模板

所有模板都必須包含「`.shiftblame/` 只能用 shell/cat/sed 讀取，不得用 read_file」。

**Result**：用 shell/cat/sed 讀取 task.md + DEPT/*.md → 依部門執行者規則執行 → 寫入 `result.md`

**Red**：用 shell/cat/sed 讀取 task.md + result.md → 依部門紅隊規則攻擊 → 寫入 `red.md`。

**Blue**：用 shell/cat/sed 讀取 task.md + result.md → 依部門藍隊規則檢視 → 寫入 `blue.md`。

所有產出（task.md / result.md / red.md / blue.md）使用繁體中文產出。
