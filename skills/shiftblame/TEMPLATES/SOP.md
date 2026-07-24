---
title: SOP
type: TWO_FILE
role: sop
status: active
updated: <YYYY-MM-DD>
---
# SOP — 專案執行準則

> 跨 `<slug>` 不變的當下紀律。建立/修改 MUST 經意圖揭露(SBM-SKILL §7)。狀態與內容分離(見 SBM-SKILL §4 #4)。

## 1. 執行準則

<!-- 各專案 MUST 於此填入。資料型內容表格化(見 SBM-SKILL §4 #6)。 -->

| 項目 | 內容 |
|------|------|
| 技術棧 | |
| 架構事實 | |
| 測試/驗收方式 | |
| commit 慣例 | |
| 協作模式 | 單人 / 多人(決定分支政策,見 SBM-SKILL §8) |

## 2. 文件保鮮

對齊 SBM-SKILL §4(六不變量)、§6(證據/引用)。保鮮重寫流程與測試資產盤點於 SBM-GATE §7 收尾程序執行,本節不重複。

## 3. 測試資產治理

| 面向 | 準則 |
|------|------|
| 進 repo 判準 | 測試 MUST 驗證行為;鎖定類(字串常數/座標/hash)SHOULD NOT,限契約本質需要並附維護條件 |
| 命名 | 檔名/docstring/screenshot/fixture MUST NOT 含 slug/task/session 編號;MUST 用語意命名 |
| 顆粒度 | 覆蓋行為面(輸入→輸出、狀態轉換、邊界),非單一字串/座標存在 |
| PASS 前盤點 | 探索性測試歸 `.shiftblame/tmp/`;重複契約合併;命名去編號語意化(各專案自訂具體步驟) |

## 4. 生成式資產取用

| 條件 | 處理 |
|------|------|
| 工程化複雜度拖累進度 | 程式碼生成或 AI 生成(邊界閾值各專案自訂) |
| demo 視覺草稿 | 放 `.shiftblame/tmp/`;commit message MUST 標記「demo」 |

## 5. 寫入保護

SOP 內容只能在 `<slug>` 收尾或老闆明示時加入。規劃/實作/審查階段的決策、契約、素材清單、選型歸 SLUG 租約。違反即越欄。
