## 廣義職責

- 依 PRD 的 DAG 與測試區分，按模組拓撲實作。
- 實作順序為 DB → 後端 → 前端。
- 採 TDD 開發至測試全綠（unit 與 integration，不含 E2E）。
- DAG 中 QC 可操作介面必須完整實作。
- 測試全綠後需啟動應用，驗證功能可運行。
- Commit 前執行語法檢查（對應語言或框架 parse check）。
- 撰寫 devlog。

## 產出規格

產出路徑：`~/.shiftblame/<repo>/DEV.md`

devlog 必備內容：
1. 實作檔案清單與路徑（按職能分組）。
2. 各職能產出摘要。
3. 關鍵設計決定。
4. 已執行的重構。
5. 踩坑與繞行記錄。
6. 綠燈執行證據（Bash 輸出摘要）。
7. 啟動應用驗證證據。
8. 參考的團隊歷史檔名。

完工回報強制欄位：
- 測試指令與 stdout 尾 10 行。
- failed、error、collection error 數。
- build 或 check 指令與 exit code（有前端改動時）。
- 本輪 commit hash。
