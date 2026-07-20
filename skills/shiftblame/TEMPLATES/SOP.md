---
title: SOP
type: TWO_FILE
role: sop
status: active
updated: <YYYY-MM-DD>
---
# SOP — 專案執行準則

> 跨 slug 不變的當下紀律。建立/修改 MUST 經意圖揭露（SBM-SKILL §4.1）。

## 1. 執行準則

<!-- 各專案 MUST 於此填入：技術棧、架構事實、測試/驗收方式、commit 慣例 -->

## 2. 文件保鮮

- 禁日誌式（流水帳）、禁教訓式（推翻/經N輪/TRANSFERRED/TD由X解決/反面教訓）。過去事實以 git 歷史為權威。
- `docs/` 每事實陳述附 `<檔案路徑>:<行號>`。
- slug PASS 前 MUST 重寫流程：`docs/`+`SOP.md`+`ROADMAP.md` 移至 `.shiftblame/tmp/` → 從當下 codebase 逐檔重寫 → 每個引用重新查核。

## 3. 測試資產治理

- 進 repo 判準：測試 MUST 驗證行為，SHOULD NOT 鎖定實作細節（字串常數/座標/hash）。鎖定類測試 MUST 限契約本質需要並附維護條件。
- 命名：測試檔名、docstring、screenshot、fixture MUST NOT 含 slug/task/session 編號；MUST 用語意命名。
- 顆粒度：覆蓋行為面（輸入→輸出、狀態轉換、邊界），非單一字串/座標存在。
- slug PASS 前盤點：刪探索性（歸 `.shiftblame/tmp/`）→ 合併重複契約 → 去編號 → fixtures 重組。

## 4. 生成式資產取用

以「工程化複雜度是否拖累進度」決定程式碼生成或 AI 生成（邊界閾值由各專案自訂）。demo 視覺草稿放 `.shiftblame/tmp/`，commit message MUST 標記「demo」。

## 5. 寫入保護

SOP 內容只能在 slug 收尾或老闆明示時加入。規劃/實作/審查階段的決策、契約、素材清單、選型歸 SLUG 租約。違反即越欄。
