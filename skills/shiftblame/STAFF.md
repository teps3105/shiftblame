# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 目前環境 | 直接執行 |
| 執行者 | 目前環境 | 直接執行或本環境子代理 |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

## 固定呼叫映射

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 目前環境 | 本環境子代理 | 本環境子代理 |

固定原則：目前環境永遠同時是管理者與執行者。管理者負責寫入 `task.md`、發布任務與協調；執行者負責寫入 `result.md`。紅隊與藍隊一律使用本環境子代理，不使用外部品牌工具或跨環境審查。檔案結構與管線語意不得因環境改變。

## 紅藍隊派工

task.md 的 `review` 欄位固定為 `local`。同一 slug 內所有任務一律由本環境子代理依序產出 `red.md` 與 `blue.md`。

同一任務的攻防順序固定為 `result.md` → `red.md` → `blue.md`。管理者必須先確認 `result.md` 存在且格式有效，才能呼叫紅隊；必須先確認 `red.md` 存在且格式有效，才能呼叫藍隊。紅隊與藍隊不得並行啟動。

## 執行者呼叫

執行者由目前環境直接執行，或由管理者開本環境子代理執行。紅隊與藍隊固定由本環境子代理擔任；prompt 必須要求只寫入指定檔案，不修改 `task.md`、`result.md` 或其他輸出。

若本環境無法開子代理，管理者必須 BLOCK 並回報原因，不得改用外部品牌工具補位。不得跳過閘門；`result.md`、`red.md`、`blue.md` 三份產出仍必須齊全後才能進入 `BossConfirm`。

### `.shiftblame/` 讀寫權限規則

派工時，prompt 必須包含以下硬性指示：

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

task.md 的 `workspace` 欄位決定工作區模式。同一 slug 內所有任務沿用相同模式。預設使用 `direct`。

### direct 模式（預設）

直接在主 repo 的功能分支上開發，不額外建工作樹。管理者建立分支 `feat/<slug>` 後切換，所有產物直接寫入 repo 工作目錄。收尾時 squash merge → push → 刪分支（無 worktree 需清理）。

- 僅切分支，不建 worktree
- 產物直接在 repo 工作目錄中產生
- 收尾時無需刪 worktree，僅刪分支

### worktree 模式

所有部門的 Demo、開發、測試等產物一律寫入 `<slug>/worktree/`，不得寫入主分支工作目錄。

- **PRD**：Demo 原型寫入 worktree
- **QA**：測試腳本與測試產物寫入 worktree
- **DEV**：程式碼實作與測試寫入 worktree
- **QC**：驗證腳本與結果寫入 worktree

收尾 squash merge 時，僅合併正式程式碼。Demo 原型、測試腳本、測試產物等不隨 merge 進入主分支。

## Prompt 模板

所有模板都必須包含「`.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案只能用 shell 讀取，不得用 read_file；Windows PowerShell 必須使用 `Get-Content -Encoding UTF8`」。

所有面向老闆的內容都必須預設老闆不懂技術：用繁體中文、作品效果、可操作步驟與驗證結果描述，不得用技術術語包裝。技術細節可放在「內部備註」或「實作紀錄」，不可取代功能描述。

**Result**：用 UTF-8 shell 讀取 task.md + DEPT/*.md → 依部門執行者規則執行 → 寫入 `result.md`。完成前不得呼叫紅隊或藍隊。

**Red**：確認 `result.md` 已存在且格式有效 → 用 UTF-8 shell 讀取 task.md + result.md + DEPT/*.md → 依部門紅隊規則攻擊 → 寫入 `red.md`。完成前不得呼叫藍隊。

**Blue**：確認 `red.md` 已存在且格式有效 → 用 UTF-8 shell 讀取 task.md + result.md + red.md + DEPT/*.md → 依部門藍隊規則檢視 → 寫入 `blue.md`。藍隊報告必須包含紅藍攻防對照、紅隊每個攻擊點的防禦或修正判定、殘餘風險，以及 PASS/FAIL 建議。

所有產出（task.md / result.md / red.md / blue.md）使用繁體中文產出。
