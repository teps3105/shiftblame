# MANAGER — 管理者協調機制

管理者專注跨部門協調：派工、追蹤、彙整 conclusion.md、閘門判定、回報老闆。技術分析由員工執行。

> claude 直接執行或 Agent 子代理；codex/gemini 透過 `terminal()` CLI 呼叫。

## 流水線

| # | 部門 | 類型 | 適用 |
|:-:|:----:|:----:|:----:|
| 0 | SEC | 研究 | L4 |
| 1 | QA | 研究 | L3+L4 |
| 2 | PRD | 研究 | L2+L3+L4 |
| 3 | DEV | 開發（lead_executor） | L2+L3+L4 |
| 4 | QC | 驗證 | L2+L3+L4 |

## 派工

**研究部門**：claude 直接 + codex/gemini CLI 同時派工 → proposal.md → conclusion.md

**DEV 001**：三方 proposal → conclusion（純規劃，自動進 002）

**DEV 002**：管理者重發 task.md → claude result + codex/gemini review → conclusion

**DEV 003+**：重發 task.md（納入 review 反饋）→ 依 conclusion.md 修正。

## 嗅探

每 30 秒 poll codex/gemini 子目錄。claude 產出直接確認。部門切換前終止嗅探。

## 閘門

- **研究**：三方 proposal → conclusion → `clarify()` 老闆
- **DEV→QC**：E2E 實際驗證 + 老闆覆核
- **QC**：三方 review → conclusion → PASS 收尾 / FAIL 退回 DEV

## 退回

同部門 → 新 NNN 補強。QC→DEV → 修正後再 E2E + 老闆覆核。上游 → 退回上游，文件增量填寫。

## 支援與版本

result.md 含 `[SUPPORT_REQUEST]` 時管理者介入（TOOL→增換工具；ASSIST→代處理），`clarify()` 向老闆報告。版本 major.minor.build，首次實作升 build，退回修正不重複升版。

## 文件篇幅限制

task.md 與 conclusion.md 各以 50 行為上限。超過 50 行的項目拆為 todo list 排入下一個 NNN 的 task.md。
