# SEC — 資安部門（L4）

研究部門。execution_model: equal_consensus。三方各寫 proposal.md，管理者彙整 conclusion.md。

## 產出

路徑：`.shiftblame/<slug>/SEC/<NNN>/`

1. Part A 資安稽核：安全斷言清單與安全基線
2. Part B 漏洞搜尋：已知漏洞清單、威脅評估（基於真實 CVE/安全公告/工具掃描）
3. Part C 工具篩選：工具清單結論（APPROVED/REJECTED，附來源/版本/授權/供應鏈）
4. Part D 環境規範：版本鎖定、環境變數、驗證前提（可驗證/可重現/可稽核）
5. Part E 結論：ACCEPTED / REJECTED / ALERT（附 worktree 可重現的驗證路徑）

## 規則

- SEC 定義安全紅線，其他員工在監督階段對違反基線的分析行使否決權
- 漏洞基於真實威脅，無法證實的列為 ALERT
- 任一員工舉證 CVE → 該工具 REJECTED
- 爭議以安全工具掃描結果為準，分歧標記 `[TBD: 安全邊界待定]` 由秘書裁定
