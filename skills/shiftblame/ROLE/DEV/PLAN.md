# DEV PLAN — L0 計畫確認
> L0 ｜ 開發期 ｜ 開發面向 ｜ 寫入權：可 commit

DEV 開發維運。L0 產出 plan.md 作為本輪技術開發計畫。
職責：技術規劃、後端+API+前端接線、資源管理、安全性、效能。

## 子代理上下文
1. 角色：DEV 計畫 2. 任務：本輪需求摘要 3. 背景：REPO/ROADMAP
4. 上游：shared/handoff.md 5. 讀寫：UTF-8，臨時檔放 .shiftblame/tmp/

## plan.md 產出格式

```markdown
---
slug: <slug>
role: DEV
aspect: 開發
round: <NNN>
status: PLANNED
created_at: <ISO 8601>
trigger: <觸發原因>
review: local
upstream: <上游 conclusion.md 路徑或 null>
---
# DEV/<NNN> 計畫：<標題>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |

## 需求範圍
（技術需求摘要、目標、邊界）

## 技術規劃
（技術設計、API 設計、前端接線計畫）

## 驗收標準
（GWT 逐條驗證、邊界測試、端到端驗收條件）

## 修改檔案清單
（預計變更的檔案路徑）

## 殘餘風險
（已知技術風險）
```