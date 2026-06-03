# PM EXECUTE — L2 產出

> 階段：L2 ｜ 執行者：依複雜度（對話內 / 子代理）｜ 上下文：見 MANAGE.md

## 子代理上下文需求

若判定為高複雜度需開子代理，派工 prompt 必須提供：

1. **角色**：PM 執行者
2. **任務**：task.md 宣告內容
3. **背景**：REPO.md、ROADMAP.md（管理者摘要）
4. **上游**：前一輪 conclusion.md（若有）
5. **讀寫規則**：Claude 環境優先使用 Read/Write/Edit Tool；Codex 使用 Get-Content/apply_patch/Out-File（均 -Encoding UTF8）。禁止未指定 UTF8 讀取中文 Markdown。臨時檔案存放 `.shiftblame/tmp/`。

## 產出規範

- 目標導向 result.md（self-contained，禁止引用其他文件）
- 前端設計與視覺規格完整寫入
- 品質標準：安全要求、GWT 測試案例、驗譗條件

## result.md 產出格式

```markdown
---
slug: <slug>
role: PM
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
---

# result.md — <slug> PM/<NNN>

## 變更摘要

（執行者填入工作成果摘要）

## 修改檔案清單

| 檔案 | 變更內容 |
|------|---------|
| （路徑） | （描述） |

## 驗證

（執行者填入驗證方式與結果）
```
