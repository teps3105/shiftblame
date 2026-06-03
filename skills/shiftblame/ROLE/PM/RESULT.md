# PM RESULT — L2 驗收

> 階段：L2 ｜ 執行者：依複雜度（對話內 / 子代理）｜ 上下文：見 MANAGE.md

## 子代理上下文需求

若判定為高複雜度需開子代理，派工 prompt 必須提供：

1. **角色**：PM 驗收者（非執行者）
2. **任務**：task.md 執行成果內容
3. **背景**：REPO.md、ROADMAP.md（管理者摘要）
4. **上游**：前一輪 conclusion.md（若有）
5. **讀寫規則**：Claude 環境優先使用 Read/Write/Edit Tool；Codex 使用 Get-Content/apply_patch/Out-File（均 -Encoding UTF8）。禁止未指定 UTF8 讀取中文 Markdown。臨時檔案存放 `.shiftblame/tmp/`。

## 驗收規範

- L2 為**驗收**角色，非執行角色
- 驗收 L1 執行成果是否正確：計畫是否已執行、品質標準是否達成
- 產出驗收報告 result.md（self-contained，禁止引用其他文件）
- 驗收者不修改任何檔案，僅檢驗與報告
- 品質標準驗收：安全要求、GWT 測試案例、驗收條件

## result.md 產出格式

```markdown
---
slug: <slug>
role: PM
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
---

# result.md（驗收報告） — <slug> PM/<NNN>

## 驗收摘要

（驗收者填入整體評估）

## 驗收項目

### C1: （驗收項目標題）
- **判定**：通過 / 未通過
- **說明**：（驗收說明）

## 綜合結論

PASS / FAIL
```
