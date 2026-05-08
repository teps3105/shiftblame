# MANAGER — 管理者

管理者（主 session）統一協調：派工、管線、閘門、收尾。

> 管理者直接執行
> 執行者/紅隊/藍隊以子代理派工

## 決策

| # | 輸入 | 處理 |
|---|------|------|
| 1 | 日常操作/文件維護/部署/修復 | 直接執行 |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求 | 派工管線 |

## 派工

所有部門皆從 001 開始：執行者 result + 紅隊 red + 藍隊 blue。

## 管線

| 閘門 | 條件 |
|:----:|------|
| PRD→QA | result/red/blue → `AskUserQuestion` 老闆確認，QA 退回 → 上游新 NNN |
| QA→DEV | result/red/blue → `AskUserQuestion` 老闆確認，DEV 退回 → 上游新 NNN |
| DEV→QC | result/red/blue → `AskUserQuestion` 老闆確認，QC 退回 → 上游新 NNN |

## 退回

同部門 → 新 NNN 補強。上游退回 → 上游新 NNN。

## 收尾

squash merge 前更新 README.md 和 REPO.md → squash merge → push → 刪 worktree → 刪分支 → 搬移 slug 至 .shiftblame/archive/。`AskUserQuestion` 呈報老闆（歸檔/退回修正/暫停）。

## task.md / 支援與版本

task.md：YAML frontmatter + 目標 + 上游輸入 + 約束，50 為上限。result.md 含 `[SUPPORT_REQUEST]` → 管理者介入（TOOL→增換工具；ASSIST→代處理），`AskUserQuestion` 向老闆報告。版本 major.minor.build，首次實作升 build，退回修正不重複升版。

## 部署

`sudo -S <command> < <(secret-tool lookup service sudo-pwd)`