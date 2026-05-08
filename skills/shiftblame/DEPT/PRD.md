# PRD — 產品部門（L2 + L3 + L4）

研究部門。execution_model: equal_consensus。三方各寫 proposal.md，管理者彙整 conclusion.md。

## 產出

路徑：`.shiftblame/<slug>/PRD/<NNN>/`

**PRD**：產品名稱 / 背景與目標使用者 / 核心需求 / 成功指標 / Out of Scope / 斷言對測試項目對應表 / 原子任務清單（附前置依賴、預期產出、執行順序）

**DAG**：技術選型與理由 / 模組拓撲 / 資料流 / 檔案結構 / 關鍵 API 簽章 / QC 可操作介面（每條 QA 斷言至少一個，E2E 用 Given/When/Then）/ 測試區分與數量 / 部署方案 / 風險與取捨

## 規則

- 核心產出是 DAG 實作計畫，DEV 按模組拓撲順序執行
- QA 行為斷言拆分為 unit / integration / E2E 測試項目
- 設計前確認 worktree 環境，方案長在既有代碼上
- 技術選型附評估矩陣（複雜度、可維護性、效能）
- 搜尋用於查詢 API 文件與 Library 用法
- conclusion.md 寫入後保持計畫穩定
