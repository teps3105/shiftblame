# DEV RESULT — L2 驗收成果

> 階段：L2 ｜ 執行者：依複雜度（對話內 / 子代理）｜ 上下文：見 MANAGE.md

## 子代理上下文需求

若判定為高複雜度需開子代理，派工 prompt 必須提供：

1. **角色**：DEV 驗收者（非執行者）
2. **任務**：task.md 執行成果內容
3. **背景**：REPO.md、ROADMAP.md（管理者摘要）
4. **上游**：`shared/handoff.md`（跨部門交接文件，下游必讀）
5. **讀寫規則**：遵守 `MANAGE.md`「編碼規則」。禁止未指定 UTF-8 讀取中文 Markdown；臨時檔案存放 `.shiftblame/tmp/`。

## 驗收規範

- L2 為**驗收成果**角色，非執行角色
- 驗收 L1 執行成果是否正確：計畫是否已執行、功能是否完整
- 產出驗收報告 result.md（self-contained，禁止引用其他文件）
- 驗收者不修改任何檔案，僅檢驗與報告
- L4 不重跑測試，僅做品質團隊角度的防禦驗證

## result.md 產出格式

```markdown
---
slug: <slug>
role: DEV
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
---

# result.md（驗收報告） — <slug> DEV/<NNN>

## 階段生命週期

| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |
| 宣告完成 | | |
| 宣告通過 | | |

## 驗收摘要

（驗收者填入整體評估）

## 驗收項目

### C1: （驗收項目標題）
- **判定**：通過 / 未通過
- **說明**：（驗收說明）

## 綜合結論

PASS / FAIL
```
