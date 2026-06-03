---
title: GATE/DISPATCH
---

# G1 — 派工

**時機**：派工給子代理前。**檢查**：`<slug>/SLUG.md` 與 `<slug>/<ROLE>/<NNN>/task.md` 是否存在。

`SLUG.md` 是本輪開發筆記，建立新 slug 的第一個 `task.md` 前必須存在。只承載開發中的工作日誌，不替代五檔，不得在收尾前整理進 ROADMAP。

**上游結論提供**：管理者提供上游已 PASS 的 conclusion.md 摘要（含本輪功能、背景、範圍、ROADMAP 參考項目）。

**PRD/SOP 參照**：派工給 PM 時一併提供相關 PRD；派工給 DEV 時一併提供相關 SOP 並明確要求遵循。非強制參照（不存在時不阻塞）。

**DEV 前置選擇**：管理者必須先取得老闆選擇的功能，寫入 `task.md`。描述必須是老闆看得懂的作品效果，不得只寫技術術語。

**紅藍隊模式**：固定使用本環境子代理。task.md 的 `review` 欄位寫為 `local`，同一 slug 後續任務沿用。

| 情境 | 動作 |
|------|------|
| `SLUG.md` 與 `task.md` 存在 | 通過 |
| 缺 `SLUG.md` | BLOCK：先建立 `<slug>/SLUG.md` |
| 目錄存在但無 `task.md` | BLOCK：先建立 task.md |
| 無對應目錄 | BLOCK：先建立目錄結構、SLUG.md 與 task.md |

## 模板

SLUG.md frontmatter：`slug`, `status: in_progress`, `created`, `updated`。正文段落：1.本輪目標 2.管線狀態紀錄 3.殘餘風險與交接事項 4.BossPreview/退回紀錄 5.待收尾整理。

task.md frontmatter：`slug`, `role: <ROLE>`, `round: <NNN>`, `status: PENDING`, `created_at: <ISO 8601>`, `trigger`, `review: local`, `upstream`。正文含 `# <ROLE>/<NNN> <觸發原因>任務：<標題>` 與 `## 宣告`。

## 建立規則

- `NNN` 為三位數零填充（001, 002, …），省略時自動遞增。
- 已存在 `task.md` 時不覆寫。
- STATUS 合法值：PENDING、DECLARED、APPROVED、EXECUTED（全部大寫）。
