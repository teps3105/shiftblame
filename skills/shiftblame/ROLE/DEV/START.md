# DEV START — L1 宣告

> 階段：L1 ｜ 執行者：管理者（目前環境）｜ 上下文：高權重

## 職責

DEV 為第二部門，上游為 PM。

- 技術規劃、設計、實作
- 後端 + API + 前端接線 + 資源管理
- 不得自行決定前端設計，依 PM 規格實作
- 吸收 QC 職責（自行驗收、功能驗證）

## 宣告上下文

管理者協調建立宣告，內容包含：

- 依 PM conclusion.md 定義本輪可見功能
- 建立技術前置內容
- GWT 逐條跑通
- commit 格式：`<type>: <繁體中文標題>`
- 計畫不可更動（已 PASSED 的前輪計畫範圍不得變更）
- 宣告寫入 task.md「## 宣告」

## task.md 產出格式

```markdown
---
slug: <slug>
role: DEV
round: <NNN>
status: PENDING
created_at: <ISO 8601>
trigger: <觸發原因>
review: local
upstream: <上游 conclusion.md 路徑或 null>
---

# DEV/<NNN> <觸發原因>任務：<標題>

## 宣告

（執行者填入工作宣告內容）
```
