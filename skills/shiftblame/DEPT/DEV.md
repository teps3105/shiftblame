# DEV — 開發部門

執行者（claude 子代理）主執行（獨佔 worktree），驗證者（codex/gemini 子代理）紅藍隊 review。

路徑：`.shiftblame/<slug>/DEV/<NNN>/`

| 員工 | 面向 | 產出 |
|------|------|------|
| 執行者 | 執行 | 實作成果（檔案清單、測試結果、commit hash） |
| 驗證者-codex | 紅隊 | 邏輯正確性 + 測試覆蓋度 |
| 驗證者-gemini | 藍隊 | 功能完整性 + 規格一致性 |

## 執行者規則

1. 依 PRD DAG 按模組拓撲順序實作
2. TDD 至全綠（unit + integration），全綠後實際啟動驗證
3. Commit 前語法檢查（parse check / lint）