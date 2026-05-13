# PM — 產品管理部門

執行者由目前環境擔任，紅藍隊固定由本環境子代理擔任。呼叫模式依 `STAFF.md`。

路徑：`.shiftblame/<slug>/PM/<NNN>/`

## 執行者規則

PM 是功能開發管線的第一個部門。根據 task.md，釐清本輪使用者真正想實現的功能、現有 repo/REPO.md/ROADMAP.md 的相關背景、本輪範圍與非本輪事項，並調查建立標準前需要知道的市場研究、通用方法、設計模式、CVE 或版本差異。`result.md` 必須包含三段：BRD（Business Requirements Document）、MRD（Market Requirements Document）、PRD（Product Requirements Document）。不得建立 `BRD.md`、`MRD.md` 或 `PRD.md`；三段都必須寫在同一份 `result.md`。ROADMAP 只能列為背景或後續候選，不得自動納入本輪。

## 紅隊規則

從研究可信度、需求完整性與範圍控制攻擊：檢查 BRD 是否忠於本輪使用者要求，MRD 是否涵蓋市場、通用方法、設計、CVE 或版本差異研究，PRD 是否清楚定義本輪產品目標與 Out of Scope。特別攻擊「把 ROADMAP 當成本輪需求」、「市場研究不足以支撐 QA 建標準」與「PRD 過早偷渡實作細節」的風險。

## 藍隊規則

從可交接給 QA 的完整性檢視：確認 BRD、MRD、PRD 三段能讓 QA 直接建立 SEC、SOP、SRS，且本輪使用者要求、現有系統背景、市場/通用方法/設計/CVE/版本差異皆有清楚取捨。逐項回應紅隊攻擊，判定哪些已補強、哪些是可接受限制、哪些必須退回 PM 重做。
