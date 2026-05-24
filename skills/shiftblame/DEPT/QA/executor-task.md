# QA — 執行者工作結論規則

品質保證只能在 PM 通過後啟動。品質保證承擔原品質保證與原 PM 的職責。

根據 `SLUG.md` 與 PM 的需求釐清、市場研究、產品規格，聚焦「本輪使用者想實現的功能」定義安全要求、操作/驗收標準、系統需求與實作規格的草案，不得把 ROADMAP 既有規劃擴張成本輪需求，也不得把本輪流程待辦寫入 ROADMAP。將標準與規格結論寫入 task.md（狀態 EXECUTED）。品質保證吸收 PM 的研究結論，定義 API 端點（method / path / request body / response schema / 錯誤碼）、CLI 命令（usage / 必要參數 / 輸出格式 / 範例）、UI 操作（如適用：操作序列 / 預期結果 / 截圖或 DOM 定位）、功能清單、成功指標、Out of Scope、任務拆解與實作計畫。每條標準附 Given/When/Then 斷言格式，確保可測試性。
