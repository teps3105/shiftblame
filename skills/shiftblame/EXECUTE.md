# EXECUTE — 子代理派工與模式定義

## 執行者呼叫

執行者預設由本環境子代理擔任（管理者可調整為目前環境直接執行），紅隊藍隊固定由本環境子代理擔任。prompt 必須要求子代理寫入目標檔案（執行者→result.md、紅隊→red.md、藍隊→blue.md）。管理者驗證產出；未產出則重跑。

若無法開子代理 → BLOCK，不得使用外部品牌工具。

## 員工映射

| 別名 | 角色 | 呼叫 |
|------|------|------|
| 管理者 | 目前環境 | 直接執行 |
| 執行者 | 本環境子代理 | result.md |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

## 紅藍隊派工

task.md review 固定為 local。同一 slug 內依序產出 red.md 與 blue.md。

順序：result.md → BossConfirm（result 確認）→ red.md → blue.md → conclusion.md → CHECKED → BossConfirm → PASSED。紅藍不得並行。L4 FAIL 退回 L2 原地修復，採增量攻防。L5 FAIL 退回 L1 重新宣告。

## 讀寫權限

派工 prompt 必須包含：Claude 環境優先使用 Read/Write/Edit Tool；Codex 使用 Get-Content/apply_patch/Out-File（均 -Encoding UTF8）。禁止未指定 UTF8 讀取中文 Markdown。臨時檔案存放 `.shiftblame/tmp/`。

## 工作區規範

FEATURE 在主工作目錄 `git checkout -b feat/<slug>`；AUTO 執行 `git worktree add .worktrees/<slug> -b feat/<slug>`。DOC/MAIN 不使用功能分支。

功能分支生命週期：建立 → PM/DEV PASSED → merge --no-ff → push → branch delete（AUTO 額外 worktree remove）。`.shiftblame/` 位於主工作目錄，不在 worktree 內。

## Prompt 模板通用格式

所有模板必須包含讀寫規則（Claude/Codex 雙環境自適應）。面向老闆全部預設不懂技術，用繁體中文、作品效果描述。

## 四模式形式定義

### DOC 模式

| 屬性 | 值 |
|------|-----|
| Pass | 1（PM only） |
| BossConfirm | Manual |
| 分支 | main |
| worktree | 否 |
| 修改範圍 | 僅 `.shiftblame/` 內文件 |

PM only 主分支操作。**限定只能修改 `.shiftblame/` 內的文件**（REPO.md、ROADMAP.md、PRD/、SOP/、GRAPH.md、SLUG.md 等）。用於規劃、制定規則、整理專案文件。不得修改 `.shiftblame/` 以外的檔案。PASSED → COMMITTED → PUSHED → ARCHIVED → UPDATED。

### FEATURE 模式（功能模式，預設新功能）

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| BossConfirm | Manual |
| 分支 | feat/\<slug\> |
| worktree | 否 |
| MaxIter | ∞ |

觸發詞：`功能/feature/新功能`。管線：PM→DEV→PM→DEV→收尾。PASSED → MERGED → PUSHED → ARCHIVED → UPDATED。

### MAIN 模式

| 屬性 | 值 |
|------|-----|
| Pass | 1（DEV only） |
| BossConfirm | Manual |
| 分支 | main |
| worktree | 否 |
| MaxIter | 1 |

觸發詞：`MAIN/維護/主分支`。DEV only 主分支。PASSED → COMMITTED → PUSHED → ARCHIVED → UPDATED。

### AUTO 模式（需 RAPID.md）

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| BossConfirm | Auto |
| 分支 | feat/\<slug\> |
| worktree | 是 |
| MaxIter | ≤2 |

僅在存在 `.shiftblame/RAPID.md` 時可用。BossConfirm 自動：L1 宣告非空→通過；L2 格式有效→通過；L5 五檔齊全→通過。攻防上限 3 輪。迭代上限 PM/002 + DEV/002。PASSED → MERGED → PUSHED → ARCHIVED → UPDATED。
