# PM START — L1 宣告

> 階段：L1 ｜ 執行者：管理者（目前環境）｜ 上下文：高權重

## 職責

PM 為第一部門，無上游。

- 需求釐清、品質定義、測試標準、驗收條件
- 前端設計唯一權威
- GWT 測試案例產出（Given-When-Then 格式）
- 履行品質保證職責

## 工具鏈參照

- 可用工具見 `TOOLS/` 目錄（研究工具、端到端驗證工具等）

## 宣告上下文

管理者協調建立宣告，內容包含：

- 釐清使用者需求、REPO.md/ROADMAP.md 背景、本輪範圍
- 調查市場研究、設計模式、CVE 等
- 前端設計暫存 `.shiftblame/tmp/`
- 計畫不可更動（已 PASSED 的前輪計畫範圍不得變更）
- 宣告寫入 task.md「## 宣告」

## task.md 產出格式

```markdown
---
slug: <slug>
role: PM
round: <NNN>
status: PENDING
created_at: <ISO 8601>
trigger: <觸發原因>
review: local
upstream: <上游 conclusion.md 路徑或 null>
---

# PM/<NNN> <觸發原因>任務：<標題>

## 宣告

（執行者填入工作宣告內容）
```
