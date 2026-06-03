# PM START — L1 宣告與實作

> 階段：L1 ｜ 執行者：管理者（目前環境）｜ 上下文：高權重

## 職責

PM 為第一部門，無上游。

- 需求釐清、品質定義、測試標準、驗收條件
- 前端設計唯一權威
- GWT 測試案例產出（Given-When-Then 格式）
- 履行品質保證職責

## 工具鏈參照

- 執行工具見 `TOOLS/` 目錄（設計工具、端到端驗證工具等），依專案類型對應使用

## L1 階段定義

L1 為**宣告與實作**階段：先宣告要做什麼，BossConfirm 通過後實作並宣告做了什麼。所有產出均在 L1 完成。

### 宣告（管理者）

管理者協調建立宣告，內容包含：

- 釐清使用者需求、REPO.md/ROADMAP.md 背景、本輪範圍
- 調查市場研究、設計模式、CVE 等
- 前端設計暫存 `.shiftblame/tmp/`
- 計畫不可更動（已 PASSED 的前輪計畫範圍不得變更）
- 宣告寫入 task.md「## 宣告」
- BossConfirm 通過後進入實作

### 實作（依複雜度）

L1 宣告通過 BossConfirm 後，執行者在同一階段完成所有實作：

- 依宣告內容執行所有產出（文件撰寫、設計產出、規格定義等）
- 實作成果寫入 task.md「## 實作成果」
- 前端設計與視覺規格完整寫入
- 品質標準：安全要求、GWT 測試案例、驗收條件
- 實作完成後 commit，進入 L2 驗收

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

（要做什麼 — 本輪計畫）

## 實作成果

（做了什麼 — 變更摘要、修改檔案清單、驗證方式與結果）
```
