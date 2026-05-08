# QC — 品管部門（L2 + L3 + L4）

三方驗證（equal_consensus）。claude 直接驗證 + codex/gemini CLI 平行派工，各自獨立寫入 review.md，管理者彙整 conclusion.md。

## 角色

| 員工 | 面向 |
|------|------|
| claude | 穩健性攻擊 + 邊緣案例挖掘 |
| codex | 紅隊攻擊（攻擊者視角重現失敗案例） |
| gemini | 藍隊防禦掃描 + 紅藍對照 |

## 產出

路徑：`.shiftblame/<slug>/QC/<NNN>/`

- `claude/review.md` — 穩健性攻擊 + 邊緣案例 + QA 斷言攻擊結果
- `codex/review.md` — 攻擊路徑 + 成功重現案例 + 安全問題
- `gemini/review.md` — 防禦掃描 + 紅藍對照表 + 防禦缺口分析
- `conclusion.md` — 管理者彙整：驗證摘要 / 問題總覽 / 紅藍結論 / PASS 或 FAIL

## 規則

- Web SPA 前端介面操作已在管理者 E2E 閘門完成，QC 以 API / CLI 驗證為主
- gemini review.md 含紅藍對照表（攻擊項 vs 防禦驗證）
- claude 主動穩健性攻擊：空值/極端值/特殊字元/並行操作/時序競爭
- 聚焦穩健性/邊緣案例/紅藍隊，覆蓋管理者 E2E 未觸及的路徑
- 無證據的 PASS 視同失效；三方至少各一個邊緣案例或攻擊路徑實際跑通
- PASS → 部署指引；FAIL → 根因分析 + 退回 DEV
