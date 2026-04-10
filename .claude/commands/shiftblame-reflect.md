# shiftblame-reflect

聚合各角色的鍋紀錄（BLAME.md），將歷史條目提煉成條列式的「常識」規則，重新寫回各角色的 BLAME.md 檔案。

## 聚合邏輯

對每個角色的 `~/.shiftblame/blame/<role>/BLAME.md`：

1. 掃描所有 `## <slug> · <YYYY-MM-DD>` 區塊
2. 提煉「下次怎麼避免」欄位中的規則
3. 將規則聚合為條列式常識，格式：
   ```markdown
   ## 常識

   - [規則 1]
   - [規則 2]
   ...
   ```
4. 常識區塊置於檔案開頭（標題之後）
5. 原始歷史條目保留在常識區塊下方

## 執行步驟

1. 取得所有角色目錄：
   ```bash
   ls -1 ~/.shiftblame/blame/
   ```

2. 對每個角色：
   ```bash
   ROLE="<role-name>"
   BLAME_FILE="$HOME/.shiftblame/blame/$ROLE/BLAME.md"

   # 提煉常識（用 awk 或其他工具）
   # 寫入新格式：標題 → 常識區塊 → 原始條目
   ```

3. 回報結果：
   ```
   已更新 X 個角色的 BLAME.md：
   - <role1>: 提煉了 N 條常識
   - <role2>: 提煉了 M 條常識
   ...
   ```

## 輸出格式範例

```markdown
# <role> 鍋紀錄

## 常識

- 老闆說「修改」= 當前 repo（pwd）中的檔案，不是 ~/.claude/
- 開工前必須先讀 ~/.shiftblame/blame/secretary/BLAME.md
- 老闆只問問題時，只分析、判斷、記鍋、問老闆要怎麼處理
- ...

## readme-wrong-file · 2026-04-10
**犯了什麼錯**：...
**怎麼被抓的**：...
**本質原因**：...
**下次怎麼避免**：...
**要改什麼**：---
```
