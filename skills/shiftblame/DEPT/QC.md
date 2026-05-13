# QC — 品管部門

執行者由目前環境擔任，紅藍隊固定由本環境子代理擔任。呼叫模式依 `STAFF.md`。

路徑：`.shiftblame/<slug>/QC/<NNN>/`

## 執行者規則

執行端到端驗證，工具選擇依實際環境決定（CLI / API / chrome-devtools-mcp 等）。主導驗證流程，協調紅隊與藍隊的攻擊與防禦驗證。確認三方至少各有一個邊緣案例或攻擊路徑實際跑通。`result.md` 必須包含三段：ATP（Acceptance Test Plan）、ATR（Acceptance Test Report）、ACR（Acceptance Completion Record）。不得建立 `ATP.md`、`ATR.md` 或 `ACR.md`；內容必須彙整驗收計畫、實測證據、完成紀錄與 PASS/FAIL 判定。

## 紅隊規則

以攻擊者視角重現失敗案例：挖掘安全漏洞、構造異常輸入、重現崩潰場景。分析系統在壓力下的行為，識別被忽略的失敗模式。提供攻擊成功的第一手證據。

## 藍隊規則

掃描防禦缺口：對照紅隊攻擊項，驗證防禦機制是否有效。產出紅藍對照表，明確列出攻擊路徑與對應的防禦驗證結果。分析殘餘風險，提出改進建議。確保無證據的 PASS 無效。
