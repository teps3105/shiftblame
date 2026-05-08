# QA — 品保部門

執行者（claude 子代理）主執行，驗證者（codex/gemini 子代理）紅藍隊 review。

路徑：`.shiftblame/<slug>/QA/<NNN>/`

| 員工 | 面向 | 產出 |
|------|------|------|
| 執行者 | 執行 | E2E 操作介面標準 |
| 驗證者-codex | 紅隊 | 標準漏洞 / 邊界條件 / 異常場景 |
| 驗證者-gemini | 藍隊 | 完整性檢查 / 覆蓋度缺口 / 遺漏檢查 |

## 執行者規則

1. API 端點（method / path / request body / response schema / 錯誤碼）
2. CLI 命令（usage / 必要參數 / 輸出格式 / 範例）
3. UI 操作（如適用：操作序列 / 預期結果 / 截圖或 DOM 定位）
4. 每條標準附 Given/When/Then 斷言格式