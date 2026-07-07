---
title: SOP
type: TWO_FILE
role: sop
status: active
updated: <YYYY-MM-DD>
---
# SOP — 專案執行準則

> **當下紀律**（原則6：SOP=當下）。開工必讀必執行的規則與目標。三層租約長期層。禁日誌式（逐次變更流水帳）、寫當下事實、禁教訓式表述；過去事實以 git 歷史為權威。所有目標統一寫入本文件（原則13）。

## 當前目標

（所有目標統一寫此，含長期／當前／附加條件）

## 已知問題

（變更前體驗記錄的使用者體驗、缺陷、BUG；修正後標記解決狀態）

## 執行準則

（專案特定執行規範。ROLE/ 涵蓋職責＋越權防線，專案細項由此增補）

- **定義檔規範**：每檔 ≤50 行（含 frontmatter）；單一權威（每條規則只在一處定義）；正向表述；UTF-8。方向修正須重整非貼上（舊版移 `archive/`）；錯誤歷史直接移除重寫為當前真相
- **文件衛生**：禁日誌式（逐次變更流水帳）、寫當下事實、禁教訓式表述（措辭模式：推翻/經N輪/TRANSFERRED from/TD由X解決/反面教訓）；過去事實以 git 歷史為權威
- **<task> Commit／post-EXECUTOR 紀律**：每個 <nnn> 雙軌收斂後 EXECUTOR 逐項實作 <task>，每項自驗通過即 commit（對照 <complete>）。EXECUTOR 自驗/build 只算證據，不等於獨立 review/e2e；`<task>` 執行完後必須由 read-only 子代理或 AUDIT 外部工具獨立審核，並審 e2e 證據／未驗項。Commit 訊息 `<type>: <繁體中文描述>`，描述≤20 codepoint；驗證：`...| sed 's/^[^:]*: //' | python -c "import sys;print(len(sys.stdin.readline().rstrip()))"` ≤20。EXECUTOR 精準 add，`.shiftblame/` 永不 commit；管理者保留 merge。管線 commit 在 `feat/<slug>`
- **租約／會話／產物**：三層租約 SOP（長期）｜SLUG §7（中期）｜SKILL+GATE+ROLE/（短期），長期未載入→入口閘門 FAIL。會話由老闆自由管理；`.shiftblame/` 不在 repo（gitignore）；本地產物納入 `.gitignore`，正式產物明確標示

## References

- [[ROADMAP]]
