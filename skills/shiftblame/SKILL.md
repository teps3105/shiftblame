---
name: shiftblame
description: "AI Agents 協作框架。Use when: 功能創建(開始/start/開工/動工/go/begin)→建立新slug啟動PM(預設AUTO模式), 恢復(恢復/restore/resume)→讀取未歸檔SLUG.md恢復工作狀態, 推進(推進/advance)→執行閘門推進流程, 補強(補強/reinforce)→同部門原地修復, 打回(打回/reject)→退回上游部門, 回溯(回溯/rollback)→撤回該部門所有變更回到該部門001, 收尾(收尾/finalize)→閘門通過後執行收尾流程, 歸檔(歸檔/archive)→搬移slug至archive, 退回(退回)→依情境原地修復或打回, PLAN(PLAN模式/計畫模式)→使用PLAN模式僅PM在主分支執行, MANUAL(MANUAL模式/手動模式/完整流程/完整管線)→使用MANUAL模式PM→DEV→PM→DEV→收尾(由老闆指定), OPERATE(OPERATE模式/執行模式/MAIN/維護/主分支)→使用OPERATE模式僅DEV在主分支執行, AUTO(AUTO模式/自動模式)→使用AUTO模式PM→DEV→PM→DEV→收尾(預設), 業務拓樑圖→Mermaid圖表追蹤專案進度, worktree→功能分支隔離機制, 開新對話→slug收尾後開新對話恢復上下文, 載入(PM/DEV/專案計畫/產品開發/管理者/執行者/紅隊/藍隊/BossConfirm/BossPreview/閘門/攻防/task.md/result.md/red.md/blue.md/conclusion.md/SLUG.md/EXECUTED/RED/BLUE/CONCLUSION/CHECKED/PASSED)→載入技能."
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依狀態機閘門協調 PM 與 DEV 交替迭代。紅藍隊固定使用本環境子代理，不使用外部品牌工具。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE/ |
| 執行者 | 本環境子代理 | EXECUTE/MAPPING.md |
| 紅隊 | 本環境子代理 | EXECUTE/DISPATCH.md |
| 藍隊 | 本環境子代理 | EXECUTE/DISPATCH.md |

角色職責詳見 `ROLE/PM.md`、`ROLE/DEV.md`。派工規格詳見 `EXECUTE/MAPPING.md`。

## 入口導流

Agent 載入後依狀態機與當前情境讀取所需檔案，不需一次讀取全部定義。

| 情境 | 必讀 |
|------|------|
| 首次載入 / 初始化 | `GATE/INIT.md` → 確認 REPO.md/ROADMAP.md 存在 |
| 啟動 slug | `MANAGE/SLUG.md`（建立筆記）→ `GATE/DISPATCH.md`（派工） |
| 進入閘門 | `GATE/STATE.md`（狀態機）→ `GATE/BOSS.md`（BossConfirm） |
| 執行階段 | L1→`GATE/DECLARE.md`、L2→對應角色檔、L3→`EXECUTE/DISPATCH.md`、L5→`GATE/ARCHIVE.md` |
| 退回/異常 | `GATE/REVERT.md` + `MANAGE/REVERT.md` |
| 收尾 | `MANAGE/CLOSE.md` + `GATE/ARCHIVE.md` |
| 模式選擇 | `MANAGE/DECIDE.md`（PLAN/MANUAL/OPERATE/AUTO）→ `EXECUTE/<MODE>.md` |
| worktree | `GATE/WORKTREE.md` + `MANAGE/WORKTREE.md` |
| 開新對話 | `MANAGE/CLOSE.md` + `GATE/NEWDIALOG.md` |
| 讀寫權限 | `EXECUTE/PERMISSION.md` |
| 業務拓樑圖 | `MANAGE/GRAPH.md` |

## 角色定義

PM（專案計畫）：`ROLE/PM.md`
DEV（產品開發）：`ROLE/DEV.md`

## 模式

四模式形式定義見 `EXECUTE/PLAN.md`、`EXECUTE/MANUAL.md`、`EXECUTE/OPERATE.md`、`EXECUTE/AUTO.md`。模式選擇見 `MANAGE/DECIDE.md`。

## PRD / SOP

`.shiftblame/PRD/` 存放產品需求文件（非強制參照）。`.shiftblame/SOP/` 存放標準作業程序（DEV 開發時遵循）。兩者為本地私密，不納入版本控制。PRD/SOP 不受閘門約束。

## 文件結構

```
.shiftblame/               # 本地私密，.gitignore
├── REPO.md               # 專案現狀
├── ROADMAP.md            # 穩定產品路線圖
├── PRD/                  # 產品需求文件（非強制）
├── SOP/                  # 標準作業程序（非強制）
├── archive/              # 已歸檔 slug
├── tmp/                  # 臨時檔案
└── <slug>/
    ├── SLUG.md            # 開發筆記
    └── <ROLE>/<NNN>/       # MANUAL/AUTO: ROLE=PM 或 DEV；PLAN/OPERATE: 扁平
```

worktree 路徑：`.worktrees/<slug>/`，分支 `feat/<slug>`。僅 MANUAL/AUTO 使用；PLAN/OPERATE 不建立。詳見 `GATE/WORKTREE.md` + `MANAGE/WORKTREE.md`。

## 定義檔

| 目錄 | 說明 |
|------|------|
| GATE/ | 閘門檢查與狀態機（11 檔） |
| MANAGE/ | 管理者協調與操作（9 檔） |
| EXECUTE/ | 子代理派工 + 模式定義（9 檔） |
| ROLE/ | 角色定義（PM.md, DEV.md） |
| TEMPLATE/ | 執行模板（待建立） |
| TOOLS/ | 工具包 |

## 初始化設定

首次使用需設定兩項用戶級配置：

1. **CLAUDE.md**（`~/.claude/`）— 加入 managed block（見 CLAUDE.md 現有內容）
2. **settings.json**（`~/.claude/`）— SessionStart hook（matcher: compact）

CLAUDE.md 與 Hook 互補：CLAUDE.md 持續存在於 session，Hook 僅在 compact 後觸發。

Codex 桌面環境在 `AGENTS.md` 中加入相同 managed block。

## 臨時檔案 / gitignore

臨時檔案存放在 `.shiftblame/tmp/`（不自動清理）。`.shiftblame/` 已列入 `.gitignore`。
