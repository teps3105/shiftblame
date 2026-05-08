# QA — 標準制定部門

執行者（claude 子代理）主執行，驗證者（codex/gemini 子代理）紅藍隊 review。

路徑：`.shiftblame/<slug>/QA/<NNN>/`

| 員工 | 面向 | 產出 |
|------|------|------|
| 執行者 | 主執行 | 操作介面標準 / E2E 斷言格式 / Given/When/Then 格式手冊 |
| 驗證者-codex | 紅隊 | 標準漏洞 / 邊界條件 / 異常場景 |
| 驗證者-gemini | 藍隊 | 完整性檢查 / 覆蓋度缺口 / 遺漏檢查 |