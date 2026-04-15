---
name: blame-reflect
description: >-
  聚合各部門的鍋紀錄（BLAME.md），提煉常識（規則）與認知（模型），寫回檔頭。
  Use this skill when: the user says "reflect", "聚合鍋紀錄", "/blame-reflect".
---

# shiftblame:reflect — 鍋紀錄聚合

掃描 `~/.shiftblame/blame/` 下所有部門的 BLAME.md，將歷史條目提煉成「常識（規則）」與「認知（模型）」，寫回各 BLAME.md 檔頭。

## 聚合邏輯

對每個 `~/.shiftblame/blame/<DEPT>/BLAME.md`：

1. 掃描所有 `## <slug> · <YYYY-MM-DD>` 區塊
2. 提煉「下次怎麼避免」→ **常識（規則）**
3. 提煉「背後的機制」+「為什麼這條規則有效」→ **認知（模型）**
4. 去重：相同或語意重複的規則合併
5. 常識 + 認知區塊置於標題之後、歷史條目之前
6. 原始歷史條目保留不動

## 執行步驟

### 1. 掃描所有 BLAME.md
```bash
find ~/.shiftblame/blame/ -name 'BLAME.md' -size +0c
```
跳過空檔案。

### 2. 對每個非空的 BLAME.md

讀取檔案，解析：
- 標題行（`# ... 鍋紀錄`）
- 現有常識/認知區塊（若已有 → 重新提煉覆蓋）
- 所有歷史 `##` 區塊

從歷史區塊中提煉：
- **常識**：從每個「下次怎麼避免」提取，去重後列成條列
- **認知**：從每個「背後的機制」+「為什麼這條規則有效」提取，去重後列成條列

### 3. 寫回 BLAME.md

格式：
```markdown
# <DEPT> 鍋紀錄

## 常識（規則）

- [規則 1]
- [規則 2]
...

## 認知（模型）

- [機制 1：為什麼 X 會導致 Y]
- [機制 2：Z 在什麼條件下會壞]
...

## <slug> · <YYYY-MM-DD>
**犯了什麼錯**：...
**怎麼被抓的**：...
**本質原因**：...
**背後的機制**：...
**下次怎麼避免**：...
**為什麼這條規則有效**：...
**要改什麼**：...
---
```

### 4. 回報結果

```
✅ shiftblame:reflect 完成

已更新 X 個 BLAME.md：
- DEV：N 條常識 / M 條認知
- MIS：N 條常識 / M 條認知
- SEC：N 條常識 / M 條認知
- ...
跳過（空檔案）：Y 個
```

## 注意事項
- 只處理 `~/.shiftblame/blame/` 下的檔案
- 不修改任何 repo 內的檔案
- `SECRETARY/BLAME.md` 也要處理（不在各部門目錄下）
