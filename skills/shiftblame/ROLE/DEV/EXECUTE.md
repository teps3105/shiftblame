# DEV EXECUTE — L2 產出

> 階段：L2 ｜ 執行者：依複雜度（對話內 / 子代理）｜ 上下文：見 MANAGE.md

## 子代理上下文需求

若判定為高複雜度需開子代理，派工 prompt 必須提供：

1. **角色**：DEV 執行者
2. **任務**：task.md 宣告內容
3. **背景**：REPO.md、ROADMAP.md（管理者摘要）
4. **上游**：PM conclusion.md（下游必讀）
5. **讀寫規則**：Claude 環境優先使用 Read/Write/Edit Tool；Codex 使用 Get-Content/apply_patch/Out-File（均 -Encoding UTF8）。禁止未指定 UTF8 讀取中文 Markdown。臨時檔案存放 `.shiftblame/tmp/`。

## 產出規範

- 目標導向 result.md（self-contained，禁止引用其他文件）
- **所有測試在 L2 完成**：GWT 逐條驗證、邊界測試、端到端實機驗收。L4 不重跑測試，僅做品質團隊角度的內部驗證
- 程式碼 EXECUTED 後鎖定，L3/L4 期間不得修改（發現問題退回 DECLARED 重新宣告）

## result.md 產出格式

```markdown
---
slug: <slug>
role: DEV
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
---

# result.md — <slug> DEV/<NNN>

## 變更摘要

（執行者填入工作成果摘要）

## 修改檔案清單

| 檔案 | 變更內容 |
|------|---------|
| （路徑） | （描述） |

## 驗證

（執行者填入驗證方式與結果）
```
