# PM RESULT — L2 驗收成果

> 階段：L2 ｜ 執行者：依複雜度（對話內 / 子代理）｜ 上下文：見 MANAGE.md ｜ 所屬期別：研究期

## 子代理上下文需求

若判定為高複雜度需開子代理，派工 prompt 必須提供：

1. **角色**：研究品管 驗收者（非執行者）
2. **任務**：task.md 執行成果內容
3. **背景**：REPO.md、ROADMAP.md（管理者摘要）
4. **上游**：前一輪 conclusion.md（若有）
5. **面向**：自動綁定 — 研究期=研究面向、品管期=品管面向，及對應的面向差異指引
6. **讀寫規則**：遵守 `MANAGE.md`「編碼規則」。禁止未指定 UTF-8 讀取中文 Markdown；

   ```bash
   mkdir -p .shiftblame/tmp
   # 臨時檔案存放 .shiftblame/tmp/
   ```

## 驗收規範

- L2 為**驗收成果**角色，非執行角色
- 驗收 L1 執行成果是否正確：計畫是否已執行、品質標準是否達成
- ```bash
  # Write .shiftblame/<slug>/PM/<NNN>/result.md — 驗收報告（self-contained，禁止引用其他文件）
  ```
- 驗收者不修改任何檔案，僅檢驗與報告
- 品質標準驗收：安全要求、GWT 測試案例、驗收條件

### 面向差異

| | 研究面向 | 品管面向 |
|---|---|---|
| 驗收焦點 | 功能規格完整性、GWT 案例可執行性、前端設計可交接性 | 品質標準是否校正完成、偏移是否已識別與修正、一致性檢查是否通過 |

## frontmatter status 說明

result.md frontmatter `status` 記錄的是**被驗收的 L1 執行狀態**（EXECUTED），而非 L2 驗收結果（APPROVED）。GATE.md 狀態機的 APPROVED 是管線閘門狀態，與 frontmatter status 是不同層級的記錄。兩者各司其職：frontmatter 記錄產物來源狀態，閘門記錄管線推進狀態。

## result.md 產出格式

```markdown
---
slug: <slug>
role: PM
aspect: <研究/品管>
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
---

# result.md（驗收報告） — <slug> PM/<NNN>

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
