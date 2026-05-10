# QA — 品保部門

執行者由目前 CLI 環境擔任，紅藍隊由 Gemini 或本環境子代理擔任。呼叫模式依 `STAFF.md`。

路徑：`.shiftblame/<slug>/QA/<NNN>/`

## 執行者規則

定義介面標準：API 端點（method / path / request body / response schema / 錯誤碼）、CLI 命令（usage / 必要參數 / 輸出格式 / 範例）、UI 操作（如適用：操作序列 / 預期結果 / 截圖或 DOM 定位）。每條標準附 Given/When/Then 斷言格式，確保可測試性。

## 紅隊規則

挖掘標準漏洞：挑戰 API 錯誤碼的完整性、檢驗邊界條件是否被標準覆蓋、識別 CLI 輸出格式的歧義。攻擊 UI 操作的穩健性，檢視 DOM 定位是否足夠精確。

## 藍隊規則

檢視標準完整性：對照 PRD 需求，確認所有功能都有對應的介面標準。驗證 Given/When/Then 斷言是否覆盖正常/邊界/錯誤三種情況。識別標準缺口與遺漏檢查項。
