---
title: SOP
type: FOUR_FILE
role: sop
status: active
updated: <YYYY-MM-DD>
---
# SOP — 專案執行準則

> **當下紀律**筆記本（原則 6.0：SOP=當下）。開工必讀必執行的規則、目標與項目。三層租約長期層。性質：當下／規範性。所有目標統一寫入本文件（原則13）；未證實需求寫 PRD（原則6.3）。

## 當前目標

（所有目標統一寫此，含長期／當前／附加條件）

## 已知問題

（變更前體驗記錄的使用者體驗、缺陷、BUG；修正後標記解決狀態）

## 反面教訓（方向性，非單案）

（方向錯誤被否決撤回時，提煉為方向性紀律記此；不保留單案 slug 名與具體系統內容；單案隨 slug 歸 `archive/`）

## 執行準則

（專案特定執行規範。ROLE/ 涵蓋職責＋越權防線，專案細項由此增補）

- **定義檔規範**：每檔 ≤50 行（含 frontmatter）；單一權威（每條規則只在一處定義）；正向表述；UTF-8。方向修正須重整非貼上（舊版移 `archive/`）；錯誤歷史直接移除重寫為當前真相（框架定義檔），PID 適用「事實保留＋`superseded` 標註」（原則 6.4，不刪只追加變更紀錄）
- **NNN=Commit 紀律**：每個 NNN 走完整輪（正→反→收斂→實作意圖揭露→老闆確認→EXECUTOR 實作；commit 與驗收解耦）後管理者 commit 一次；NNN 無 gate/PASS/FAIL，推進由老闆指示。Commit 訊息 `<type>: <繁體中文描述>`（不帶 slug scope）；Merge commit `merge(slug): <繁體中文成果>`。所有 commit 由管理者執行，正方/反方/EXECUTOR 禁 commit；管線 commit 在 `feat/<slug>`
- **租約／會話／產物**：三層租約 SOP（長期）｜SLUG §7（中期）｜SKILL+GATE+ROLE/（短期），長期未載入→入口閘門 FAIL。會話由老闆自由管理；`.shiftblame/` 不在 repo（gitignore）；本地產物納入 `.gitignore`，正式產物明確標示

## PRD/PID 固化判定流（原則 6 收尾同步）

收尾同步方向單向：slug 成果→PID（固化）→SOP（衍生新紀律）→PRD（status 流轉），禁反向改寫。① 新功能／新標準→建對應 PID（`implemented`）＋PRD 轉 `implemented`＋雙向 wiki link；② 方向被否決撤回→PRD 轉 `archived`（老闆拍板），**不建 PID**；③ 修正既有功能→更新既有 PID 變更紀錄＋對應 PRD（若存在）轉 `implemented`。無對應 PRD 的獨立 PID 省略 `prd` 連結、變更紀錄註明來源。

## 未完成項目

（待執行清單，收尾時從管理者回歸更新同步）

## 已完成項目

| 日期 | Slug | 摘要 |
|------|------|------|
| | | |

## References

- [[REPO]]、[[ROADMAP]]、[[GRAPH]]
