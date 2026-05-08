# QC — 驗證部門

執行者（claude 子代理）主執行（E2E），驗證者（codex/gemini 子代理）紅藍隊 review。

路徑：`.shiftblame/<slug>/QC/<NNN>/`

| 員工 | 面向 | 產出 |
|------|------|------|
| 執行者 | 主執行 | E2E 操作（chrome-devtools-mcp）+ 穩健性攻擊 + 邊緣案例 |
| 驗證者-codex | 紅隊 | 紅隊攻擊（重現失敗案例）+ 安全問題 |
| 驗證者-gemini | 藍隊 | 藍隊防禦掃描 + 紅藍對照表 |

## 規則

- E2E 由 QC 執行者透過 chrome-devtools-mcp 執行（Web SPA 端到端操作）
- 三方至少各一個邊緣案例或攻擊路徑實際跑通
- 無證據的 PASS 視同失效
- PASS → 部署指引；FAIL → 根因分析 + 退回 DEV