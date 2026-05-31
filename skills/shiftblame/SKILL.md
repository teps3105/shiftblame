---
name: shiftblame
description: "AI Agents 協作框架。Use when: 功能創建(開始/start/開工/動工/go/begin)→建立新slug啟動PM, 恢復(恢復/restore/resume)→讀取未歸檔SLUG.md恢復工作狀態, 推進(推進/advance)→執行閘門推進流程, 補強(補強/reinforce)→同部門原地修復, 打回(打回/reject)→退回上游部門, 回溯(回溯/rollback)→撤回該部門所有變更回到該部門001, 收尾(收尾/finalize)→QC通過後執行收尾流程, 歸檔(歸檔/archive)→搬移slug至archive, 退回(退回)→依情境原地修復或打回, MAIN(MAIN模式/主分支模式)→使用MAIN模式直接在主分支修復, 載入(PM/QA/DEV/QC/專案計畫/品質保證/產品開發/驗收上線/管理者/執行者/紅隊/藍隊/BossConfirm/BossPreview/閘門/攻防/task.md/result.md/red.md/blue.md/conclusion.md/SLUG.md/EXECUTED/RED/BLUE/CONCLUSION/CHECKED/PASSED)→載入技能."
---
# shiftblame — AI Agents 協作框架
使用功能分支模式：管理者在第一次進入產品開發時建立 `feat/<slug>` 分支，專案計畫和品質保證不使用功能分支。紅隊與藍隊固定使用本環境子代理，不使用外部品牌工具或跨環境審查。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前環境 | 協調、派工、管線、閘門、收尾、conclusion.md、task.md 宣告 |
| 執行者 | 本環境子代理（預設，管理者可根據上下文使用情況隨時調整為目前環境直接執行） | result.md |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

固定呼叫映射：

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 本環境子代理（預設，管理者可根據上下文使用情況隨時調整為目前環境直接執行） | 本環境子代理 | 本環境子代理 |

詳見 `MANAGER.md` `STAFF.md`。執行者預設使用本環境子代理，管理者可根據上下文使用情況隨時調整為目前環境直接執行。紅藍隊固定使用本環境子代理，不得改用外部品牌工具。

## 溝通原則

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。對老闆說明時必須使用繁體中文與作品語言，說清楚「現在會看到什麼、可以操作什麼、這回合要完成哪個功能、如何確認它有用」。技術名詞、架構名詞、測試名詞只能作為內部工作細節，不得包裝成給老闆確認的主要內容。

## 部門
| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PM | 專案計畫 |
| 1 | QA | 品質保證 |
| 2 | DEV | 產品開發 |
| 3 | QC | 驗收上線 |

詳見 `DEPT/` 各部門子目錄。

## 模式

| 模式 | 分支 | 目錄結構 | 管線 | 適用情境 |
|------|------|----------|------|----------|
| FEATURE | `feat/<slug>` | `<slug>/<DEPT>/<NNN>/` | PM→QA→DEV→QC | 新功能開發 |
| MAIN | `main` | `<slug>/<NNN>/` | 無部門管線 | 小型修復、文件更新、配置變更 |

FEATURE 模式為預設。MAIN 模式由老闆明確指定。

MAIN 模式特徵：
- 直接在主分支工作，不建立功能分支
- 簡化目錄結構（無 DEPT 層級，扁平 `<slug>/<NNN>/`）
- 仍跑五階段流程（task→result→red→blue→conclusion）
- 無部門管線（不走 PM→QA→DEV→QC）
- 無上游/下游概念
- result.md 無部門三段式內容要求，直接描述工作成果
- 收尾：commit → push → 歸檔 → 更新 REPO.md/ROADMAP.md
- task.md 使用 `mode: main` 欄位取代 `department` 欄位

## 定義檔 / gitignore
`MANAGER.md` `STAFF.md` `DEPT/{PM,QA,DEV,QC}/`（每部門 L1-L5）

`.shiftblame/` 為本地工作目錄，須列入 `.gitignore` 不納入版本控制。開發中的工作筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策一律維護在 `.shiftblame/<slug>/SLUG.md`；不得寫入 `.shiftblame/ROADMAP.md`。REPO.md 記錄「完成了什麼」（已完成功能詳情、技術棧、架構演進），本地私密。ROADMAP.md 記錄「未來預計要做什麼」（後續計畫、已知問題、待改進項目），本地私密。兩份文件語意不可交叉，只在歸檔後更新。

全域入口檔的 managed block 由管理者依 `GATE.md` 全域入口安裝段落寫入或更新。不得依賴工具專屬設定檔觸發流程。

## 閘門狀態機

管理者依 `GATE.md` 定義的狀態機執行閘門檢查。五階段 FAIL 狀態機：L1 BossConfirm FAIL→返回 L1 重新宣告；L2 BossConfirm FAIL（result 確認）→返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm；L4 藍隊 FAIL→退回 L1 重新宣告（DECLARED），更新 task.md 宣告段落後重新 BossConfirm，採增量攻防（新回合追加在既有紀錄之後，不得刪除原始攻防紀錄）；L5 BossConfirm FAIL→退回 L1 重新宣告。詳見 `GATE.md`。

每一輪任務開始前，管理者必須向老闆確認宣告內容（宣告-確認-執行閘門），老闆同意後才能開始執行。全部門、每一輪都適用。result.md 產出後，管理者必須向老闆 BossConfirm 確認無需修改，通過後才呼叫紅隊。FAIL 修改不刪除。L4 藍隊 FAIL 原地修復觸發 DECLARED 狀態轉移時，必須更新 task.md 宣告段落後重新 BossConfirm；L2 BossConfirm FAIL 時必須更新宣告段落。增量攻防機制（在既有 red.md/blue.md 後追加新回合）本身不要求修改宣告段落。DEV/QC 適用單循環，與 PM/QA 一致。L1 即為計畫宣告，L1↔L2 迭代循環直到老闆滿意才進入紅藍。BossConfirm PASSED 後管理者輸出 compact 提醒：FEATURE 模式為阻塞式（閘門已通過，執行 /compact 後繼續收尾或推進），MAIN 模式為條件式（僅上下文過長時才要求 /compact）。管理者判斷分支：推進下一部門或同部門新執行切片（新 NNN）。一個 NNN 可以多次提交。MAIN 模式適用簡化閘門（見 `GATE.md` MAIN 模式段落）。

## 格式檢查

載入技能時，管理者必須依操作標準 17 檢查 REPO.md 和 ROADMAP.md 是否符合標準格式（模板定義於系統規格 31 和系統規格 32）。若不符合，管理者必須先整理為標準格式再繼續。不得在非標準格式的文件上執行其他操作。

## 權限 / ignore 規則

所有管理者與員工在讀寫 `.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案時，讀寫皆優先使用內建工具，若無法使用再退回 shell 指令：

- 讀取（優先，Claude）：Read Tool（內建檔案讀取工具）
- 讀取（優先，Codex 桌面環境）：`Get-Content -Encoding UTF8`（PowerShell）或 `cat`（Linux/macOS/Git Bash）
- 讀取（備援，Linux/macOS/Git Bash）：`cat`、`sed -n`
- 讀取（備援，Windows PowerShell）：`Get-Content -Encoding UTF8`
- 檢查/列檔：`test -f`、`find`、`Test-Path`、`Get-ChildItem`
- 寫入（優先，Claude）：Write/Edit Tool（內建檔案寫入/編輯工具）
- 寫入（優先，Codex 桌面環境）：`apply_patch` 系列工具（`apply_patch_add_file` / `apply_patch_update_file` / `apply_patch_replace_file` / `apply_patch_batch`），或 `Out-File -Encoding UTF8`（PowerShell）
- 寫入（備援）：shell heredoc 或目前環境允許的 patch/write 工具
- 禁止：在 Windows PowerShell 以未指定 `-Encoding UTF8` 的 `Get-Content`、`type`、`cat` 讀取含中文的 Markdown 檔案

派工 prompt 必須明確寫入讀寫規則（環境自適應）：Claude 環境優先使用 Read Tool 讀取、Write/Edit Tool 寫入；Codex 桌面環境使用 `Get-Content -Encoding UTF8`（PowerShell）或 `cat`（Linux/macOS）讀取，`apply_patch` 系列工具或 `Out-File -Encoding UTF8` 寫入。若內建工具無法使用，再以 shell 指令處理。

確認 `.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 存在，不存在 → 依 `GATE.md` 初始化或報告「尚未初始化」。關鍵字觸發流程。

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
├── ROADMAP.md            # 穩定產品路線圖（本地私密，僅收尾整理）
├── archive/              # 歷史紀錄（已完成任務）
├── tmp/                  # 臨時工作目錄（老闆自行清理）
└── <slug>/
    ├── SLUG.md            # 本輪開發筆記（開發中唯一工作日誌）
    └── <DEPT>/
        └── <NNN>/
```

MAIN 模式目錄結構：

```
.shiftblame/
├── REPO.md
├── ROADMAP.md
├── archive/
├── tmp/
└── <slug>/
    ├── SLUG.md
    └── <NNN>/
```

## 臨時工作目錄

所有流程中產生的臨時檔案（暫存、中間產物、除錯輸出、截圖、錄影、下載等）一律存放在 `.shiftblame/tmp/`，不得在專案根目錄建立臨時檔案。不自動清理，由老闆自行決定何時清理。

```
skills/shiftblame/
├── SKILL.md
├── GATE.md               # 狀態機閘門定義
├── MANAGER.md
├── STAFF.md
└── DEPT/
    ├── PM/
    ├── QA/
    ├── DEV/
    └── QC/
```

## 初始化設定

首次使用 shiftblame 時，需手動設定兩項用戶級配置：
### 3. Codex 桌面環境（`AGENTS.md`）

在用戶級 `$CODEX_HOME/AGENTS.md` 中加入以下 managed block（格式與 Claude 的 CLAUDE.md 相同）：

```
<!-- BEGIN shiftblame:global-entry -->
load shiftblame skills. On any shiftblame keyword reload shiftblame skills.
<!-- END shiftblame:global-entry -->
```

Codex 桌面環境在每次對話載入時自動讀取用戶級 `AGENTS.md`，無需額外的 SessionStart hook。與 Claude 的 `~/.claude/CLAUDE.md` 同為用戶級一次性設定，兩邊的 managed block 內容相同。

### 1. `~/.claude/CLAUDE.md`（managed block）

在 `~/.claude/CLAUDE.md` 中加入以下 managed block：

```
<!-- BEGIN shiftblame:global-entry -->
load shiftblame skills. On any shiftblame keyword reload shiftblame skills.
<!-- END shiftblame:global-entry -->
```

若檔案已含 managed block 則跳過；若含裸文字 `load shiftblame skills...` 則替換為上述 managed block。

### 2. `~/.claude/settings.json`（SessionStart hook）

在用戶級 `~/.claude/settings.json` 的 `hooks.SessionStart` 陣列中加入：

```json
{
  "matcher": "compact",
  "hooks": [
    {
      "type": "command",
      "command": "echo load shiftblame skills. On any shiftblame keyword reload shiftblame skills.",
      "timeout": 5
    }
  ]
}
```

若 `hooks.SessionStart` 已含 matcher 為 `"compact"` 的項目則跳過。若 settings.json 不存在則建立新檔。

### 互補關係

CLAUDE.md 與 Hook 互補，不可互相取代：CLAUDE.md 為系統提示詞（每個 session 持續存在），Hook matcher 為 "compact"（僅 compact 後觸發）。
