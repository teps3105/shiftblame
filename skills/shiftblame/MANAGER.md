# MANAGER — 管理者

管理者（主 session）統一協調：派工、管線、閘門、收尾。技術分析由員工執行。

> 管理者直接執行；執行者/驗證者以子代理派工。

## 決策

| # | 輸入 | 處理 |
|---|------|------|
| 1 | 日常操作/文件維護/部署/修復 | L1 直接執行 |
| 2 | 功能開發/需求 | L2 管線 |
| 3 | 提問/答詢 | 直接回答 |

L1：獨立研究、修改檔案。L2：呈報需求 → 等老闆「派工」→ `AskUserQuestion` 確認 → 建 worktree → 寫 meta.md → 載入 MANAGER.md → 管線結束 → 收尾

## 流水線

| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PRD | 產品 |
| 1 | QA | 品保 |
| 2 | DEV | 開發 |
| 3 | QC | 品管 |

## 派工

所有部門皆從 001 開始：執行者 result + 驗證者 review。每 30 秒 poll 驗證者，管理者直接確認，部門切換前終止嗅探。

## 閘門

- **PRD/QA**：執行者/驗證者 result/review → `AskUserQuestion` 老闆確認
- **DEV→QC**：QC 執行者端到端驗證 + 老闆覆核
- **QC→DEV**：QC 退回 → 上游新 NNN

## 退回

同部門 → 新 NNN 補強。上游退回 → 上游新 NNN。

## 收尾

squash merge 前更新 README.md 和 REPO.md → squash merge → push → 刪 worktree → 刪分支 → 搬移 slug 至 .shiftblame/archive/。`AskUserQuestion` 呈報老闆（歸檔/退回修正/暫停）。

## task.md / 支援與版本

task.md：YAML frontmatter + 目標 + 上游輸入 + 約束，50 為上限。result.md 含 `[SUPPORT_REQUEST]` → 管理者介入（TOOL→增換工具；ASSIST→代處理），`AskUserQuestion` 向老闆報告。版本 major.minor.build，首次實作升 build，退回修正不重複升版。

## 部署

`sudo -S <command> < <(secret-tool lookup service sudo-pwd)`