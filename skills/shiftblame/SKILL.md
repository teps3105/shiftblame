---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作開發框架
三名員工在同一 worktree 協作。claude 直接執行或 Agent 子代理（所有角色）；codex/gemini 透過 CLI（僅研究 + 監督）。

## 角色與流程
| 員工 | 身份 | 職責 |
|------|------|------|
| claude | 主執行者（固定） | 獨佔 worktree，開發與驗證 |
| codex | 監督者（固定） | 邏輯正確性 + 測試覆蓋度 |
| gemini | 監督者（固定） | 功能完整性 + 規格一致性 |
```
L1: 研究 → 收尾
L2: 研究 → PRD → DEV → 收尾
L3: 研究 → PRD → SEC → QA → DEV → QC → 收尾
```
## 部門
| 類型 | 部門 | 機制 |
|:---:|:---:|---|
| 研究 | SEC/QA/PRD | 三方各寫 proposal → conclusion.md |
| 開發 | DEV | claude 主執行 + codex/gemini 監督 review |
| 驗證 | QC（L3） | 三方各自獨立驗證 → conclusion.md |
## 通訊目錄
```
.shiftblame/<slug>/{meta.md, worktree/, <DEPT>/<NNN>/
  task.md, conclusion.md, {claude,codex,gemini}/{proposal,result,review}.md}
```
## 閘門
- **DEV→QC**：E2E 驗證 + 老闆覆核
- **QC→DEV**：修正後再 E2E + 老闆覆核
- **部門完成**：review.md 均通過
## 篇幅限制
所有產出（task.md / conclusion.md / proposal.md / result.md / review.md）各以 50 行為上限，超過拆入下個 NNN。
## 定義檔
`SECRETARY.md` `MANAGER.md` `STAFF.md` `DEPT/{SEC,QA,PRD,DEV,QC}.md`
確認 `.shiftblame/REPO.md` 存在，不存在 → 報告「尚未初始化」。關鍵字觸發流程。
