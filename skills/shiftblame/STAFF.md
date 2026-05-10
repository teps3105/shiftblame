# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 目前 CLI | 直接執行 |
| 執行者 | 目前 CLI | 直接執行或本環境子代理 |
| 紅隊 | 依 `review` 模式 | Gemini CLI 或本環境子代理 |
| 藍隊 | 依 `review` 模式 | Gemini CLI 或本環境子代理 |

## 固定呼叫映射

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude Code | claude | gemini 或本環境子代理 | gemini 或本環境子代理 |
| Codex CLI | codex | gemini 或本環境子代理 | gemini 或本環境子代理 |

固定原則：目前 CLI 永遠同時是管理者與執行者，且目前環境只支援 Claude Code 或 Codex CLI；不使用 Gemini 做主開發。管理者負責寫入 `task.md`、發布任務與協調；執行者負責寫入 `result.md`。紅藍隊外部呼叫只使用 Gemini CLI；不得呼叫 Claude Code 或 Codex 作為紅隊或藍隊。外部 Gemini 限額或 429 時依降級策略補位。檔案結構與管線語意不得因環境改變。

## 紅藍隊派工模式

task.md 的 `review` 欄位決定紅隊/藍隊的派工方式。同一 slug 內所有任務沿用相同模式。只支援 `gemini` 與 `solo` 兩種模式，預設 `gemini`。

同一任務的攻防順序固定為 `result.md` → `red.md` → `blue.md`。管理者必須先確認 `result.md` 存在且格式有效，才能呼叫紅隊；必須先確認 `red.md` 存在且格式有效，才能呼叫藍隊。紅隊與藍隊不得並行啟動。

### gemini（預設）

紅隊與藍隊皆由 Gemini CLI 派工，且依序分兩次呼叫。

### solo

紅隊與藍隊皆由本環境子代理擔任，不啟用 Gemini CLI。適用於 Gemini 不可用、或需快速迭代不需跨模型驗證的情境。

| 模式 | 紅隊 | 藍隊 | Gemini CLI 數 |
|------|------|------|:-----------:|
| `gemini` | Gemini CLI | Gemini CLI | 1 |
| `solo` | 本環境子代理 | 本環境子代理 | 0 |

## 執行者呼叫

```bash
# Claude Code 可用 Agent 子代理派工
Agent(subagent_type="general-purpose", prompt="...")

# Codex CLI 由目前 Codex session 直接執行，或使用 worker subagent

```

## 跨 CLI 呼叫

```bash
# gemini
mkdir -p .shiftblame/<slug>/<DEPT>/<NNN> && GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt" | cat > .shiftblame/<slug>/<DEPT>/<NNN>/<file>.md
```

跨 CLI 紅藍隊只允許使用 Gemini CLI。必須先執行 `mkdir -p` 確保目錄存在，並透過 `| cat >` 轉向寫入檔案，這在某些限制環境下比直接 `>` 更能穩定寫入 `.gitignore` 排除的目錄。

CLI 旗標規範：

- **Gemini CLI**：必須使用 `GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p`。`--approval-mode` 在 `-p` 之前。

跨 CLI 呼叫 timeout 規則：

- 一般短任務可用 120 秒作為首次卡住判斷。
- 紅隊 / 藍隊審查、需要讀取多份 `.shiftblame/` 文件、或預期輸出完整報告的任務，Gemini timeout 必須至少 300 秒。
- 若程序 exit 0 但目標檔案為空、只含空白、或缺 YAML frontmatter，視為產物缺件，不得視為 PASS；管理者需以 300 秒 timeout 重派，必要時改用 `--output-format json` 或 `--output-format stream-json --verbose` 觀察並抽取 `result`。

## 限額 / 單點降級策略

Gemini CLI 回報 429、rate limit、quota exceeded、billing limit、暫時不可用，或依 timeout 規則重派後仍無法產生非空且格式有效的目標檔案時，視為 Gemini 本輪不可用。降級僅影響 `review=gemini` 模式。

降級順序：

1. **gemini 模式** — Gemini 可用：同一個 Gemini CLI 依序產出 `red.md` 與 `blue.md`，兩份檔案必須分兩次呼叫、使用不同 prompt，且先完成 `red.md` 才能啟動 `blue.md`。
2. **gemini 模式** — Gemini 不可用：自動降級為 `solo` 模式，管理者改用目前 CLI 開兩個本環境子代理，分別扮演紅隊與藍隊並寫入 `red.md`、`blue.md`。
3. 使用子代理補位時，prompt 必須明確標示「Gemini 不可用降級補位」，並要求只寫入指定檔案，不修改 `task.md`、`result.md` 或其他輸出。

降級不得跳過閘門；`result.md`、`red.md`、`blue.md` 三份產出仍必須齊全後才能進入 `BossConfirm`。

### `.shiftblame/` 讀寫權限規則

跨 CLI 派工時，prompt 必須包含以下硬性指示：

```text
重要產出規則：
- .shiftblame/ 已被 .gitignore 排除。
- 讀取 .shiftblame/ 與 skills/shiftblame/ 內 Markdown 檔案時，只能使用 shell 指令；Linux/macOS/Git Bash 使用 cat 或 sed -n，Windows PowerShell 必須使用 Get-Content -Encoding UTF8。
- 檢查檔案存在與列檔可使用 test -f、find、Test-Path、Get-ChildItem。
- 禁止使用 read_file、內建檔案讀取器，或在 Windows PowerShell 以未指定 -Encoding UTF8 的 Get-Content/type/cat 讀取含中文 Markdown。
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

所有模板都必須包含「`.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案只能用 shell 讀取，不得用 read_file；Windows PowerShell 必須使用 `Get-Content -Encoding UTF8`」。

**Result**：用 UTF-8 shell 讀取 task.md + DEPT/*.md → 依部門執行者規則執行 → 寫入 `result.md`。完成前不得呼叫紅隊或藍隊。

**Red**：確認 `result.md` 已存在且格式有效 → 用 UTF-8 shell 讀取 task.md + result.md + DEPT/*.md → 依部門紅隊規則攻擊 → 寫入 `red.md`。完成前不得呼叫藍隊。

**Blue**：確認 `red.md` 已存在且格式有效 → 用 UTF-8 shell 讀取 task.md + result.md + red.md + DEPT/*.md → 依部門藍隊規則檢視 → 寫入 `blue.md`。藍隊報告必須包含紅藍攻防對照、紅隊每個攻擊點的防禦或修正判定、殘餘風險，以及 PASS/FAIL 建議。

所有產出（task.md / result.md / red.md / blue.md）使用繁體中文產出。
