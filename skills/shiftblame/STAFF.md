# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 目前 CLI | 直接執行 |
| 執行者 | 目前 CLI | 直接執行或本環境子代理 |
| 紅隊 | 依 `review` 模式 | 外部 CLI 或本環境子代理 |
| 藍隊 | 依 `review` 模式 | 外部 CLI 或本環境子代理 |

## 環境角色映射

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude CLI | claude | codex | gemini |
| Codex CLI | codex | claude | gemini |
| Gemini CLI | gemini | claude | codex |

固定原則：目前 CLI 永遠同時是管理者與執行者。管理者負責寫入 `task.md`、發布任務與協調；執行者負責寫入 `result.md`。紅藍隊的派工方式由 task.md 的 `review` 欄位決定；外部 CLI 限額或 429 時依降級策略補位。檔案結構與管線語意不得因環境改變。

## 紅藍隊派工模式

task.md 的 `review` 欄位決定紅隊/藍隊的派工方式。同一 slug 內所有任務沿用相同模式。

### dual（預設）

紅隊與藍隊皆由外部 CLI 派工。依「環境角色映射」選擇紅隊/藍隊實際命令。

### single

紅隊由外部 CLI 派工，藍隊由本環境子代理擔任。適用於僅需一個外部視角、或某個外部 CLI 不可用的情境。

### solo

紅隊與藍隊皆由本環境子代理擔任，不啟用任何外部 CLI。適用於所有外部 CLI 皆不可用、或需快速迭代不需跨模型驗證的情境。

| 模式 | 紅隊 | 藍隊 | 外部 CLI 數 |
|------|------|------|:-----------:|
| `dual` | 外部 CLI | 外部 CLI | 2 |
| `single` | 外部 CLI | 本環境子代理 | 1 |
| `solo` | 本環境子代理 | 本環境子代理 | 0 |

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
mkdir -p .shiftblame/<slug>/<DEPT>/<NNN> && claude --bare --dangerously-skip-permissions --no-session-persistence --output-format text -p "prompt" | cat > .shiftblame/<slug>/<DEPT>/<NNN>/<file>.md

# codex
mkdir -p .shiftblame/<slug>/<DEPT>/<NNN> && codex exec --dangerously-bypass-approvals-and-sandbox "prompt" | cat > .shiftblame/<slug>/<DEPT>/<NNN>/<file>.md

# gemini
mkdir -p .shiftblame/<slug>/<DEPT>/<NNN> && GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt" | cat > .shiftblame/<slug>/<DEPT>/<NNN>/<file>.md
```

依「環境角色映射」選擇紅隊/藍隊實際命令；除限額 / 單點降級策略外，不得把目前 CLI 再派成紅隊或藍隊。必須先執行 `mkdir -p` 確保目錄存在，並透過 `| cat >` 轉向寫入檔案，這在某些限制環境下比直接 `>` 更能穩定寫入 `.gitignore` 排除的目錄。

CLI 旗標規範：

- **Claude CLI**：必須使用 `--bare --dangerously-skip-permissions --no-session-persistence --output-format text -p`。`--bare` 避免 hooks / LSP / plugin sync / memory / CLAUDE.md 自動探索造成批次派工卡住；`--dangerously-skip-permissions` 確保非互動自動化執行；`--no-session-persistence` 避免續用舊 session。
- **Codex CLI**：必須使用 `codex exec --dangerously-bypass-approvals-and-sandbox`，確保非互動執行。
- **Gemini CLI**：必須使用 `GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p`。`--approval-mode` 在 `-p` 之前。

跨 CLI 呼叫若 120 秒內無輸出且目標檔案未產生，視為卡住；管理者應中止程序並用正確旗標重派。

## 限額 / 單點降級策略

外部 CLI 回報 429、rate limit、quota exceeded、billing limit、暫時不可用，或 120 秒內無輸出且重派後仍無法產生目標檔案時，視為該 CLI 本輪不可用。降級僅影響 `review=dual` 或 `review=single` 模式中預定使用外部 CLI 的角色。

降級順序：

1. **dual 模式** — 單一外部 CLI 不可用：由另一個可用的外部 CLI 補上缺少的 `red.md` 或 `blue.md`。同一外部 CLI 可在本輪同時產出紅隊與藍隊，但兩份檔案必須分兩次呼叫、使用不同 prompt，且各自遵守紅隊/藍隊部門規則。
2. **dual 模式** — 兩個外部 CLI 都不可用，或 **single 模式** — 唯一外部 CLI 不可用：自動降級為 `solo` 模式，管理者改用目前 CLI 開兩個本環境子代理，分別扮演紅隊與藍隊並寫入 `red.md`、`blue.md`。
3. 使用子代理補位時，prompt 必須明確標示「限額降級補位」，並要求只寫入指定檔案，不修改 `task.md`、`result.md` 或其他輸出。

降級不得跳過閘門；`result.md`、`red.md`、`blue.md` 三份產出仍必須齊全後才能進入 `AskUserQuestion`。

### `.shiftblame/` 讀寫權限規則

跨 CLI 派工時，prompt 必須包含以下硬性指示：

```text
重要產出規則：
- .shiftblame/ 已被 .gitignore 排除。
- 讀取 .shiftblame/ 內檔案時，只能使用 shell 指令，例如 cat、sed -n、test -f、find。
- 你的輸出將被直接導向到目標檔案（如 red.md），因此請「僅輸出報告的 Markdown 內容」，不要包含任何前言、後記、確認訊息或工具呼叫的原始輸出。
- 報告必須包含完整的 YAML frontmatter 與繁體中文內容。
```

若員工回報 `.shiftblame/` 檔案被 ignore/permission 拒絕，管理者不得等待其自行修復；立即中止該員工程序，改用上述硬性指示重派，或由管理者代讀內容後以 prompt 摘要提供。

## 工作區規範

task.md 的 `workspace` 欄位決定工作區模式。同一 slug 內所有任務沿用相同模式。

### worktree 模式（預設）

所有部門的 Demo、開發、測試等產物一律寫入 `<slug>/worktree/`，不得寫入主分支工作目錄。

- **PRD**：Demo 原型寫入 worktree
- **QA**：測試腳本與測試產物寫入 worktree
- **DEV**：程式碼實作與測試寫入 worktree
- **QC**：驗證腳本與結果寫入 worktree

收尾 squash merge 時，僅合併正式程式碼。Demo 原型、測試腳本、測試產物等不隨 merge 進入主分支。

### direct 模式

直接在主 repo 的功能分支上開發，不額外建工作樹。管理者建立分支 `feat/<slug>` 後切換，所有產物直接寫入 repo 工作目錄。收尾時 squash merge → push → 刪分支（無 worktree 需清理）。

- 僅切分支，不建 worktree
- 產物直接在 repo 工作目錄中產生
- 收尾時無需刪 worktree，僅刪分支

## Prompt 模板

所有模板都必須包含「`.shiftblame/` 只能用 shell/cat/sed 讀取，不得用 read_file」。

**Result**：用 shell/cat/sed 讀取 task.md + DEPT/*.md → 依部門執行者規則執行 → 寫入 `result.md`

**Red**：用 shell/cat/sed 讀取 task.md + result.md → 依部門紅隊規則攻擊 → 寫入 `red.md`。

**Blue**：用 shell/cat/sed 讀取 task.md + result.md → 依部門藍隊規則檢視 → 寫入 `blue.md`。

所有產出（task.md / result.md / red.md / blue.md）使用繁體中文產出。
