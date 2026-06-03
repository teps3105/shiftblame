---
name: shiftblame
description: "AI Agents 協作框架。Use when: 功能創建(開始/start/開工/動工/go/begin)→建立新slug啟動PM(預設MANUAL模式), 恢復(恢復/restore/resume)→讀取未歸檔SLUG.md恢復工作狀態, 推進(推進/advance)→執行閘門推進流程, 補強(補強/reinforce)→同部門原地修復, 打回(打回/reject)→退回上游部門, 回溯(回溯/rollback)→撤回該部門所有變更回到該部門001, 收尾(收尾/finalize)→閘門通過後執行收尾流程, 歸檔(歸檔/archive)→搬移slug至archive, 退回(退回)→依情境原地修復或打回, PLAN(PLAN模式/計畫模式)→使用PLAN模式僅PM在主分支執行, MANUAL(MANUAL模式/手動模式/功能/feature/新功能/完整流程/完整管線)→使用MANUAL模式PM→DEV→PM→DEV→收尾(預設新功能), OPERATE(OPERATE模式/執行模式/MAIN/維護/主分支)→使用OPERATE模式僅DEV在主分支執行, AUTO(AUTO模式/自動模式)→使用AUTO模式PM→DEV→PM→DEV→收尾(需RAPID.md，由老闆指定), 業務拓樑圖→Mermaid圖表追蹤專案進度, worktree→功能分支隔離機制, 開新對話→slug收尾後開新對話恢復上下文, 載入(PM/DEV/專案計畫/產品開發/管理者/執行者/紅隊/藍隊/BossConfirm/BossPreview/閘門/攻防/task.md/result.md/red.md/blue.md/conclusion.md/SLUG.md/EXECUTED/RED/BLUE/CONCLUSION/CHECKED/PASSED)→載入技能."
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依狀態機閘門協調 PM 與 DEV 交替迭代。紅藍隊固定使用本環境子代理。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE.md |
| 執行者 | 本環境子代理 | EXECUTE.md |
| 紅隊 | 本環境子代理 | EXECUTE.md |
| 藍隊 | 本環境子代理 | EXECUTE.md |

角色職責詳見 `ROLE.md`。派工規格詳見 `EXECUTE.md`。

## 入口導流

| 情境 | 必讀 |
|------|------|
| 流程開始 | `START.md` |
| 流程結束 | `END.md` |
| 閘門/狀態機 | `GATE.md` |
| 管理者操作 | `MANAGE.md` |
| 派工/模式 | `EXECUTE.md` |
| 角色定義 | `ROLE.md` |

## 模式

四模式：PLAN（PM only）、MANUAL（功能模式，預設）、OPERATE（DEV only）、AUTO（需 RAPID.md）。詳見 `EXECUTE.md`。

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
    └── <ROLE>/<NNN>/       # MANUAL/AUTO: PM/DEV；PLAN/OPERATE: 扁平
```

## 定義檔

| 檔案 | 說明 |
|------|------|
| GATE.md | 閘門檢查與狀態機 |
| MANAGE.md | 管理者協調與操作 |
| EXECUTE.md | 子代理派工 + 四模式定義 |
| ROLE.md | 角色定義（PM + DEV） |
| START.md | 流程開始定義 |
| END.md | 流程結束定義 |
| TEMPLATE/ | 文件模板 |
| TOOLS/ | 工具包 |
