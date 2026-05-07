---
name: shiftblame
description: >-
  框架入口。五部門四等級單向流程開發框架的調度核心。
  Use this skill when: the user says  "開始", "start", "開工", "let's go",
  "開始吧", "來吧", "動工", "起動", "開幹", "go", "begin", "go ahead",
  or any phrase signaling the start of a task/work/session.
---

> 所有路徑基於專案根目錄解析，執行時由 task.md 提供絕對路徑。

## 四等級流程

```
L1: 秘書研究 → 秘書收尾
L2: 秘書研究 → PRD → DEV → QC → 秘書收尾
L3: 秘書研究 → QA → PRD → DEV → QC → 秘書收尾
L4: 秘書研究 → SEC → QA → PRD → DEV → QC → 秘書收尾
```

## 框架定義檔

所有框架定義檔存放在 **框架定義檔目錄** `skills/shiftblame/`

| 檔案 | 內容 |
|------|------|
| `SKILL.md` | 框架入口 |
| `SECRETARY.md` | 秘書準則 |
| `MANAGER.md` | 管理者定義|
| `STAFF.md` | 員工呼叫規格 |
| `DEPT/SEC.md` | 資安部門定義 |
| `DEPT/QA.md` | 品保部門定義 |
| `DEPT/PRD.md` | 產品部門定義 |
| `DEPT/DEV.md` | 開發部門定義 |
| `DEPT/QC.md` | 品管部門定義 |

## 部門分類

| 類型 | 部門 | 產出 |
|------|------|------|
| 研究部門 | SEC / QA / PRD | proposal.md → 管理者寫 conclusion.md |
| 開發部門 | DEV | proposal.md → conclusion.md (001) / conclusion.md + result.md + review.md (002+) |
| 三方驗證 | QC | 三方 review.md（claude 穩健性+邊緣案例，codex 紅隊攻擊，gemini 藍隊防禦+紅藍對照）→ 管理者寫 conclusion.md |

## 開發部門循環機制

開發部門採循環推進（001 規劃 → 002 首次執行 → 003+ 修正）：

| 角色 | 寫入 | 說明 |
|------|------|------|
| 三方 CLI | proposal.md | 001 各自分析寫入提案（含四項開工準則） |
| 管理者 | conclusion.md | 001 彙整三方提案為規劃結論 |
| 管理者 | conclusion.md | 002+ 彙整當次執行 result + review 為結論 |
| 主執行者 | result.md | 002+ 實際執行成果 |
| 監督者 | review.md | 002+ 逐條驗證 result.md 項目是否確實完成 |

主執行者固定為 claude，codex 與 gemini 固定擔任監督者。QC 為三方獨立驗證（equal_consensus），三方各寫 review.md，管理者彙整 conclusion.md。DEV→QC 間有管理者 E2E 實際驗證閘門 + 老闆覆核（clarify 呈報）。QC 退回 DEV 修正後需再次 E2E + 老闆覆核。

### 監督者面向分工

| 監督者 | 面向 | 檢視重點 |
|--------|------|----------|
| codex | 邏輯正確性 + 測試覆蓋度 | 靜態分析、代碼審查、邏輯分支完整性、測試覆蓋度、邊界條件處理 |
| gemini | 功能完整性 + 規格一致性 | 對照 PRD 驗證需求覆蓋、功能端到端完整性、規格偏差、遺漏功能 |

- 001: proposal → conclusion（純規劃，和研究部門結構相同）
- 002: 管理者發布 task.md（老闆覆核後派工）→ result + review → 管理者寫 conclusion → 判定（首次執行）
- 003+: 管理者發布 task.md（老闆覆核後派工）→ result + review → 管理者寫 conclusion → 判定（修正循環）
- review 通過 → 完成；有問題 → 開新 NNN
- 同一部門最多 5 個子循環（001~005），超過退回上游

## 主執行者向上請求支援

主執行者在 result.md 寫入 `[SUPPORT_REQUEST: TOOL/ASSIST]`：
- TOOL：管理者增加工具後重新派工
- ASSIST：管理者代為處理受阻任務
