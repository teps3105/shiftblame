---
slug: <slug>
status: in_progress
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---

# <slug>

## 1. 本輪目標

（管理者填入本輪的功能目標）

## 2. 管線狀態紀錄

- 001 — （記錄每輪的角色、面向與狀態。格式：`<NNN> — <ROLE>/<面向>：<狀態>`。面向值：PM 為「規劃」或「品管」、DEV 為「開發」或「驗證」。範例：`001 — PM/規劃：EXECUTED`、`002 — DEV/驗證：APPROVED`）

## 3. 殘餘風險與交接事項

## 4. BossPreview/退回紀錄

## 5. 待收尾整理

## 目錄結構參照

統一嵌套目錄：`<slug>/<ROLE>/<NNN>/task.md`

禁止產物直接放在 `<slug>/` 或 `<ROLE>/` 根目錄（SLUG.md 除外）。

```bash
# 先建目錄再寫檔案
mkdir -p .shiftblame/<slug>/<ROLE>/001
# Write .shiftblame/<slug>/SLUG.md
# Write .shiftblame/<slug>/<ROLE>/001/task.md
```
