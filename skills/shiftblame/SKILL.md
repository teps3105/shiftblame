---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作開發框架
三名員工在同一 worktree 協作。管理者（主 session）協調；執行者/驗證者（子代理）透過 CLI。

## 角色與流程
| 員工 | 身份 | 職責 |
|------|------|------|
| 管理者 | 主 session | 協調、派工、管線、閘門、收尾 |
| 執行者 | 子代理（claude） | 獨佔 worktree，產出 result.md |
| 驗證者 | 子代理（codex/gemini） | 產出 review.md |
```
L1: 執行 → 收尾
L2: 執行 → PRD → QA → DEV → QC → 收尾
```
## 部門
| 類型 | 部門 | 機制 |
|:---:|:---:|---|
| 規劃 | PRD | 執行者 result + 驗證者 review |
| 標準 | QA | 執行者 result + 驗證者 review |
| 開發 | DEV | 執行者 result + 驗證者 review |
| 驗證 | QC | 執行者 E2E + 驗證者 review |

## 通訊目錄
```
.shiftblame/<slug>/{meta.md, worktree/, <DEPT>/<NNN>/
  task.md, {執行者,驗證者}/{result,review}.md}
```
## 閘門
- **PRD/QA**：執行者/驗證者 result/review → `AskUserQuestion` 老闆確認
- **DEV→QC**：QC 執行者 E2E（chrome-devtools-mcp）+ 老闆覆核
- **QC→DEV**：QC 退回 → 上游新 NNN

## 篇幅限制
所有產出（task.md / result.md / review.md）各以 50 行為上限，超過拆入下個 NNN。

## 定義檔 / gitignore
`MANAGER.md` `STAFF.md` `DEPT/{PRD,QA,DEV,QC}.md`

`.shiftblame/` 為本地工作目錄，須列入 `.gitignore` 不納入版本控制。

確認 `.shiftblame/REPO.md` 存在，不存在 → 報告「尚未初始化」。關鍵字觸發流程。