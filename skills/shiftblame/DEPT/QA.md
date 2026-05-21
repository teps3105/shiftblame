# QA — 品保部門

執行者由目前環境擔任，紅藍隊固定由本環境子代理擔任。呼叫模式依 `STAFF.md`。

路徑：`.shiftblame/<slug>/QA/<NNN>/`

## 執行者規則

QA 只能在 PM 通過後啟動。根據 `SLUG.md` 與 PM 的 BRD、MRD、PRD，聚焦「本輪使用者想實現的功能」定義安全要求、操作/驗收標準、系統需求與實作規格，不得把 ROADMAP 既有規劃擴張成本輪需求，也不得把本輪流程待辦寫入 ROADMAP。QA 承擔原 QA 與原 PM 的職責：吸收 PM 的研究結論，定義 API 端點（method / path / request body / response schema / 錯誤碼）、CLI 命令（usage / 必要參數 / 輸出格式 / 範例）、UI 操作（如適用：操作序列 / 預期結果 / 截圖或 DOM 定位）、功能清單、成功指標、Out of Scope、任務拆解與實作計畫。每條標準附 Given/When/Then 斷言格式，確保可測試性。

`result.md` 必須包含三段：SEC（Security Requirements）、SOP（Standard Operating Procedure / 標準操作與驗收程序）、SRS（System Requirements Specification）。不得建立 `SEC.md`、`SOP.md` 或 `SRS.md`；三段都必須寫在同一份 `result.md`。SRS 必須讓 DEV 能依此建立 TPD、TDD、TIR，也讓 QC 後續可驗證。

## 紅隊規則

挖掘標準與規格漏洞：挑戰本輪功能範圍是否被誤解或膨脹，檢驗 SEC/SOP/SRS 是否足夠明確，API 錯誤碼、邊界條件、CLI 輸出格式與 UI 操作是否可測。特別攻擊「忽略 PM 的 BRD/MRD/PRD」、「SRS 無法支撐 DEV 建立 TPD/TDD/TIR」與「把 ROADMAP 規劃當成本輪需求」的風險。

## 藍隊規則

檢視標準與規格完整性：對照 PM 的 BRD/MRD/PRD 與本輪使用者要求，確認本輪功能都有對應的 SEC、SOP、SRS。驗證 Given/When/Then 斷言是否覆盖正常/邊界/錯誤三種情況。識別安全缺口、標準缺口、規格缺口、任務拆解缺口，以及任何超出本輪要求的範圍膨脹。
